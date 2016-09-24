function translateXML(xmlnode){

    var root = xmlnode.getElementsByTagName("yodaodict")[0];
    
    if ("" + root.getElementsByTagName("return-phrase")[0].childNodes[0] != "undefined") 
        retphrase = root.getElementsByTagName("return-phrase")[0].childNodes[0].nodeValue;

    var strpho = "";
 
    if (""+ root.getElementsByTagName("phonetic-symbol")[0] != "undefined" ) {
        if(""+ root.getElementsByTagName("phonetic-symbol")[0].childNodes[0] != "undefined")
            var pho = root.getElementsByTagName("phonetic-symbol")[0].childNodes[0].nodeValue;
        
        if (pho != null) {
            strpho = "&nbsp;[" + pho + "]";
        }
    }
    
    if (""+ root.getElementsByTagName("translation")[0] == "undefined")
    {
         noBaseTrans = true;
    }
   
    
    if (noBaseTrans == false) {
        translate += retphrase + "<br/><br/><strong>基本释义:</strong><br/>";
        
        if ("" + root.getElementsByTagName("translation")[0].childNodes[0] != "undefined") 
            var translations = root.getElementsByTagName("translation");
        else {
            basetrans += '未找到基本释义';
        }
        
        for (var i = 0; i < translations.length; i++) {
            var line = translations[i].getElementsByTagName("content")[0].childNodes[0].nodeValue + "<br/>";
            if (line.length > 50) {
                var reg = /[;；]/;
                var childs = line.split(reg);
                line = '';
                for (var i = 0; i < childs.length; i++) 
                    line += childs[i] + "<br/>";
            }
            basetrans += line;
        }
    }
    return ;
}

var _word;

function onlineQuery(word,callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          var dataText = translateXML(xhr.responseXML);
          if(dataText != null)
            callback(dataText);
        }
      }
    }
    _word = word;
    var url = 'http://dict.youdao.com/fsearch?client=deskdict&keyfrom=chrome.extension&q='+encodeURIComponent(word)+'&pos=-1&doctype=xml&xmlVersion=3.2&dogVersion=1.0&vendor=unknown&appVer=3.1.17.4208&le=eng'
    xhr.open('GET', url, true);
    xhr.send();
}