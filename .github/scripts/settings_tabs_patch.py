from pathlib import Path

app_path=Path('src/App.jsx')
css_path=Path('src/styles.css')
app=app_path.read_text()
css=css_path.read_text()

# Add settings sub-tab state once.
state_marker="  const [tab,setTab]=useState(new URLSearchParams(location.search).get('tab') || 'home')"
if "const [settingsTab,setSettingsTab]" not in app:
    if state_marker not in app:
        raise SystemExit('settings state marker not found')
    app=app.replace(state_marker, "  const [settingsTab,setSettingsTab]=useState('general')\n"+state_marker, 1)

start=app.find("      {tab==='settings' && <>")
end=app.find("    </main>", start)
if start==-1 or end==-1:
    raise SystemExit('settings block not found')

new_settings=r'''      {tab==='settings' && <>
        <div className="sectionTitle settingsTitle">
          <h1>Ayarlar</h1>
        </div>

        <div className="settingsTabs" role="tablist" aria-label="Ayar bölümleri">
          <button
            type="button"
            className={settingsTab==='general' ? 'active' : ''}
            onClick={()=>setSettingsTab('general')}
          >
            Genel
          </button>

          {profile?.role==='admin' && (
            <button
              type="button"
              className={settingsTab==='users' ? 'active' : ''}
              onClick={()=>setSettingsTab('users')}
            >
              Kullanıcılar
            </button>
          )}

          <button
            type="button"
            className={settingsTab==='account' ? 'active' : ''}
            onClick={()=>setSettingsTab('account')}
          >
            Hesap
          </button>
        </div>

        {settingsTab==='general' && <>
          <div className="card themeSetting">
            <div className="themeSettingText">
              <h3>Görünüm</h3>
              <p>{darkMode ? 'Gece modu açık.' : 'Gündüz modu açık.'} Seçimin bu cihazda hatırlanır.</p>
            </div>

            <button
              type="button"
              className={`themeToggle ${darkMode ? 'on' : ''}`}
              onClick={()=>setDarkMode(v=>!v)}
              aria-pressed={darkMode}
              aria-label={darkMode ? 'Gece modunu kapat' : 'Gece modunu aç'}
            >
              {darkMode ? <Moon size={18}/> : <Sun size={18}/>}
              <span>{darkMode ? 'Gece Modu' : 'Gündüz Modu'}</span>
              <span className="themeSwitchTrack" aria-hidden="true">
                <span className="themeSwitchKnob" />
              </span>
            </button>
          </div>

          <div className="card settingsCard">
            <h3>Bildirimler</h3>
            <p>SKT yaklaşan ürünler için bu telefonda bildirim alabilir ve test bildirimi gönderebilirsin.</p>

            <div className="settingsActions">
              <button onClick={notify}>
                Bildirimleri Aç
              </button>

              <button
                className="secondary"
                onClick={testNotification}
              >
                Test Bildirimi Gönder
              </button>
            </div>
          </div>
        </>}

        {profile?.role==='admin' && settingsTab==='users' && (
          <div className="card userSettingsCard">
            <div className="settingsCardHeader">
              <div>
                <h3>Kullanıcılar</h3>
                <p>Uygulamaya girebilecek e-posta adreslerini ve yetkilerini buradan yönet.</p>
              </div>
            </div>

            <form onSubmit={addAllowedUser} className="userAddForm">
              <label>
                E-posta Adresi
                <input
                  type="email"
                  placeholder="ornek@eposta.com"
                  value={userForm.email}
                  onChange={e=>setUserForm({...userForm,email:e.target.value})}
                  required
                />
              </label>

              <label>
                Yetki / Kantin
                <select
                  value={userForm.role==='admin' ? 'admin' : userForm.branch}
                  onChange={e=>{
                    const value=e.target.value

                    if(value==='admin'){
                      setUserForm({...userForm,role:'admin',branch:''})
                    }else{
                      setUserForm({...userForm,role:'branch',branch:value})
                    }
                  }}
                >
                  <option value="admin">Yönetici</option>
                  <option value="veteriner">Veteriner Fakültesi</option>
                  <option value="iktisat">İktisat Fakültesi</option>
                  <option value="suna_uzal">Suna UZAL</option>
                  <option value="uso">USO</option>
                </select>
              </label>

              <button type="submit">
                E-posta Ekle
              </button>
            </form>

            <div className="settingsDivider" />

            <h3>Yetkili E-postalar</h3>

            <div className="list userAccessList">
              {allowedUsers.map(u=>(
                <div className="userAccessRow" key={u.email}>
                  <div className="userAccessInfo">
                    <b>{u.email}</b>
                    <small>
                      {u.role==='admin'
                        ? 'Yönetici'
                        : u.branch==='veteriner'
                          ? 'Veteriner Fakültesi'
                          : u.branch==='iktisat'
                            ? 'İktisat Fakültesi'
                            : u.branch==='suna_uzal'
                              ? 'Suna UZAL'
                              : u.branch==='uso'
                                ? 'USO'
                                : 'Şube atanmamış'}
                    </small>
                  </div>

                  <div className="userAccessActions">
                    <select
                      value={u.role==='admin' ? 'admin' : (u.branch || '')}
                      onChange={e=>{
                        const value=e.target.value

                        if(value==='admin'){
                          updateAllowedUser(u.email,'admin',null)
                        }else{
                          updateAllowedUser(u.email,'branch',value)
                        }
                      }}
                    >
                      <option value="admin">Yönetici</option>
                      <option value="veteriner">Veteriner Fakültesi</option>
                      <option value="iktisat">İktisat Fakültesi</option>
                      <option value="suna_uzal">Suna UZAL</option>
                      <option value="uso">USO</option>
                    </select>

                    <button
                      type="button"
                      className="secondary"
                      onClick={()=>removeAllowedUser(u.email)}
                    >
                      Erişimi Kaldır
                    </button>
                  </div>
                </div>
              ))}

              {!allowedUsers.length && (
                <Empty text="Henüz yetkili e-posta eklenmedi." />
              )}
            </div>
          </div>
        )}

        {settingsTab==='account' && (
          <div className="card settingsCard">
            <h3>Hesap</h3>
            <p className="accountEmail">{session.user.email}</p>
            <button className="secondary" onClick={signOut}>Çıkış Yap</button>
          </div>
        )}
      </>}
'''

