"""Build the app from src/ into two pages.

  index.html     web version (GitHub Pages + Supabase)
  artifact.html  Claude artifact version (runs on the Claude runtime)

Usage: python3 build.py            (both)
       python3 build.py web        (one target)
Set CHECK_JS=<path> to also write the concatenated web JS for a syntax check.
"""
import base64, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')

# App name: change here to rename everywhere (title, logo, UI text)
BRAND = {'ko': '찌릿', 'en': 'ZZIRIT'}
TAGLINE = '사진 한 장으로 어종을 찾고, 전 세계 낚시꾼과 겨루는 낚시 리그'

# Web version settings (the publishable key is meant to be public; data is protected by row-level security)
WEB = {
    'site': 'https://kim-jae-ung.github.io/zzirit/',
    'supabase_url': 'https://tnvzckfssjocgtmlxkii.supabase.co',
    'supabase_key': 'sb_publishable_boTFYfsXMus91z3d6JpNvA_ffnrQvXk',
    'supabase_js': 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js',
}

APP_JS = ['i18n.js', 'i18n-more.js', 'fishdb.js', 'fishdraw.js', 'scene.js', 'geo.js', 'map.js', 'core.js', 'flows.js', 'views.js', 'char.js', 'community.js', 'news.js', 'points.js', 'notify.js', 'weather.js', 'badges.js', 'stats.js', 'contest.js', 'push.js', 'boot.js']


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def data_uri(name, mime):
    with open(os.path.join(SRC, name), 'rb') as f:
        return f'data:{mime};base64,' + base64.b64encode(f.read()).decode()


# logo (from the brand image): the mark for headers, the full logo for the brand page — inlined so both builds stay one file
LOGO = {'__LOGO_MARK__': ('logo-mark.webp', 'image/webp'), '__LOGO_FULL__': ('logo-full.webp', 'image/webp')}


def build(target):
    files = list(APP_JS)
    if target == 'web':
        files = ['rt-supabase.js', 'i18n.js', 'i18n-more.js', 'web-texts.js'] + APP_JS[2:]
    js = '\n'.join(read(f) for f in files)
    qr = read('qr.txt').strip().split('|', 1)[1]
    js = js.replace('__QR_PATH__', qr)
    html = read('index.src.html')
    if target == 'web':
        name = f"{BRAND['ko']} {BRAND['en']}"
        meta = '\n'.join([
            '<meta name="theme-color" content="#070C16">',
            '<link rel="manifest" href="manifest.webmanifest">',
            '<link rel="icon" type="image/png" sizes="64x64" href="favicon.png">',
            '<link rel="apple-touch-icon" href="icon-180.png">',
            '<meta name="apple-mobile-web-app-capable" content="yes">',
            f'<meta name="apple-mobile-web-app-title" content="{BRAND["ko"]}">',
            '<meta property="og:type" content="website">',
            f'<meta property="og:title" content="{name}">',
            f'<meta property="og:description" content="{TAGLINE}">',
            f'<meta property="og:url" content="{WEB["site"]}">',
            f'<meta property="og:image" content="{WEB["site"]}og.jpg">',
            '<meta name="twitter:card" content="summary_large_image">',
        ])
        head = '\n'.join([
            f'<script src="{WEB["supabase_js"]}"></script>',
            '<script>window.APP_CFG = ' + json.dumps({'url': WEB['supabase_url'], 'key': WEB['supabase_key']}) + ';</script>',
        ])
        html = html.replace('<!--__WEB_META__-->', meta).replace('<!--__WEB_HEAD__-->', head)
    else:
        html = html.replace('<!--__WEB_META__-->\n', '').replace('<!--__WEB_HEAD__-->\n', '')
    html = html.replace('/*__CSS__*/', read('styles.css')).replace('/*__JS__*/', js)
    html = html.replace('__APP_KO__', BRAND['ko']).replace('__APP_EN__', BRAND['en']).replace('__SITE__', WEB['site'])
    js = js.replace('__APP_KO__', BRAND['ko']).replace('__APP_EN__', BRAND['en']).replace('__SITE__', WEB['site'])
    for key, (fname, mime) in LOGO.items():
        uri = data_uri(fname, mime)
        html = html.replace(key, uri); js = js.replace(key, uri)
    if target == 'web':
        # GitHub Pages serves a full document (the artifact host adds its own wrapper):
        # title, meta, fonts and styles go in <head> so link previews and crawlers can read them
        cut = html.index('<div class="app">')
        head_part, body_part = html[:cut], html[cut:]
        html = ('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
                '<style>[hidden]{display:none!important}body{margin:0}</style>\n'
                + head_part + '</head>\n<body>\n' + body_part + '\n</body>\n</html>\n')
    out = os.path.join(ROOT, 'index.html' if target == 'web' else 'artifact.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    check = os.environ.get('CHECK_JS')
    if check:
        with open(check.replace('.js', f'.{target}.js'), 'w', encoding='utf-8') as f:
            f.write(js)
    print(f'built {os.path.basename(out)} {len(html) // 1024} KB')


if __name__ == '__main__':
    for t in (sys.argv[1:] or ['web', 'artifact']):
        build(t)
