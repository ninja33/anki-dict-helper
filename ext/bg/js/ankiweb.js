/*
 * 版权所有 (C) 2016  Ninja Huang  <http://ninja33.github.io>
 * 
 * 本程序为自由软件，在自由软件联盟发布的GNU通用公共许可协议的约束下，
 * 你可以对其进行再发布及修改。协议版本为第三版或更新的版本。
 * 
 * 我们希望发布的这款程序有用，但不保证，甚至不保证它有经济价值和适合
 * 特定用途。详情参见GNU通用公共许可协议。
 * 
 * 你理当已收到一份GNU通用公共许可协议的副本。如果没有，
 * 请查阅<http://www.gnu.org/licenses/>。
 */

class Ankiweb {
    constructor() {
        this.urls = {
            logout : 'https://ankiweb.net/account/logout',
            login  : 'https://ankiweb.net/account/login',
            edit   : 'https://ankiweb.net/edit/',
            save   : 'https://ankiweb.net/edit/save'
        };

        this.connected   = false;
        this.decks       = [];
        this.models      = [];
        this.mids        = {};
        this.modelfields = {};
    }

    connect(ankiwebID, ankiwebPassword, callback) {
        
        this.connected = false;
        callback(false); //temporarily disabled ankiweb interface.
        return;
        
        var currentXhr = $.get(this.urls['logout'], (data, textStatus) => { //Start with logging any other user off.
            console.log("Login to AnkiWeb");
            currentXhr = $.post(this.urls['login'], { //Submit user info
                    submitted  : "1",
                    csrf_token : $('input[name=csrf_token]', $(data)).val(),
                    username   : ankiwebID,
                    password   : ankiwebPassword
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
                var modelids = {};
                for (let m in models) {
                    modelnames.push(models[m].name);
                    modelids[models[m].name] = models[m].id;
                }
                this.models = modelnames;
                this.mids = modelids;
                
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
                console.log("decks & models data loaded success");
                callback(true);
            }
        });
    }

    
    save(note, callback){

        var fields = [];
        for (let f of this.modelfields[note.modelName]){
            fields.push(note.fields[f])
        }

        var note_data = [fields, note.tags.join(' ')];

        var currentXhr = $.get(this.urls['edit'], (data, textStatus) => {
            if (textStatus == 'error') {
                this.connected = false;
                callback(null);
            } else {
                const csrf_token_string = /editor\.csrf_token = \'(.*)\';/.exec(data)[1];

                var dict = {
                    csrf_token: csrf_token_string,
                    data: JSON.stringify(note_data),
                    mid: this.mids[note.modelName],
                    deck: note.deckName
                };

                var currentXhr = $.post(this.urls['save'], dict, (data, textStatus) => {
                    if (textStatus == 'error') {
                        callback(null);
                    }
                    callback(true);
                    console.log("save to ankiweb");
                });
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
