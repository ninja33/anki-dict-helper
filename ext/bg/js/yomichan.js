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
            glossary = Handlebars.Utils.escapeExpression(glossary);
            glossary = glossary.replace(/&lt;br&gt;/g,"<br>");
            glossary = glossary.replace(/&lt;b&gt;/g,"<b>");
            glossary = glossary.replace(/&lt;\/b&gt;/g,"</b>");
            return new Handlebars.SafeString(glossary);
        });

        this.translator = new Translator();
        this.onlinedict = new Onlinedict();
        
        this.asyncPools = {};
        this.setState('disabled');
        this.ankiConnectVer = 5;
        this.tabStateMap = {};

        chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
        chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
        chrome.browserAction.onClicked.addListener(this.onBrowserAction.bind(this));
        chrome.tabs.onCreated.addListener((tab) => this.onTabReady(tab, 'onCreated'));
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => this.onTabReady(tab, 'onUpdated'));
        chrome.tabs.onActivated.addListener((activeInfo) => this.onTabActive(activeInfo));
        chrome.tabs.onRemoved.addListener((tabId) => this.onTabRemove(tabId));

        loadOptions((opts) => {
            this.setOptions(opts);
            if (this.options.activateOnStartup) {
                this.setState('loading');
            }
        });
    }

    onInstalled(details) {
        if (details.reason === 'install') {
            chrome.tabs.create({url: chrome.extension.getURL('bg/guide.html')});
        } else if (details.reason === 'update') {
            chrome.tabs.create({url: chrome.extension.getURL('bg/update.html')});
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

    onTabRemove(tabId) {
        // console.log('onTabRemove', tabId)
        if (this.tabStateMap[tabId]) {
            delete this.tabStateMap[tabId];
        }
    }

    onTabActive(activeInfo) {
        let tabId = activeInfo.tabId;
        // console.log('onTabActive', tabId, this.state)
        if (this.state === 'enabled') {
            chrome.browserAction.setBadgeText({
                text: this.tabStateMap[tabId] ? 'off' : ''
            });
        } else if (this.state === 'disabled') {
            
        }
    }

    onTabReady(tab, otherData) {
        let tabId = tab.id;
        if (this.state === 'enabled' && tab.url && this.options.siteNameBlackList.length && tab.active) {
            let setDisabled = null
            this.options.siteNameBlackList.forEach(function(url) {
                if (new RegExp(url).test(tab.url)) {
                    setDisabled = true
                    return
                }
            })
            if (setDisabled) {
                this.tabInvoke(tabId, 'setOptions', this.options);
                this.tabInvoke(tabId, 'setEnabled', false);
                this.tabStateMap[tabId] = {'status': 'disabled'}
                chrome.browserAction.setBadgeText({text: 'off'});
                return
            }
        }
        if (!this.tabStateMap[tabId]) {
            this.tabInvoke(tabId, 'setOptions', this.options);
            this.tabInvoke(tabId, 'setEnabled', this.state === 'enabled');
        }
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
        return 5;
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
        } else {
            callback(null);
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

        let headword = definition.expression;
        const audio = {
            url: `http://dict.youdao.com/dictvoice?audio=${encodeURIComponent(definition.expression)}`,
            filename: `youdao-${encodeURIComponent(definition.expression)}.mp3`,
            skipHash: '7e2c2f954ef6051373ba916f000168dc',
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
        } else {
            callback(null)
        }
    }

    api_renderText({template, data, callback}) {
        callback(Handlebars.templates[template](data));
    }
    
}

window.yomichan = new Yomichan();
