# Anki划词制卡助手 #

"划词翻译，一键制卡"

英语学习者在新闻网站或者社交媒体上进行增量阅读(Incremental Reading)或者沉浸式阅读(Immersion Reading)时，往往需要能够随手翻译生词帮助理解，而阅读过后，又希望能将刚才阅读时遇到的生词和上下文语句作为笔记保存，以供日后复习。Anki本身提供了不错的间隔式复习功能，但是制卡的过程略微繁琐。Anki划词制卡助手，就是为了帮助学习者在阅读的同时，将生词，释义，音标，语音音频和上下文例句一键保存并制作成Anki卡片，以供日后复习。

## 环境需求 ##

For building:

*   [7-Zip](http://www.7-zip.org/)
*   [Git LFS](https://git-lfs.github.com/)
*   [Handlebars](http://handlebarsjs.com/)
*   [Node.js](https://nodejs.org/)
*   [Python 3](https://www.python.org/downloads/releases/3.0)

For AnkiConnect:

*   [Anki](http://ankisrs.net/)

## 插件安装 ##

最简单的安装方法是通过Chrome应用商店安装插件

1. 下载地址: [Anki划词制卡助手](https://chrome.google.com/webstore/detail/anki%E5%88%92%E8%AF%8D%E5%88%B6%E5%8D%A1%E5%8A%A9%E6%89%8B/ajencmdaamfnkgilhpgkepfhfgjfplnn)
2. 按Chrome浏览器提示安装。

## 使用方法 ##

1. 在浏览需要翻译的英语网站时，将鼠标移动到英语单词处，按住Shift即可获取实时翻译。
2. 按发音按钮(小喇叭图标)，可以听取单词发音。
3. 按绿色加号按钮，将单词，词语，翻译的中文释义，单词在网页中所在句子（上下文），网址，和音频，按照之前设置的区域映射关系，自动在Anki PC端生成一张卡片。

## 屏幕截图 ##

[![Anki Connect Option](https://ninja33.github.io/images/anki-dict-helper-01-thumb.jpg)](https://ninja33.github.io/images/anki-dict-helper-01.jpg)
[![Instant Translation](https://ninja33.github.io/images/anki-dict-helper-05-thumb.jpg)](https://ninja33.github.io/images/anki-dict-helper-05.jpg)
[![Anki Browser Screen](https://ninja33.github.io/images/anki-dict-helper-06-thumb.jpg)](https://ninja33.github.io/images/anki-dict-helper-06.jpg)

## 许可协议 ##

GPL

## 变更日志 ##
0.96

1. 优化单词原形匹配。

0.95:

1. 补遗3900+词典词条，修正仅高亮词根的错误。
2. 词组匹配后优先显示，优化词语搜索性能。

0.94:

1. 单词原型查询：使用了全量词性映射表，消除了因单词变形而找不到单词的问题。
2. 去掉防重限制: 一次多义的单词可以在Anki反复添加(卡片重复交由anki管理)。
3. 弹窗格式改动：具有词性彩色高亮和所查的关键字在例句中高亮功能。
4. 匹配词组显示：在词根的单词解释里，会把相关词组高亮。

0.93

1. first version forked from [FooSoft Yomichan Chomre Extension](https://github.com/FooSoft/yomichan-chrome)
