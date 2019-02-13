# -*- coding: utf-8 -*-
#!/usr/bin/env python
import codecs
import json
import optparse
import os.path
from bs4 import BeautifulSoup

def load_definitions(path):
    print ('Parsing "{0}"...'.format(path))
    with codecs.open(path, encoding='utf-8') as fp:
        return filter(lambda x: x and x[0] != '#', fp.read().splitlines())

def parse_edict(path):
    results = {}

    for line in load_definitions(path):
        segments = line.split('\t', 1)
        expression = segments[0].strip().lower()
        if expression == '':
            continue

        segments[1] = segments[1].replace('\t', ' ')
        soup = BeautifulSoup(segments[1], 'lxml')


        star = ''
        wordstars = soup.select('.freq')
        for wordstar in wordstars:
            star += wordstar.get_text()

        readings = []
        phonetics = soup.select('.prons strong[lang="EN-US"]')
        for phonetic in phonetics:
            readings.append(phonetic.get_text())

        defs=[]
        def_segments = soup.select('.collins_en_cn')
        for dfn in def_segments:
            lable = dfn.select('.st')
            lable_cn = dfn.select('.st .tips_content')
            if len(lable) and len(lable_cn)> 0:
                pos_en = lable[0].get_text()
                pos_cn = lable_cn[0].get_text()
                pos_en = pos_en.replace(pos_cn,'')

            definition = []
            definition = dfn.select('span.text_blue')
            if len(definition) <= 0 or definition[0].get_text() == '':
                continue
            def_cn = definition[0].get_text()
            def_en = dfn.select('span.endef')[0].get_text() if len(dfn.select('span.endef')) > 0 else ''
            examples = dfn.select('ul > li')
            ext = []
            for index, example in enumerate(examples):
                if index > 1: break
                ext_en = example.select('p:nth-of-type(1)')[0].get_text() if len(example.select('p:nth-of-type(1)')) > 0 else ''
                ext_cn = example.select('p:nth-of-type(2)')[0].get_text() if len(example.select('p:nth-of-type(2)')) > 0 else ''
                ext.append({'ext_en':ext_en,'ext_cn':ext_cn})
                
            defs.append({'pos_en':pos_en,'pos_cn':pos_cn,'def_en':def_en,'def_cn':def_cn,'ext':ext})

        results[expression] = {'readings':readings, 'star':star, 'defs':defs}

    return results


def output_dict_json(output_dir, input_file, parser):
    if input_file is not None:
        base = os.path.splitext(os.path.basename(input_file))[0]
        with codecs.open(os.path.join(output_dir, base) + '.json', 'w', encoding='utf-8') as fp:
            json.dump(parser(input_file), fp, ensure_ascii=False)


def build_db_json(dict_dir, edict):
    if edict is not None:
        output_dict_json(dict_dir, edict, parse_edict)


def main():
    parser = optparse.OptionParser()
    parser.add_option('--edict', dest='edict')

    options, args = parser.parse_args()

    #build_db_json('.', 'collins.txt')

    if len(args) == 1:
        build_db_json(args[0], options.edict)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
