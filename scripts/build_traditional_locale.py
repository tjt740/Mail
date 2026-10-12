"""Rebuild bundled Traditional Chinese UI conversion data (no runtime dependency).
Development only: pip install opencc-python-reimplemented==0.1.7
OpenCC dictionary data is Apache-2.0 licensed; see docs/licenses/opencc.txt.
"""
import json
from pathlib import Path
import opencc

root = Path(__file__).resolve().parents[1]
locale = root / 'static/js/i18n.js'
source = locale.read_text()
start, end = '    // BEGIN GENERATED TRADITIONAL DATA', '    // END GENERATED TRADITIONAL DATA'
if start in source:
    source = source[:source.index(start)] + source[source.index(end) + len(end):].lstrip('\n')
corpus = source + (root / 'app.py').read_text()
for folder, pattern in [('templates', '*.html'), ('frontend/src', '*.jsx'), ('static/js', '*.js')]:
    corpus += ''.join(path.read_text() for path in (root / folder).rglob(pattern) if path != locale)
cc = opencc.OpenCC('s2tw')
folder = Path(opencc.__file__).parent / 'dictionary'
characters = {}
for line in (folder / 'STCharacters.txt').read_text().splitlines():
    key = line.split('\t')[0]
    value = cc.convert(key)
    if key != value:
        characters[key] = value
phrases = {}
for line in (folder / 'STPhrases.txt').read_text().splitlines():
    key = line.split('\t')[0]
    if key in corpus:
        value = cc.convert(key)
        plain = ''.join(characters.get(char, char) for char in key)
        if value != plain:
            phrases[key] = value
phrases.update({'获取': '取得', '保存': '儲存', '设置': '設定', '配置': '設定', '加载': '載入',
                '刷新': '重新整理', '文件夹': '資料夾', '服务器': '伺服器', '账号': '帳號',
                '帐号': '帳號', '默认': '預設', '登录': '登入', '注销': '登出', '退出登录': '登出',
                '后台': '後台', '软件': '軟體', '信息': '資訊', '网络': '網路', '用户': '使用者'})
def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
data = f'''{start}
    // OpenCC s2tw data, with UI wording overrides. Regenerate with scripts/build_traditional_locale.py.
    const traditionalCharacters = {encoded(characters)};
    const traditionalPhrases = {encoded(phrases)};
    const traditionalPattern = new RegExp(Object.keys(traditionalPhrases).sort((a, b) => b.length - a.length).join('|') + '|[\\\\u3400-\\\\u9fff]', 'gu');
    function translateTraditional(text) {{
        return text.replace(traditionalPattern, word => traditionalPhrases[word] || traditionalCharacters[word] || word);
    }}
{end}
'''
source = source.replace('    const originalText = new WeakMap();', data + '\n    const originalText = new WeakMap();')
locale.write_text(source)
