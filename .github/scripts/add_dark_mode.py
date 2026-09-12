from pathlib import Path

app_path=Path('src/App.jsx')
css_path=Path('src/styles.css')
app=app_path.read_text()
css=css_path.read_text()

def replace_once(text, old, new, label):
    if new in text:
        print(f'Already applied: {label}')
        return text
    if old not in text:
        raise SystemExit(f'Could not find block: {label}')
    return text.replace(old,new,1)

app=replace_once(
    app,
    "import { Barcode, Bell, Boxes, CalendarDays, ClipboardList, Eye, EyeOff, LogOut, Minus, Plus, Search, Settings, Trash2, X } from 'lucide-react'",
    "import { Barcode, Bell, Boxes, CalendarDays, ClipboardList, Eye, EyeOff, LogOut, Minus, Moon, Plus, Search, Settings, Sun, Trash2, X } from 'lucide-react'",
    'icons'
)

app=replace_once(
    app,
    "  const [showSplash,setShowSplash]=useState(true)\n",
    """  const [showSplash,setShowSplash]=useState(true)
  const [darkMode,setDarkMode]=useState(()=>{
    const saved=localStorage.getItem('okan-sah-theme')
    if(saved) return saved==='dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false
  })
""",
    'dark state'
)

marker="""const swipeStartY=useRef(null)
  useEffect(()=>{
"""
insert="""const swipeStartY=useRef(null)
  useEffect(()=>{
    document.documentElement.classList.toggle('dark',darkMode)
    localStorage.setItem('okan-sah-theme',darkMode ? 'dark' : 'light')

    const themeMeta=document.querySelector('meta[name=\"theme-color\"]')
    if(themeMeta){
      themeMeta.setAttribute('content',darkMode ? '#080d18' : '#f8fafc')
    }
  },[darkMode])

  useEffect(()=>{
"""
app=replace_once(app,marker,insert,'theme effect')

app=replace_once(
    app,
    "      background:'#ffffff',\ncolor:'#0f172a',",
    "      background:darkMode ? '#080d18' : '#ffffff',\ncolor:darkMode ? '#f8fafc' : '#0f172a',",
    'splash theme'
)

settings_marker="""      {tab==='settings' && <>
        <div className=\"card\">
  <h3>Telefon bildirimleri</h3>
"""
settings_new="""      {tab==='settings' && <>
        <div className=\"card themeSetting\">
          <div className=\"themeSettingText\">
            <h3>Görünüm</h3>
            <p>{darkMode ? 'Gece modu açık.' : 'Gündüz modu açık.'} Seçimin bu cihazda hatırlanır.</p>
          </div>

          <button
            type=\"button\"
            className={`themeToggle ${darkMode ? 'on' : ''}`}
            onClick={()=>setDarkMode(v=>!v)}
            aria-pressed={darkMode}
            aria-label={darkMode ? 'Gece modunu kapat' : 'Gece modunu aç'}
          >
            {darkMode ? <Moon size={18}/> : <Sun size={18}/>}
            <span>{darkMode ? 'Gece Modu' : 'Gündüz Modu'}</span>
            <span className=\"themeSwitchTrack\" aria-hidden=\"true\">
              <span className=\"themeSwitchKnob\" />
            </span>
          </button>
        </div>

        <div className=\"card\">
  <h3>Telefon bildirimleri</h3>
"""
app=replace_once(app,settings_marker,settings_new,'settings appearance card')

branch_nav_marker="""  <button
    className={tab==='expiry' ? 'active' : ''}
    onClick={()=>setTab('expiry')}
  >
    <CalendarDays size={22}/>
    <span>SKT</span>
  </button>
</nav>
"""
branch_nav_new="""  <button
    className={tab==='expiry' ? 'active' : ''}
    onClick={()=>setTab('expiry')}
  >
    <CalendarDays size={22}/>
    <span>SKT</span>
  </button>

  <button
    className={tab==='settings' ? 'active' : ''}
    onClick={()=>setTab('settings')}
  >
    <Settings size={22}/>
    <span>Ayarlar</span>
  </button>
</nav>
"""
app=replace_once(app,branch_nav_marker,branch_nav_new,'branch settings nav')

