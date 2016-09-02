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

        this.translator = new Translator();
        this.asyncPools = {};
        this.setState('disabled');
        this.loginStatus = '';

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
        });
    }

    onInstalled(details) {
        if (details.reason === 'install') {
            chrome.runtime.openOptionsPage();
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
        this.api_getVersion({callback: (version) => {
            if (version === this.getApiVersion()) {
                this.ankiInvoke(action, params, pool, callback);
            } else {
                callback(null);
            }
        }});
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
            this.api_invokeAnkiweb(action, params, callback);            
        } else {
            callback(null);
        }
    }

    formatField(field, definition, mode) {
        const tags = [
            'audio',
            'character',
            'expression',
            'glossary',
            'glossary-list',
            'kunyomi',
            'onyomi',
            'reading',
            'sentence',
            'tags',
            'url',
        ];

        for (let tag of tags) {
            let value = definition[tag] || null;
            switch (tag) {
                case 'audio':
                    value = '';
                    break;
                case 'expression':
                    if (mode === 'vocab_kana' && definition.reading) {
                        value = definition.reading;
                    }
                    break;
                case 'reading':
                    if (mode === 'vocab_kana') {
                        value = null;
                        break;
                    }
                    value = `${definition.reading.replace(/\//g,'')}`;
                    break;
                case 'glossary':
                    if (definition.glossary) {
                        value = '';
                        for (let gloss of definition.glossary) {
                            value += `${gloss}<br>`;
                        }
                    }
                    break;
                case 'glossary-list':
                    if (definition.glossary) {
                        value = '<ol>';
                        for (let gloss of definition.glossary) {
                            value += `<li>${gloss}</li>`;
                        }
                        value += '</ol>';
                    }
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

    formatNote(definition, mode) {
        const note = {fields: {}, tags: this.options.ankiCardTags};

        let fields = [];
        if (mode === 'kanji') {
            fields         = this.options.ankiKanjiFields;
            note.deckName  = this.options.ankiKanjiDeck;
            note.modelName = this.options.ankiKanjiModel;
        } else {
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
        }

        for (let name in fields) {
            note.fields[name] = this.formatField(fields[name], definition, mode);
        }

        return note;
    }

    api_addDefinition({definition, mode, callback}) {
        const note = this.formatNote(definition, mode);
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
        callback(this.translator.findTerm(text));
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
            this.api_connectAnkiweb(forceRelogin=true, callback);
        } else {
            callback(null)
        }
    }

    api_renderText({template, data, callback}) {
        callback(Handlebars.templates[template](data));
    }
    
    api_connectAnkiweb(forceRelogin, callback) {
        if (forceRelogin || this.loginStatus != "OK") {
            console.log("Logout form AnkiWeb");
            currentXhr = $.get('https://ankiweb.net/account/logout', function (data, textStatus) { //Start with logging any other user off.
                console.log("Login to AnkiWeb");
                currentXhr = $.post('https://ankiweb.net/account/login', { //Submit user info
                        submitted: "1",
                        username: this.options.ankiwebUsername,
                        password: this.options.ankiwebPassword
                    },
                    function (data, textStatus) {
                        const html = $(data);
                        if ($(".mitem", html).length == 0) { //Look for element with class 'mitem' which is only used by the tabs that show up when logged in.
                            this.loginStatus = "ERROR";
                            callback(null); //return null to indicate connection failed.
                        } else {
                            this.loginStatus = "OK";
                            callback(this.getApiVersion()); //return right answer of api_getVersion() to indicate success :-).
                        }
                    });
            });
        }
    }

    api_invokeAnkiweb(action, params, callback) {
        currentXhr = $.get('https://ankiweb.net/edit/', function (data, textStatus) {
            console.log("decks and models data loaded");
            if (textStatus == 'error') {
                this.loginStatus = "ERROR";
                callback(null);
            } else {
                const models = jQuery.parseJSON(/editor\.models = (.*}]);/.exec(data)[1]); //[0] = the matching text, [1] = first capture group (what's inside parentheses)
                const decks = jQuery.parseJSON(/editor\.decks = (.*}});/.exec(data)[1]);

                result = null;
                switch (action) {
                    case 'deckNames':
                        var decknames = [];
                        for (let d in decks) {
                            if (!(d == 1 && decks[d].mid == null && Object.keys(decks).length > 1)) {
                                decknames.push(decks[d].name);
                            }
                        }
                        decknames.sort();
                        result = decknames;
                        break;
                    case 'modelNames':
                        var modelnames = [];
                        for (let m in models) {
                            modelnames.push(models[m].name);
                        }
                        result = modelnames;
                        break;
                    case 'modelFieldNames':
                        var fieldnames = [];
                        for (let m in models) {
                            if (models[m].name == params) {
                                for (let f in models[m].flds) {
                                    fieldnames.push(models[m].flds[f].name);
                                }
                            break;
                            }
                        }
                        result = fieldnames;
                        break;
                }
                callback(result);
            }
        });
    }

}

window.yomichan = new Yomichan();
