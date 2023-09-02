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


class Client {
    constructor() {
        this.popup = new Popup();
        this.audio = {};
        this.lastMousePos = null;
        this.lastTextSource = null;
        this.activateKey = 16;
        this.activateBtn = 2;
        this.enabled = false;
        this.options = {};
        this.definitions = null;
        this.sequence = 0;
        this.fgRoot = chrome.extension.getURL('fg');

        chrome.runtime.onMessage.addListener(this.onBgMessage.bind(this));
        window.addEventListener('message', this.onFrameMessage.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('resize', (e) => this.hidePopup());
    }

    onKeyDown(e) {
        if (this.enabled && this.lastMousePos !== null && (e.keyCode === this.activateKey || e.charCode === this.activateKey)) {
            this.searchAt(this.lastMousePos);
        }
    }

    
    onMouseMove(e) {
        this.lastMousePos = {x: e.clientX, y: e.clientY};
        if (this.enabled && (e.shiftKey || e.which === this.activateBtn)) {
            this.searchAt(this.lastMousePos);
        }
    }
    
    
    onMouseDown(e) {
        this.lastMousePos = {x: e.clientX, y: e.clientY};
        if (this.enabled && (e.shiftKey || e.which === this.activateBtn)) {
            this.searchAt(this.lastMousePos);
        } else {
            this.hidePopup();
        }
    }

    onBgMessage({action, params}, sender, callback) {
        const method = this['api_' + action];
        if (typeof(method) === 'function') {
            method.call(this, params);
        }

        callback();
    }

    onFrameMessage(e) {
        const {action, params} = e.data, method = this['api_' + action];
        if (typeof(method) === 'function') {
            method.call(this, params);
        }
    }

    searchAt(point) {
        const textSource = Client.textSourceFromPoint(point);
        if (textSource === null || !textSource.containsPoint(point)) {
            this.hidePopup();
            return;
        }

        if (this.lastTextSource !== null && this.lastTextSource.equals(textSource)) {
            return;
        }

        //textSource.setEndOffset(this.options.scanLength);
        textSource.setWordsOffset();
        
        bgFindTerm(textSource.text(), ({definitions, length}) => {
            if (length === 0) {
                this.hidePopup();
            } else {
                textSource.setEndOffset(length);

                let sentence = Client.extractSentence(textSource, this.options.sentenceExtent);
                const elTmp = document.createElement('div');
                elTmp.innerHTML = sentence;
                sentence = (elTmp.textContent || elTmp.innerText || '').trim()
                    .replace(/\s{2,}/g, ' ');

                definitions.forEach((definition) => {
                    definition.url = window.location.href;
                    definition.sentence = sentence;
                });

                const sequence = ++this.sequence;
                bgRenderText(
                    {definitions, root: this.fgRoot, options: this.options, sequence, sentence},
                    'term-list.html',
                    (content) => {
                        this.definitions = definitions;
                        this.showPopup(textSource, content);

                        bgCanAddDefinitions(definitions, ['vocab_kanji', 'vocab_kana'], (states) => {
                            if (states !== null) {
                                states.forEach((state, index) => {
                                    setTimeout(() => {
                                        this.popup.sendMessage('setActionState', {index, state, sequence});
                                    }, 100)
                                });
                            }
                        });
                    }
                );
            }
        });
    }

    showPopup(textSource, content) {
        this.popup.showNextTo(textSource.getRect(), content);

        if (this.options.selectMatchedText) {
            textSource.select();
        }

        this.lastTextSource = textSource;
    }

    hidePopup() {
        this.popup.hide();

        if (this.options.selectMatchedText && this.lastTextSource !== null) {
            this.lastTextSource.deselect();
        }

        this.lastTextSource   = null;
        this.definitions = null;
    }

    api_setOptions(opts) {
        this.options = opts;
        TextSourceRange.nodeNameBlackList = opts.nodeNameBlackList;
    }

    api_setEnabled(enabled) {
        if (!(this.enabled = enabled)) {
            this.hidePopup();
        }
    }

    api_addNote({index, g_index, mode, sentence}) {
        const state = {};
        state[mode] = false;
        if (sentence && this.definitions[index]['sentence']) {
            this.definitions[index]['sentence'] = sentence
        }
        bgAddDefinition(this.definitions[index], g_index, mode, (success) => {
            if (success) {
                this.popup.sendMessage('setActionState', {index, state, sequence: this.sequence});
            } else {
                alert('Note could not be added');
            }
        });
    }

    api_playAudio(index) {
        const definition = this.definitions[index];

        let url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(definition.expression)}`;

        for (let key in this.audio) {
            this.audio[key].pause();
        }

        const audio = this.audio[url] || new Audio(url);
        audio.currentTime = 0;
        audio.play();

        this.audio[url] = audio;
    }

    api_displayKanji(kanji) {
        bgFindKanji(kanji, (definitions) => {
            definitions.forEach((definition) => {
                definition.url = window.location.href;
            });

            const sequence = ++this.sequence;
            bgRenderText(
                {definitions, root: this.fgRoot, options: this.options, sequence},
                'kanji-list.html',
                (content) => {
                    this.definitions = definitions;
                    this.popup.setContent(content, definitions);

                    bgCanAddDefinitions(definitions, ['kanji'], (states) => {
                        if (states !== null) {
                            states.forEach((state, index) => this.popup.sendMessage('setActionState', {index, state, sequence}));
                        }
                    });
                }
            );
        });
    }

    static textSourceFromPoint(point) {
        const element = document.elementFromPoint(point.x, point.y);
        if (element !== null) {
            const names = ['IMG', 'INPUT', 'BUTTON', 'TEXTAREA'];
            if (names.indexOf(element.nodeName) !== -1) {
                return new TextSourceElement(element);
            }
        }

        const range = document.caretRangeFromPoint(point.x, point.y);
        if (range !== null) {
            return new TextSourceRange(range);
        }

        return null;
    }

    static extractSentence(source, extent) {
        //const quotesFwd = {'「': '」', '『': '』', "'": "'", '"': '"'};
        //const quotesBwd = {'」': '「', '』': '『', "'": "'", '"': '"'};
        const quotesFwd = {'「': '」', '『': '』'};
        const quotesBwd = {'」': '「', '』': '『'};
        const terminators = '…。．.？?！!';

        const sourceLocal = source.clone();
        const position = sourceLocal.setStartOffset(extent);
        sourceLocal.setEndOffset(position + extent);
        const content = sourceLocal.text();

        let quoteStack = [];

        let startPos = 0;
        for (let i = position; i >= startPos; --i) {
            const c = content[i];

            if (quoteStack.length === 0 && (terminators.indexOf(c) !== -1 || c in quotesFwd)) {
                startPos = i + 1;
                break;
            }

            if (quoteStack.length > 0 && c === quoteStack[0]) {
                quoteStack.pop();
            } else if (c in quotesBwd) {
                quoteStack = [quotesBwd[c]].concat(quoteStack);
            }
        }

        quoteStack = [];

        let endPos = content.length;
        for (let i = position; i < endPos; ++i) {
            const c = content[i];

            if (quoteStack.length === 0) {
                if (terminators.indexOf(c) !== -1) {
                    endPos = i + 1;
                    break;
                }
                else if (c in quotesBwd) {
                    endPos = i;
                    break;
                }
            }

            if (quoteStack.length > 0 && c === quoteStack[0]) {
                quoteStack.pop();
            } else if (c in quotesFwd) {
                quoteStack = [quotesFwd[c]].concat(quoteStack);
            }
        }

        return content.substring(startPos, endPos).trim();
    }
}

window.yomiClient = new Client();
