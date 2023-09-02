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


function sanitizeOptions(options) {
    const defaults = {
        activateOnStartup:   false,
        selectMatchedText:   true,
        enableAudioPlayback: true,
        enableOnlineDict:    false,
        disableAnkiOption:   true,
        enableAnkiConnect:   false,
        ankiCardTags:        ['dict-helper'],
        sentenceExtent:      200,
        ankiVocabDeck:       '',
        ankiVocabModel:      '',
        ankiVocabFields:     {},
        nodeNameBlackList:   [],
        siteNameBlackList:   []
    };

    for (let key in defaults) {
        if (!(key in options)) {
            options[key] = defaults[key];
        }
    }

    return options;
}

function loadOptions(callback) {
    chrome.storage.local.get(null, (items) => callback(sanitizeOptions(items)));
}

function saveOptions(opts, callback) {
    chrome.storage.local.set(sanitizeOptions(opts), callback);
}
