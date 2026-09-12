from pathlib import Path

path = Path('src/App.jsx')
text = path.read_text(encoding='utf-8')
old = "themeMeta.setAttribute('content',darkMode ? '#080d18' : '#f8fafc')"
new = "themeMeta.setAttribute('content',darkMode ? '#080d18' : '#ffffff')"
if old not in text:
    raise SystemExit('theme-color target not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('light splash/status bar color matched to white')
