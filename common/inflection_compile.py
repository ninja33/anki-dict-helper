# -*- coding: utf-8 -*-
#!/usr/bin/env python

# 版权所有 (C) 2016  Huang Zhenyu  <zhenyu.huang@qq.com>
# 作者: Huang Zhenyu  <zhenyu.huang@qq.com>
#
# 本程序为自由软件，在自由软件联盟发布的GNU通用公共许可协议的约束下，
# 你可以对其进行再发布及修改。协议版本为第三版或更新的版本。
#
# 我们希望发布的这款程序有用，但不保证，甚至不保证它有经济价值和适合
# 特定用途。详情参见GNU通用公共许可协议。
#
# 你理当已收到一份GNU通用公共许可协议的副本。如果没有，
# 请查阅<http://www.gnu.org/licenses/>

import codecs
import json
import optparse
import os.path


def load_definitions(path):
    print('Parsing "{0}"...'.format(path))
    with codecs.open(path, encoding='utf-8') as fp:
        return json.loads(fp.read())


def parse_edict(path):
    indices = {}
    inflection = load_definitions(path)
    with codecs.open('new_oxford_2nd.json', encoding='utf-8') as fp:
        collins = json.loads(fp.read())

    defines = []
    for i, item  in enumerate(collins['indices']):
        defines.append(item)

    total = []
    for stem, forms in inflection.iteritems():
        total.append(stem)
        for index, dfn in enumerate(filter(None, forms)):
            values = set(indices.get(dfn.strip(), []))
            values = values.union([stem])
            indices[dfn.strip()] = list(values)

    print "total inflection items : " + str(len(set(total)))
    print "total new oxford 2nd words : " + str(len(set(defines)))
    print "matched:" + str(len(set(defines).intersection(set(total))))
    return indices


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
