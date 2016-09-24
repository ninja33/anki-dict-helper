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

class Onlinedict {   
    constructor() {
        this.urls = 'http://dict.youdao.com/fsearch?client=deskdict&keyfrom=chrome.extension&pos=-1&doctype=xml&xmlVersion=3.2&dogVersion=1.0&vendor=unknown&appVer=3.1.17.4208&le=eng&q=';
    }

    findTerm(text, params, callback){

        var terms = text.replace(/[^\w]/g,' ').trim().split(' ');
        var term = terms[0].trim();

        var currentXhr = $.get(this.urls+term, (data, textStatus) => {
            if (textStatus == 'error') {
                callback(params);
            } else {
                var root = data.getElementsByTagName("yodaodict")[0];

                var strpho = "";
                if (""+ root.getElementsByTagName("phonetic-symbol")[0] != "undefined" ) {
                    if(""+ root.getElementsByTagName("phonetic-symbol")[0].childNodes[0] != "undefined")
                        var pho = root.getElementsByTagName("phonetic-symbol")[0].childNodes[0].nodeValue;

                    if (pho != null) {
                        strpho = pho;
                    }
                }
                var basetrans = "";
                if (""+ root.getElementsByTagName("translation")[0] != "undefined") {
                    if ("" + root.getElementsByTagName("translation")[0].childNodes[0] != "undefined") {
                        var translations = root.getElementsByTagName("translation");
                        for (var i = 0; i < translations.length-1; i++) {
                            var line = translations[i].getElementsByTagName("content")[0].childNodes[0].nodeValue + "<br>";
                            if (line.length > 50) {
                                var reg = /[;；]/;
                                var childs = line.split(reg);
                                line = '';
                                for (var i = 0; i < childs.length; i++) 
                                    line += childs[i] + "<br>";
                            }
                            basetrans += line;
                        }
                        basetrans += translations[i].getElementsByTagName("content")[0].childNodes[0].nodeValue;
                        var {definitions, len} = params;
                        var tag = {
                            class: 'onlinedict',
                            order: Number.MAX_SAFE_INTEGER,
                            desc:  'Online Dictionary',
                            name:  '在线词典'
                        };
                        var onlinedef = {
                            expression: term,
                            reading:    strpho,
                            glossary:   [basetrans],
                            tags:       [tag],
                            source:     term,
                            rules:      [],
                            popular:    false
                        };
                        definitions = [].concat(onlinedef, definitions);
                        let length = 0;
                        for (let result of definitions) {
                            length = Math.max(length, result.source.length);
                        }
                        callback({definitions: definitions, length: length}); 
                    } else {
                        callback(params);
                    }
                } else {
                    callback(params);
                }
            }    
        });
    }
} 

