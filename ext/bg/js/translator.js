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


class Translator {
    constructor() {
        this.paths = {
            tags:     'bg/data/tags.json',
            edict:    'bg/data/edict.json',
            enamdict: 'bg/data/enamdict.json',
            wordforms:'bg/data/wordforms.json'
        };

        this.loaded      = false;
        this.tags        = null;
        this.dictionary  = new Dictionary();
        this.deinflector = new Deinflector();
    }

    loadData({loadEnamDict=true}, callback) {
        if (this.loaded) {
            callback();
            return;
        }

        let files = ['tags', 'edict', 'wordforms'];
        if (loadEnamDict) {
            files = files.concat('enamdict');
        }

        const pendingLoads = [];
        for (let key of files) {
            pendingLoads.push(key);
            Translator.loadData(this.paths[key], (response) => {
                switch (key) {
                    case 'rules':
                        this.deinflector.setRules(JSON.parse(response));
                        break;
                    case 'tags':
                        this.tags = JSON.parse(response);
                        break;
                    case 'wordforms':
                        this.dictionary.addFormDict(JSON.parse(response));
                        break;
                    case 'kanjidic':
                        this.dictionary.addKanjiDict(key, JSON.parse(response));
                        break;
                    case 'edict':
                    case 'enamdict':
                        this.dictionary.addTermDict(key, JSON.parse(response));
                        break;
                }

                pendingLoads.splice(pendingLoads.indexOf(key), 1);
                if (pendingLoads.length === 0) {
                    this.loaded = true;
                    callback();
                }
            });
        }
    }

    findTerm(text) {
        const groups = {};
        
        const segments = text.replace(/[^\w]/g,' ').trim().split(' ')

        function isEmptyObject(obj) {
            return Object.keys(obj).length === 0;
        }

        for (let i = segments.length; i>0; --i){
            const term = segments.slice(0,i).join(' ').trim();
            const tags = [];
            for (let d of this.dictionary.findTerm(term)) {
                tags.concat(d.tags);
            }
            this.processTerm(groups, term, tags, [], term);
        }
        
        let definitions = [];
        for (let key in groups) {
            definitions.push(groups[key]);
        }

        definitions = definitions.sort((v1, v2) => {
            const sl1 = v1.source.length;
            const sl2 = v2.source.length;
            if (sl1 > sl2) {
                return -1;
            } else if (sl1 < sl2) {
                return 1;
            }

            const el1 = v1.expression.length;
            const el2 = v2.expression.length;
            if (el1 > el2) {
                return -1;
            } else if (el1 < el2) {
                return 1;
            }

            return v2.expression.localeCompare(v1.expression);
        });
        
        let length = 0;
        for (let result of definitions) {
            length = Math.max(length, result.source.length);
        }

        return {definitions: definitions, length: length};
    }

    findKanji(text) {
        let definitions = [];
        const processed = {};

        for (let c of text) {
            if (!processed[c]) {
                definitions = definitions.concat(this.dictionary.findKanji(c));
                processed[c] = true;
            }
        }

        return definitions;
    }

    processTerm(groups, source, tags, rules=[], root='') {
        for (let entry of this.dictionary.findTerm(root)) {
            if (entry.id in groups) {
                continue;
            }

            let matched = tags.length == 0;
            for (let t of tags) {
                if (entry.tags.indexOf(t) !== -1) {
                    matched = true;
                    break;
                }
            }

            let popular  = false;
            let tagItems = [];
            for (let tag of entry.tags) {
                const tagItem = this.tags[tag];
                if (tagItem && entry.addons.indexOf(tag) === -1) {
                    tagItems.push({
                        class: tagItem.class || 'default',
                        order: tagItem.order || Number.MAX_SAFE_INTEGER,
                        desc:  tagItem.desc,
                        name:  tag
                    });
                }

                //
                // TODO: Handle tagging as popular through data.
                //

                if (tag === 'P') {
                    popular = true;
                }
            }

            if (matched) {
                groups[entry.id] = {
                    expression: entry.expression,
                    reading:    entry.reading,
                    glossary:   entry.glossary,
                    tags:       tagItems,
                    source:     source,
                    rules:      rules,
                    popular:    popular
                };
            }
        }
    }

    static isKanji(c) {
        const code = c.charCodeAt(0);
        return code >= 0x4e00 && code < 0x9fb0 || code >= 0x3400 && code < 0x4dc0;
    }

    static loadData(url, callback) {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => callback(xhr.responseText));
        xhr.open('GET', chrome.extension.getURL(url), true);
        xhr.send();
    }
}
