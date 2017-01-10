Handlebars is semantic html templates.

/bg/js/templates.js in xpi is pre-compiled Handlebars template output in js format

to reproduce templates.js, you need install Handlebars node.js package
> npm install --save handlebars

then run handlebars CLI in source directory.
> handlebars footer.html header.html kanji-link.html kanji-list.html kanji.html term-list.html term.html -f templates.js
