from pathlib import Path

app_path = Path('src/App.jsx')
app = app_path.read_text(encoding='utf-8')

old = """            <small>\n              {b.daysLeft<=3\n                ? `🚨 SKT'ye ${b.daysLeft} gün kaldı`\n                : `⚠️ SKT'ye ${b.daysLeft} gün kaldı`}\n            </small>\n"""
new = """            <small>\n              {daysLeft(b.expiry_date)<=3\n                ? `🚨 SKT'ye ${daysLeft(b.expiry_date)} gün kaldı`\n                : `⚠️ SKT'ye ${daysLeft(b.expiry_date)} gün kaldı`}\n            </small>\n"""

if old not in app:
    raise SystemExit('SKT warning display block not found')
app = app.replace(old, new, 1)
app_path.write_text(app, encoding='utf-8')

sw_path = Path('public/sw.js')
sw = sw_path.read_text(encoding='utf-8')
sw = sw.replace("const CACHE = 'okan-sah-stok-v4'", "const CACHE = 'okan-sah-stok-v5'", 1)
sw_path.write_text(sw, encoding='utf-8')

print('SKT display now uses the exact same daysLeft calculation everywhere')