app=app[:start]+new_settings+app[end:]
app_path.write_text(app)

marker='/* Settings sub-tabs */'
if marker not in css:
    css += r'''

/* Settings sub-tabs */
.settingsTitle{margin-bottom:10px}
.settingsTabs{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px;
  padding:5px;
  margin:0 0 14px;
  background:#e9eef5;
  border:1px solid #dde4ed;
  border-radius:15px;
}
.settingsTabs button{
  min-width:0;
  min-height:42px;
  padding:9px 12px !important;
  border-radius:11px !important;
  background:transparent !important;
  color:#64748b !important;
  font-size:14px;
  font-weight:800 !important;
  box-shadow:none;
}
.settingsTabs button.active{
  background:#fff !important;
  color:#0f172a !important;
  box-shadow:0 1px 4px #0f172a14;
}
.settingsCard{margin-top:12px}
.settingsCardHeader h3,.userSettingsCard h3{margin-bottom:6px}
.settingsCardHeader p,.userSettingsCard > p{margin-top:0}
.settingsActions{
  display:flex;
  flex-wrap:wrap;
  gap:9px;
  margin-top:14px;
}
.settingsActions .secondary{margin:0 !important}
.userAddForm{
  display:grid !important;
  grid-template-columns:minmax(0,1.5fr) minmax(180px,1fr) auto;
  align-items:end;
  gap:10px !important;
  margin-top:16px;
}
.userAddForm button{min-height:43px;white-space:nowrap}
.settingsDivider{height:1px;background:#e2e8f0;margin:22px 0}
.userAccessList{margin-top:12px}
.userAccessRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  padding:14px;
  background:#f8fafc;
  border:1px solid #e2e8f0;
  border-radius:14px;
}
.userAccessInfo{min-width:0;flex:1}
.userAccessInfo b{
  display:block;
  overflow-wrap:anywhere;
  font-size:14px;
}
.userAccessInfo small{display:block;color:#64748b;margin-top:4px}
.userAccessActions{
  display:flex;
  align-items:center;
  gap:8px;
  flex:0 0 auto;
}
.userAccessActions select{width:auto;min-width:165px}
.userAccessActions button{white-space:nowrap}
.accountEmail{font-weight:700;overflow-wrap:anywhere;color:#334155 !important}

html.dark .settingsTabs{
  background:#0b1220;
  border-color:#263244;
}
html.dark .settingsTabs button{color:#94a3b8 !important}
html.dark .settingsTabs button.active{
  background:#172033 !important;
  color:#f8fafc !important;
  box-shadow:none;
}
html.dark .settingsDivider{background:#263244}
html.dark .userAccessRow{
  background:#0b1220;
  border-color:#263244;
}
html.dark .userAccessInfo b{color:#f8fafc}
html.dark .userAccessInfo small{color:#94a3b8}
html.dark .accountEmail{color:#cbd5e1 !important}

@media(max-width:620px){
  .settingsTabs{grid-template-columns:repeat(3,minmax(0,1fr))}
  .settingsTabs button{font-size:13px;padding:9px 6px !important}
  .userAddForm{grid-template-columns:1fr}
  .userAccessRow{align-items:stretch;flex-direction:column}
  .userAccessActions{width:100%;display:grid;grid-template-columns:1fr 1fr}
  .userAccessActions select{width:100%;min-width:0}
  .userAccessActions button{width:100%;min-width:0}
  .settingsActions{display:grid;grid-template-columns:1fr}
  .settingsActions button{width:100%}
}
'''
    css_path.write_text(css)
