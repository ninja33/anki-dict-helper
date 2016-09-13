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


class Ankiweb {
    constructor() {
        this.urls = {
            logout : 'https://ankiweb.net/account/logout',
            login  : 'https://ankiweb.net/account/login',
            edit   : 'https://ankiweb.net/edit/',
            save   : 'https://ankiweb.net/save/'
        };

        this.connected   = false;
        this.decks       = [];
        this.models      = [];
        this.modelfields = {};
    }

    connect(ankiwebID, ankiwebPassword, callback) {
        console.log("Logout form AnkiWeb");
        var currentXhr = $.get(this.urls['logout'], (data, textStatus) => { //Start with logging any other user off.
            console.log("Login to AnkiWeb");
            currentXhr = $.post(this.urls['login'], { //Submit user info
                    submitted: "1",
                    username: ankiwebID,
                    password: ankiwebPassword
                }, (data, textStatus) => {
                    const html = $(data);
                    if ($(".mitem", html).length == 0) { //Look for element with class 'mitem' which is only used by the tabs that show up when logged in.
                        console.log("Login Fail");
                        this.connected = false;
                        callback(false); //return null to indicate connection failed.
                    } else {
                        console.log("Login Success");
                        this.connected = true;
                        this.retrieve(callback); //return right answer of api_getVersion() to indicate success :-).
                    }
                });
        });
    }

    retrieve(callback) {
        var currentXhr = $.get(this.urls['edit'], (data, textStatus) => {
            console.log("decks and models data loading");
            if (textStatus == 'error') {
                this.connected = false;
                callback(false);
            } else {
                const models = jQuery.parseJSON(/editor\.models = (.*}]);/.exec(data)[1]); //[0] = the matching text, [1] = first capture group (what's inside parentheses)
                const decks = jQuery.parseJSON(/editor\.decks = (.*}});/.exec(data)[1]);

                var decknames = [];
                for (let d in decks) {
                    if (!(d == 1 && decks[d].mid == null && Object.keys(decks).length > 1)) {
                        decknames.push(decks[d].name);
                    }
                }
                decknames.sort();
                this.decks = decknames;

                var modelnames = [];
                for (let m in models) {
                    modelnames.push(models[m].name);
                }
                this.models = modelnames;
                
                var modelfieldnames = {};
                for (let m in models) {
                    var fieldnames = [];
                    for (let f in models[m].flds) {
                        fieldnames.push(models[m].flds[f].name);
                    }
                    modelfieldnames[models[m].name] = fieldnames;
                }
                this.modelfields = modelfieldnames;
                this.connected = true;
                console.log("decks and models data loaded successfully!");
                callback(true);
            }
        });
    }


    static connectAnkiweb(method, url, callback) {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => callback(xhr.responseText));
        xhr.open(method, chrome.extension.getURL(url), true);
        xhr.send();
    }
}
