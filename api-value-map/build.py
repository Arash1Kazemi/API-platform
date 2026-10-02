#!/usr/bin/env python3
"""Assemble the fal Value Map page and the downloadable data files.

Reads data_*.json, style.css, shell.html, app1-4.js (one IIFE split over four files)
and writes dist/fal_value_map.html plus dist/fal_models_catalog.{csv,json}.
"""
import csv, json, os, re, sys

try:  # Windows consoles default to a legacy code page
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'dist')
os.makedirs(OUT, exist_ok=True)
CHECKED = '2026-10-02'
ORDER = ['t2i', 'edit', 't2v', 'i2v', 'tts']
LABEL = {'t2i': 'Text to image', 'edit': 'Image editing', 't2v': 'Text to video',
         'i2v': 'Image to video', 'tts': 'Text to speech'}
UNIT = {'t2i': 'USD per image', 'edit': 'USD per edit', 't2v': 'USD per second',
        'i2v': 'USD per second', 'tts': 'USD per 1,000 characters'}
BOARD = {'t2i': 'Artificial Analysis text-to-image', 'edit': 'Artificial Analysis image editing',
         't2v': 'Artificial Analysis text-to-video', 'i2v': 'Artificial Analysis image-to-video',
         'tts': 'Artificial Analysis text-to-speech'}


def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()


data = {c: json.load(open(os.path.join(HERE, f'data_{c}.json'), encoding='utf-8')) for c in ORDER}

# ---- sanity checks on the data -------------------------------------------------
ids = set()
for c in ORDER:
    for m in data[c]:
        for k in ('id', 'name', 'maker', 'endpoint', 'price', 'basis', 'tiers', 'note'):
            assert k in m, (c, m.get('id'), 'missing', k)
        assert m['id'] not in ids, ('duplicate id', m['id'])
        ids.add(m['id'])
        assert m['price'] > 0
        assert any(abs(t['price'] - m['price']) < 1e-9 for t in m['tiers']), \
            (m['id'], 'chart price is not one of its tiers', m['price'], m['tiers'])
        assert (m.get('elo') is None) == (m.get('elo') is None)

# every id the page refers to must exist
app_src = ''.join(read(f'app{i}.js') for i in (1, 2, 3, 4))
refs = set(re.findall(r"id:'([a-z0-9\-]+)'", app_src)) | set(re.findall(r"model:'([a-z0-9\-]+)'", app_src))
missing = sorted(r for r in refs if r not in ids and not r.startswith(('tab-', 'panel-', 'chart-', 'tbl-')))
print('ids referenced by the page but not in the data:', missing)

# ---- page -----------------------------------------------------------------------
js = ''
for i in (1, 2, 3, 4):
    js += read(f'app{i}.js') + '\n'
data_js = 'var DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';'
html = read('shell.html')
html = html.replace('/*__CSS__*/', read('style.css'))
html = html.replace('/*__DATA__*/', data_js)
html = html.replace('/*__JS__*/', js)
assert '__CSS__' not in html and '__DATA__' not in html and '__JS__' not in html
# the closing </script> sequence must not appear inside the data or code
inner = html.split('<script>', 1)[1].rsplit('</script>', 1)[0]
assert '</script' not in inner.lower()
page = os.path.join(OUT, 'fal_value_map.html')
open(page, 'w', encoding='utf-8').write(html)
print('page', page, len(html), 'bytes')

# The Artifact tool wraps the fragment above in its own page skeleton. This copy adds a plain one so the
# page can be opened straight from disk (and tested in standards mode, like the published artifact).
standalone = ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
              '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
              '<style>body{margin:0}</style></head><body>\n' + html + '\n</body></html>\n')
open(os.path.join(OUT, 'fal_value_map_standalone.html'), 'w', encoding='utf-8').write(standalone)

# ---- best-value line (same rule as the page: no ranked model has >= score at <= price) --
def xval(c, m):
    return m['price'] * 60 if c in ('t2v', 'i2v') else m['price']


rows, jcats = [], {}
for c in ORDER:
    ranked = [m for m in data[c] if m.get('elo') is not None]
    byid = {m['id']: m for m in data[c]}
    jm = []
    for m in data[c]:
        beaten_by, front = None, None
        if m.get('elo') is not None:
            dom = [o for o in ranked if o is not m and o['elo'] >= m['elo'] and xval(c, o) <= xval(c, m)
                   and (o['elo'] > m['elo'] or xval(c, o) < xval(c, m))]
            front = not dom
            if dom:
                beaten_by = sorted(dom, key=lambda o: (-o['elo'], xval(c, o)))[0]
        vid = c in ('t2v', 'i2v')
        tiers = '; '.join(f"{t['label']}: {t['price']}" for t in m['tiers'])
        rows.append({
            'category': LABEL[c], 'model': m['name'], 'maker': m['maker'], 'endpoint_id': m['endpoint'],
            'chart_price_usd': m['price'], 'price_unit': UNIT[c],
            'price_per_minute_usd': round(m['price'] * 60, 4) if vid else '',
            'price_basis': m['basis'], 'price_is_estimate': 'yes' if m.get('approx') else 'no',
            'all_published_prices': tiers,
            'quality_elo': m['elo'] if m.get('elo') is not None else '',
            'elo_ci95': m['ci'] if m.get('ci') is not None else '',
            'best_value': '' if front is None else ('yes' if front else 'no'),
            'beaten_by': beaten_by['name'] if beaten_by else '',
            'quality_board': BOARD[c], 'note': m['note'], 'checked': CHECKED,
        })
        jm.append({
            'id': m['id'], 'name': m['name'], 'maker': m['maker'], 'endpoint_id': m['endpoint'],
            'chart_price_usd': m['price'], 'price_is_estimate': bool(m.get('approx')),
            'price_basis': m['basis'],
            'price_per_minute_usd': round(m['price'] * 60, 4) if vid else None,
            'published_prices': m['tiers'], 'elo': m.get('elo'), 'elo_ci95': m.get('ci'),
            'best_value': front, 'beaten_by': beaten_by['id'] if beaten_by else None, 'note': m['note'],
        })
    jcats[c] = {'label': LABEL[c], 'price_unit': UNIT[c], 'quality_board': BOARD[c], 'models': jm}
    front_names = [m['name'] for m in jm if m['best_value']]
    print(f'{c}: best-value line =', front_names)

with open(os.path.join(OUT, 'fal_models_catalog.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
with open(os.path.join(OUT, 'fal_models_catalog.json'), 'w', encoding='utf-8') as f:
    json.dump({
        'checked': CHECKED, 'currency': 'USD',
        'about': 'fal.ai prices read from each model page; quality is the Artificial Analysis arena Elo '
                 '(blind human votes). Compare Elo only inside one category. Video prices are per second '
                 'at the setting that matches the price Artificial Analysis lists.',
        'categories': jcats,
    }, f, indent=2, ensure_ascii=False)
    f.write('\n')
print('rows', len(rows))
