from pathlib import Path

# App splash: match iOS light status-bar background (#f8fafc). Dark stays unchanged.
app = Path('src/App.jsx')
text = app.read_text(encoding='utf-8')
text = text.replace("themeMeta.setAttribute('content',darkMode ? '#080d18' : '#ffffff')", "themeMeta.setAttribute('content',darkMode ? '#080d18' : '#f8fafc')")
text = text.replace("background:darkMode ? '#080d18' : '#ffffff'", "background:darkMode ? '#080d18' : '#f8fafc'")
app.write_text(text, encoding='utf-8')

# Initial HTML startup screen: use the same exact light color before React mounts.
index = Path('index.html')
html = index.read_text(encoding='utf-8')
html = html.replace('<meta name="theme-color" content="#ffffff" />', '<meta name="theme-color" content="#f8fafc" />')
html = html.replace("""  <title>StokCep</title>\n\n  <style>""", """  <title>StokCep</title>\n\n  <script>\n    (()=>{\n      const saved=localStorage.getItem('okan-sah-theme')\n      const dark=saved ? saved==='dark' : (window.matchMedia?.('(prefers-color-scheme: dark)').matches || false)\n      document.documentElement.classList.toggle('startup-dark',dark)\n      const meta=document.querySelector('meta[name=\"theme-color\"]')\n      if(meta) meta.setAttribute('content',dark ? '#080d18' : '#f8fafc')\n    })()\n  </script>\n\n  <style>""")
html = html.replace("""    html,\n    body {\n      margin: 0;\n      padding: 0;\n      background: #ffffff;\n    }""", """    html,\n    body,\n    #root {\n      margin: 0;\n      padding: 0;\n      background: #f8fafc;\n      min-height: 100%;\n    }""")
html = html.replace("""      background: #0f172a;\n      color: #0f172a;""", """      background: #f8fafc;\n      color: #0f172a;""")
insert = """\n    html.startup-dark,\n    html.startup-dark body,\n    html.startup-dark #root,\n    html.startup-dark #startup {\n      background: #080d18;\n    }\n\n    html.startup-dark #startup {\n      color: #f8fafc;\n    }\n"""
html = html.replace("""    #startup-inner {""", insert + "\n    #startup-inner {")
index.write_text(html, encoding='utf-8')
print('startup light band fix applied')