css_add=r'''

/* Gece modu */
.themeSetting{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:18px;
}
.themeSettingText{min-width:0;flex:1}
.themeSettingText h3{margin-bottom:6px}
.themeSettingText p{margin:0}
.themeToggle{
  flex:0 0 auto;
  display:flex !important;
  align-items:center !important;
  gap:9px !important;
  min-height:46px;
  padding:8px 10px 8px 12px !important;
  border:1px solid #cbd5e1 !important;
  border-radius:14px !important;
  background:#fff !important;
  color:#0f172a !important;
  font-weight:750 !important;
  white-space:nowrap;
}
.themeSwitchTrack{
  position:relative;
  width:42px;
  height:24px;
  border-radius:999px;
  background:#cbd5e1;
  transition:background .2s ease;
}
.themeSwitchKnob{
  position:absolute;
  top:3px;
  left:3px;
  width:18px;
  height:18px;
  border-radius:50%;
  background:white;
  box-shadow:0 1px 4px #0003;
  transition:transform .2s ease;
}
.themeToggle.on .themeSwitchTrack{background:#2563eb}
.themeToggle.on .themeSwitchKnob{transform:translateX(18px)}

html.dark{
  color-scheme:dark;
  background:#080d18;
}
html.dark body,
html.dark .app,
html.dark .login{
  background:#080d18;
  color:#f8fafc;
}
html.dark header{
  background:rgba(8,13,24,.92);
  border-bottom-color:#263244;
}
html.dark header b,
html.dark .topBrand b,
html.dark .sectionTitle h1,
html.dark .sectionTitle h2,
html.dark h1,
html.dark h2,
html.dark h3,
html.dark h4{
  color:#f8fafc;
}
html.dark header small,
html.dark .topBrand small,
html.dark .card p,
html.dark .brand p,
html.dark .batchRow small,
html.dark .productRow small,
html.dark .manageBatch small,
html.dark .stat span{
  color:#94a3b8;
}
html.dark .card,
html.dark .stat,
html.dark .batchRow,
html.dark .productRow,
html.dark .manageBatch,
html.dark .search,
html.dark .addBatch,
html.dark .closeModal{
  background:#111827;
  border-color:#263244;
  color:#f8fafc;
}
html.dark .batchRow b,
html.dark .productRow b,
html.dark .manageBatch b{
  color:#f8fafc;
}
html.dark .modal{
  background:#0b1220;
  color:#f8fafc;
}
html.dark input,
html.dark select,
html.dark textarea{
  background:#0b1220;
  border-color:#334155;
  color:#f8fafc;
}
html.dark input::placeholder,
html.dark textarea::placeholder{color:#64748b}
html.dark label{color:#cbd5e1}
html.dark .search input{background:transparent}
html.dark .secondary{
  background:#172033;
  color:#e2e8f0;
  border-color:#334155;
}
html.dark button:not(.icon,.link,.productRow,.scanmini,.close,.closeModal,nav button,.secondary,.dangerBtn,.deleteProduct,.themeToggle){
  background:#2563eb;
  color:white;
}
html.dark .hero{
  background:#111827;
  border:1px solid #263244;
}
html.dark .hero button{
  background:#e2e8f0 !important;
  color:#0f172a !important;
}
html.dark nav{
  background:rgba(8,13,24,.96);
  border-top-color:#263244;
}
html.dark nav button{color:#64748b}
html.dark nav button.active{color:#f8fafc}
html.dark .link{color:#93c5fd}
html.dark .empty{
  background:#111827;
  border-color:#334155;
  color:#64748b;
}
html.dark .pill{background:#263244;color:#cbd5e1}
html.dark .pill.orange{background:#422006;color:#fdba74}
html.dark .pill.red{background:#450a0a;color:#fca5a5}
html.dark .dangerBtn{background:#450a0a;color:#fca5a5}
html.dark .deleteProduct{background:#2b0b14;color:#fda4af;border-color:#4c1722}
html.dark .toast{background:#e2e8f0;color:#0f172a}
html.dark hr{border-top-color:#263244}
html.dark .themeToggle{
  background:#172033 !important;
  color:#f8fafc !important;
  border-color:#334155 !important;
}
html.dark .themeSwitchTrack{background:#2563eb}
html.dark .topBrand img{background:#172033}

@media(max-width:520px){
  .themeSetting{
    align-items:stretch;
    flex-direction:column;
  }
  .themeToggle{
    width:100%;
    justify-content:space-between !important;
  }
}
'''

if '/* Gece modu */' not in css:
    css += css_add
else:
    print('Already applied: dark css')

app_path.write_text(app)
css_path.write_text(css)
print('Dark mode patch complete')
