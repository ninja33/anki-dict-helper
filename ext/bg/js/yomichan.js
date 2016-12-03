/*
 * Copyright (C) 2016  Alex Yatskov <alex@foosoft.net>
 * Author: Alex Yatskov <alex@foosoft.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


class Yomichan {
    constructor() {
        Handlebars.partials = Handlebars.templates;
        Handlebars.registerHelper('kanjiLinks', function(options) {
            let result = '';
            for (let c of options.fn(this)) {
                if (Translator.isKanji(c)) {
                    result += Handlebars.templates['kanji-link.html']({kanji: c}).trim();
                } else {
                    result += c;
                }
            }

            return result;
        });

        Handlebars.registerHelper('escape', function(glossary) {
            //glossary = Handlebars.Utils.escapeExpression(glossary);
            //glossary = glossary.replace(/&lt;br&gt;/g,"<br>");
            //glossary = glossary.replace(/&lt;b&gt;/g,"<b>");
            //glossary = glossary.replace(/&lt;\/b&gt;/g,"</b>");
            return new Handlebars.SafeString(glossary);
        });

        this.translator = new Translator();
        this.ankiweb = new Ankiweb();
        this.onlinedict = new Onlinedict();
        
        this.asyncPools = {};
        this.setState('disabled');
        this.ankiConnectVer = 0;
        this.ankiwebConnected = false;

        chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
        chrome.browserAction.onClicked.addListener(this.onBrowserAction.bind(this));
        chrome.tabs.onCreated.addListener((tab) => this.onTabReady(tab.id));
        chrome.tabs.onUpdated.addListener(this.onTabReady.bind(this));

        loadOptions((opts) => {
            this.setOptions(opts);
            if (this.options.activateOnStartup) {
                this.setState('loading');
            }
            if (this.options.enableAnkiWeb) {
                this.connectAnkiweb(result => this.ankiwebConnected = result);
            }
        });
    }

    onInstalled(details) {
        if (details.reason === 'install') {
            chrome.tabs.create({url: chrome.extension.getURL('bg/guide.html')});
        }
    }

    onMessage(request, sender, callback) {
        const {action, params} = request, method = this['api_' + action];

        if (typeof(method) === 'function') {
            params.callback = callback;
            method.call(this, params);
        }

        return true;
    }

    onTabReady(tabId) {
        this.tabInvoke(tabId, 'setOptions', this.options);
        this.tabInvoke(tabId, 'setEnabled', this.state === 'enabled');
    }

    onBrowserAction() {
        switch (this.state) {
            case 'disabled':
                this.setState('loading');
                break;
            case 'enabled':
                this.setState('disabled');
                break;
        }
    }

    setState(state) {
        if (this.state === state) {
            return;
        }

        this.state = state;

        switch (state) {
            case 'disabled':
                chrome.browserAction.setBadgeText({text: 'off'});
                break;
            case 'enabled':
                chrome.browserAction.setBadgeText({text: ''});
                break;
            case 'loading':
                chrome.browserAction.setBadgeText({text: '...'});
                this.translator.loadData({loadEnamDict: this.options.loadEnamDict}, () => this.setState('enabled'));
                break;
        }

        this.tabInvokeAll('setEnabled', this.state === 'enabled');
    }

    setOptions(options) {
        this.options = options;
        this.tabInvokeAll('setOptions', this.options);
    }

    getApiVersion() {
        return 1;
    }

    tabInvokeAll(action, params) {
        chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs) {
                this.tabInvoke(tab.id, action, params);
            }
        });
    }

    tabInvoke(tabId, action, params) {
        chrome.tabs.sendMessage(tabId, {action, params}, () => null);
    }

    ankiInvokeSafe(action, params, pool, callback) {
        if (this.ankiConnectVer === this.getApiVersion()) {
            this.ankiInvoke(action, params, pool, callback);
        } else {
            this.api_getVersion({callback: (version) => {
                if (version === this.getApiVersion()) {
                    this.ankiConnectVer = version;
                    this.ankiInvoke(action, params, pool, callback);
                } else {
                    callback(null);
                }
            }});
        }
    }

    ankiInvoke(action, params, pool, callback) {
        if (this.options.enableAnkiConnect) {
            if (pool !== null && this.asyncPools.hasOwnProperty(pool)) {
                this.asyncPools[pool].abort();
            }

            const xhr = new XMLHttpRequest();
            xhr.addEventListener('loadend', () => {
                if (pool !== null) {
                    delete this.asyncPools[pool];
                }

                const resp = xhr.responseText;
                callback(resp ? JSON.parse(resp) : null);
            });

            xhr.open('POST', 'http://127.0.0.1:8765');
            xhr.send(JSON.stringify({action, params}));
        } else if (this.options.enableAnkiWeb){
            this.invokeAnkiweb(action, params, callback);            
        } else {
            callback(null);
        }
    }

    invokeAnkiweb(action, params, callback) {
        switch (action) {
            case 'deckNames':
                callback(this.ankiweb.decks);
                break;
            case 'modelNames':
                callback(this.ankiweb.models);
                break;
            case 'modelFieldNames':
                callback(this.ankiweb.modelfields[params['modelName']]);
                break;
            case 'addNote':
                this.ankiweb.save(params['note'],callback);
                break;
            case 'canAddNotes':
                var results = [];
                if (this.ankiwebConnected) {
                    params['notes'].forEach(()=>results.push(true));
                } else {
                    params['notes'].forEach(()=>results.push(false));
                }
                callback(results);
                break;
        }
    }

    
    formatField(field, definition, g_index, mode) {
        const tags = [
            'audio',
            'expression',
            'glossary',
            'g-list',
            'reading',
            'sentence',
            'cloze',
            'tags',
            'url',
        ];

        for (let tag of tags) {
            let value = definition[tag] || null;
            switch (tag) {
                case 'audio':
                    value = '';
                    break;
                case 'reading':
                    value = `${definition.reading.replace(/\//g,'')}`;
                    break;
                case 'glossary':
                    value = '';
                    if (definition.glossary[g_index]) {
                        value = definition.glossary[g_index]
                    }
                    break;
                case 'g-list':
                    if (definition.glossary) {
                        value = '';
                        for (let gloss of definition.glossary) {
                            value += `${gloss}<hr>`;
                        }
                    }
                    break;
                case 'sentence':
                    value = `${definition.sentence.replace(definition.source,"<b>"+definition.source+"</b>")}`;
                    break;
                case 'cloze':
                    value = `${definition.sentence.replace(definition.source,"<b>{{c1::"+definition.source+"}}</b>")}`;
                    break;
                case 'tags':
                    if (definition.tags) {
                        value = definition.tags.map((t) => t.name);
                    }
                    break;
            }

            if (value !== null && typeof(value) !== 'string') {
                value = value.join(', ');
            }

            field = field.replace(`{${tag}}`, value || '');
        }

        return field;
    }

    formatNote(definition, g_index, mode) {
        const note = {fields: {}, tags: this.options.ankiCardTags};

        let fields = [];
        fields         = this.options.ankiVocabFields;
        note.deckName  = this.options.ankiVocabDeck;
        note.modelName = this.options.ankiVocabModel;

        const audio = {
            kanji:  definition.expression,
            kana:   definition.reading,
            fields: []
        };

        for (let name in fields) {
            if (fields[name].indexOf('{audio}') !== -1) {
                audio.fields.push(name);
            }
        }

        if (audio.fields.length > 0) {
            note.audio = audio;
        }

        for (let name in fields) {
            note.fields[name] = this.formatField(fields[name], definition, g_index, mode);
        }

        return note;
    }

    api_addDefinition({definition, g_index, mode, callback}) {
        const note = this.formatNote(definition, g_index, mode);
        this.ankiInvokeSafe('addNote', {note}, null, callback);
    }

    api_canAddDefinitions({definitions, modes, callback}) {
        let notes = [];
        for (let definition of definitions) {
            for (let mode of modes) {
                notes.push(this.formatNote(definition, mode));
            }
        }

        this.ankiInvokeSafe('canAddNotes', {notes}, 'notes', (results) => {
            const states = [];

            if (results !== null) {
                for (let resultBase = 0; resultBase < results.length; resultBase += modes.length) {
                    const state = {};
                    for (let modeOffset = 0; modeOffset < modes.length; ++modeOffset) {
                        state[modes[modeOffset]] = results[resultBase + modeOffset];
                    }

                    states.push(state);
                }
            }

            callback(states);
        });
    }

    api_findKanji({text, callback}) {
        callback(this.translator.findKanji(text));
    }

    api_findTerm({text, callback}) {
        var localdefs = this.translator.findTerm(text);
        if (this.options.enableOnlineDict){
           this.onlinedict.findTerm(text, localdefs, callback);
        }
        else {
            callback(localdefs);
        }
    }

    api_getDeckNames({callback}) {
        this.ankiInvokeSafe('deckNames', {}, null, callback);
    }

    api_getModelNames({callback}) {
        this.ankiInvokeSafe('modelNames', {}, null, callback);
    }

    api_getModelFieldNames({modelName, callback}) {
        this.ankiInvokeSafe('modelFieldNames', {modelName}, null, callback);
    }

    api_getVersion({callback}) {
        if (this.options.enableAnkiConnect) {
            this.ankiInvoke('version', {}, null, callback);
        } else if (this.options.enableAnkiWeb) {
            if (this.ankiwebConnected) {
                callback(1);
            } else {
                callback(null);
            }
        } else {
            callback(null)
        }
    }

    api_renderText({template, data, callback}) {
        callback(Handlebars.templates[template](data));
    }
    
    connectAnkiweb(callback) {
        this.ankiweb.connect(this.options.ankiwebUsername, this.options.ankiwebPassword, callback);
    }
}

window.yomichan = new Yomichan();
