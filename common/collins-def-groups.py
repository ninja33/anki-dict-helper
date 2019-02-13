# -*- coding: utf-8 -*-
#!/usr/bin/env python

# Copyright (C) 2016  Alex Yatskov <alex@foosoft.net>
# Author: Alex Yatskov <alex@foosoft.net>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.


import codecs
import json
import optparse
import os.path
import re
from bs4 import BeautifulSoup

PARSED_TAGS = {
    'abbr.',
    'adj.',
    'adv.',
    'conj.',
    'int.',
    'n.',
    'pron.',
    'vi.',
    'vt.',
    'v.',
    'convention.',
    'phrase.',
    'det.',
    'quest.',
    'prep.'
}


def load_definitions(path):
    print 'Parsing "{0}"...'.format(path)
    with codecs.open(path, encoding='utf-8') as fp:
        return filter(lambda x: x and x[0] != '#', fp.read().splitlines())

# def load_definitions(path):
#    print('Parsing "{0}"...'.format(path))
#    lines = []
#    with open(path, 'rb') as fin:
#        for line in fin:
#            lines.append(line.decode('utf-8'))
#    fin.close()
#    return lines

def parse_edict(path):
    results = []

    for line in load_definitions(path):
        segments = line.split('\t', 1)
        expression = segments[0].strip().lower()

        segments[1] = segments[1].replace('\t', ' ')
        soup = BeautifulSoup(segments[1], 'lxml')


        star = ''
        wordstar = soup.select('.word_header_star')
        if len(wordstar) > 0:
            star = wordstar[0].get_text()

            reading = ''
        phonetic = soup.select('.p1122')
        if len(phonetic) > 0:
            reading = phonetic[0].get_text()

        def_segments = soup.select('.explanation_box')
        defs = []
        for index, dfn in enumerate(filter(None, def_segments)):
            tags = set()
            
            lable = dfn.select('.explanation_label')
            if len(lable) > 0:
                tags = set(map(lambda x: x.lower() + '.' if x.lower() != 'verb' else 'v.',filter(None, re.split(r'[\[\]\s\-]', lable[0].get_text()))))
                tags = tags.intersection(PARSED_TAGS)

            definition = []
            definition = dfn.select('span.text_blue')
            if len(definition) > 0:
                gloss_cn = definition[0].get_text()
                if gloss_cn == "":
                    continue
            else:
                continue

            for span in dfn.select('span'):
                span.extract()
            for a in dfn.select('a'):
                a.extract()

            gloss_en=dfn.decode_contents(formatter = "html")
            gloss = '<span class="tran"><span class="pos">' + ' '.join(tags) + '</span><span class="eng_tran">' + gloss_en + '</span><span class="chn_tran">' + gloss_cn + '</span></span>'
            defs.append(gloss)

        result = [expression, reading, star, defs]
        results.append(result)

    indices = {}
    for i, d in enumerate(results):
        for key in d[:1]:
            if key is not None:
                values = indices.get(key, [])
                values.append(i)
                indices[key] = values

    return {'defs': results, 'indices': indices}


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

    if len(args) == 1:
        build_db_json(args[0], options.edict)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
