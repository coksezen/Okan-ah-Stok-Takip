from pathlib import Path
import re

app_path=Path('src/App.jsx')
css_path=Path('src/styles.css')
app=app_path.read_text(encoding='utf-8')
css=css_path.read_text(encoding='utf-8')

# SKT warning should belong to the home dashboard, not every tab.
app=app.replace("   {expiryWarnings.length>0 && (\n  <div className=\"card\">", "   {tab==='home' && expiryWarnings.length>0 && (\n  <div className=\"card homeAlertCard\">", 1)

# Add compact per-branch need counts for notification-style branch cards.
needle="""const dashboard={
  urgent3:batches.filter(b=>daysLeft(b.expiry_date)>=0 && daysLeft(b.expiry_date)<=3).length,
  near10:batches.filter(b=>daysLeft(b.expiry_date)>=0 && daysLeft(b.expiry_date)<=10).length,
  openBoxes:batches.filter(b=>b.status==='open').length,
  depotPending:groupedNeeds.filter(g=>!g.allPickedUp).length,
  deliveryPending:needs.filter(n=>n.picked_up && !n.delivered).length
}
"""
replacement="""const branchNeedCounts=Object.keys(branchLabels).reduce((acc,branch)=>{
  acc[branch]=needs.filter(n=>n.branch===branch && !n.completed).length
  return acc
},{})
const totalPendingNeeds=Object.values(branchNeedCounts).reduce((sum,count)=>sum+count,0)
const branchesWithNeeds=Object.values(branchNeedCounts).filter(count=>count>0).length

const dashboard={
  urgent3:batches.filter(b=>daysLeft(b.expiry_date)>=0 && daysLeft(b.expiry_date)<=3).length,
  near10:batches.filter(b=>daysLeft(b.expiry_date)>=0 && daysLeft(b.expiry_date)<=10).length,
  expired:batches.filter(b=>daysLeft(b.expiry_date)<0).length,
  openBoxes:batches.filter(b=>b.status==='open').length
}
"""
if needle not in app:
    raise SystemExit('dashboard block not found')
app=app.replace(needle,replacement,1)

# Keep the home stats focused on stock/SKT work.
old_stats="""        <div className=\"stats quickStats\">
          <Stat n={dashboard.urgent3} t=\"3 gün içinde\" danger/>
          <Stat n={dashboard.near10} t=\"10 gün içinde\" warn/>
          <Stat n={dashboard.openBoxes} t=\"Açık kutu\"/>
          <Stat n={dashboard.depotPending} t=\"Depodan alınacak\"/>
          <Stat n={dashboard.deliveryPending} t=\"Teslim bekleyen\"/>
        </div>
"""
new_stats="""        <div className=\"stats quickStats\">
          <Stat n={dashboard.urgent3} t=\"3 gün içinde\" danger/>
          <Stat n={dashboard.near10} t=\"10 gün içinde\" warn/>
          <Stat n={dashboard.expired} t=\"Süresi geçen\" danger/>
          <Stat n={dashboard.openBoxes} t=\"Açık kutu\"/>
        </div>
"""
if old_stats not in app:
    raise SystemExit('home stats block not found')
app=app.replace(old_stats,new_stats,1)

# Remove the detailed depot collection list from the home screen.
pattern=r"\n\s*\{profile\?\.role==='admin' && tab==='home' && \(\n.*?\n\)\}\n\s*\{tab==='needs'"
match=re.search(pattern,app,flags=re.S)
if not match:
    raise SystemExit('home depot list block not found')
app=app[:match.start()]+"\n      {tab==='needs'"+app[match.end():]

# Replace the admin Needs landing page with notification-like branch cards
# and move the depot collection workflow here in a collapsed section.
old_selector=""" {profile?.role==='admin' && !selectedBranch ? <>
    <div className=\"sectionTitle\">
      <h1>İhtiyaçlar</h1>
    </div>

    <div className=\"list\">
      <button className=\"productRow\" onClick={()=>setSelectedBranch('veteriner')}>
        <div>
          <b>Veteriner Fakültesi</b>
          <small>Eksik listesini görüntüle</small>
        </div>
      </button>

      <button className=\"productRow\" onClick={()=>setSelectedBranch('iktisat')}>
        <div>
          <b>İktisat Fakültesi</b>
          <small>Eksik listesini görüntüle</small>
        </div>
      </button>

      <button className=\"productRow\" onClick={()=>setSelectedBranch('suna_uzal')}>
        <div>
          <b>Suna UZAL</b>
          <small>Eksik listesini görüntüle</small>
        </div>
      </button>

      <button className=\"productRow\" onClick={()=>setSelectedBranch('uso')}>
        <div>
          <b>USO</b>
          <small>Eksik listesini görüntüle</small>
        </div>
      </button>
    </div>
  </> : <>
"""
new_selector=""" {profile?.role==='admin' && !selectedBranch ? <>
    <div className=\"sectionTitle\">
      <h1>İhtiyaçlar</h1>
    </div>

    <div className={`needsOverview ${totalPendingNeeds ? 'hasNeeds' : ''}`}>
      <div>
        <b>{totalPendingNeeds ? `${branchesWithNeeds} kantinde ihtiyaç var` : 'Şu an bekleyen ihtiyaç yok'}</b>
        <small>
          {totalPendingNeeds
            ? `Toplam ${totalPendingNeeds} kalem bekliyor.`
            : 'Yeni ihtiyaç geldiğinde burada bildirim olarak görünecek.'}
        </small>
      </div>
      {totalPendingNeeds>0 && <span className=\"needsOverviewCount\">{totalPendingNeeds}</span>}
    </div>

    <div className=\"list branchNeedList\">
      {Object.entries(branchLabels).map(([branch,label])=>{
        const count=branchNeedCounts[branch] || 0
        return (
          <button
            key={branch}
            className={`productRow needBranchRow ${count ? 'hasNeeds' : ''}`}
            onClick={()=>setSelectedBranch(branch)}
          >
            <div>
              <b>{label}</b>
              <small>{count ? `${count} bekleyen ihtiyaç` : 'Şu an ihtiyaç yok'}</small>
            </div>
            <span className={`needStatusBadge ${count ? 'active' : ''}`}>
              {count ? 'İhtiyaç var' : 'Boş'}
            </span>
          </button>
        )
      })}
    </div>

    {groupedNeeds.length>0 && (
      <details className=\"depotDetails\">
        <summary>
          <span>Depo Toplama Listesi</span>
          <small>{groupedNeeds.length} ürün</small>
        </summary>

        <div className=\"list depotNeedList\">
          {groupedNeeds.map(g=>(
            <div className=\"productRow\" key={g.key}>
              <div>
                <b>{g.item_name}</b>
                <small>Toplam: {g.total} {g.unit}</small>

                {Object.entries(g.branches).map(([branch,qty])=>{
                  const rows=g.branchRows[branch] || []
                  const allDelivered=rows.length>0 && rows.every(r=>r.delivered)

                  return (
                    <div className=\"depotBranchLine\" key={branch}>
                      <small>{branchLabels[branch] || branch}: {qty} {g.unit}</small>
                      {g.allPickedUp && (
                        allDelivered ? (
                          <span className=\"miniDone\">✓ Teslim edildi</span>
                        ) : (
                          <button type=\"button\" className=\"secondary miniAction\" onClick={()=>markNeedDelivered(rows.map(r=>r.id))}>
                            Teslim Ettim
                          </button>
                        )
                      )}
                    </div>
                  )
                })}
              </div>

              {g.allPickedUp ? (
                <button type=\"button\" className=\"secondary\" disabled>✓ Depodan Alındı</button>
              ) : (
                <button type=\"button\" onClick={()=>markGroupPickedUp(g.ids)}>Depodan Aldım</button>
              )}
            </div>
          ))}
        </div>
      </details>
    )}
  </> : <>
"""
if old_selector not in app:
    raise SystemExit('needs selector block not found')
app=app.replace(old_selector,new_selector,1)

# Add a small notification badge to the admin Needs tab.
nav_needle="""        <Icon size={22}/>
        <span>{label}</span>
"""
nav_replacement="""        <Icon size={22}/>
        {id==='needs' && totalPendingNeeds>0 && (
          <span className=\"navNeedBadge\">{totalPendingNeeds>9 ? '9+' : totalPendingNeeds}</span>
        )}
        <span>{label}</span>
"""
if nav_needle not in app:
    raise SystemExit('admin nav icon block not found')
app=app.replace(nav_needle,nav_replacement,1)

css_add=r'''

/* Home + needs dashboard cleanup */
.homeAlertCard{
  max-width:780px;
  margin:12px auto 0;
}
.needsOverview{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  padding:15px 16px;
  margin:0 0 14px;
  border:1px solid #e2e8f0;
  border-radius:16px;
  background:#fff;
}
.needsOverview.hasNeeds{
  border-color:#bfdbfe;
  background:#eff6ff;
}
.needsOverview b{display:block;font-size:16px}
.needsOverview small{display:block;margin-top:4px;color:#64748b}
.needsOverviewCount{
  flex:0 0 auto;
  min-width:36px;
  height:36px;
  padding:0 10px;
  display:grid;
  place-items:center;
  border-radius:999px;
  background:#2563eb;
  color:#fff;
  font-weight:900;
}
.needBranchRow{
  text-align:left !important;
  align-items:center !important;
}
.needBranchRow.hasNeeds{
  border-color:#334155;
  box-shadow:0 0 0 1px #33415522 inset;
}
.needStatusBadge{
  flex:0 0 auto;
  padding:7px 10px;
  border-radius:999px;
  background:#f1f5f9;
  color:#94a3b8;
  font-size:12px;
  font-weight:850;
  white-space:nowrap;
}
.needStatusBadge.active{
  background:#dbeafe;
  color:#1d4ed8;
}
.depotDetails{
  margin-top:18px;
  border:1px solid #e2e8f0;
  border-radius:16px;
  background:#fff;
  overflow:hidden;
}
.depotDetails>summary{
  cursor:pointer;
  list-style:none;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:15px 16px;
  font-weight:850;
}
.depotDetails>summary::-webkit-details-marker{display:none}
.depotDetails>summary small{color:#64748b;font-weight:700}
.depotNeedList{padding:0 12px 12px}
.depotBranchLine{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:5px}
.miniAction{padding:5px 8px !important;min-height:0 !important;font-size:11px !important}
.miniDone{font-size:11px;font-weight:800;color:#16a34a}
nav button{position:relative}
.navNeedBadge{
  position:absolute;
  top:1px;
  left:calc(50% + 7px);
  min-width:18px;
  height:18px;
  padding:0 5px;
  border-radius:999px;
  display:grid;
  place-items:center;
  background:#ef4444;
  color:#fff !important;
  font-size:10px !important;
  line-height:1;
  font-weight:900;
  border:2px solid #fff;
}
html.dark .needsOverview,
html.dark .depotDetails{
  background:#111827;
  border-color:#263244;
}
html.dark .needsOverview.hasNeeds{
  background:#101a2e;
  border-color:#1d4ed8;
}
html.dark .needsOverview small,
html.dark .depotDetails>summary small{color:#94a3b8}
html.dark .needStatusBadge{background:#172033;color:#64748b}
html.dark .needStatusBadge.active{background:#172554;color:#93c5fd}
html.dark .needBranchRow.hasNeeds{border-color:#3b82f6}
html.dark .miniDone{color:#86efac}
html.dark .navNeedBadge{border-color:#080d18}
@media(max-width:820px){
  .homeAlertCard{margin:12px 18px 0}
}
@media(max-width:520px){
  .needBranchRow{min-height:82px}
  .needStatusBadge{font-size:11px;padding:6px 8px}
  .depotNeedList .productRow{align-items:stretch;flex-direction:column}
  .depotNeedList .productRow>button{width:100%}
}
'''

if '/* Home + needs dashboard cleanup */' not in css:
    css += css_add

app_path.write_text(app,encoding='utf-8')
css_path.write_text(css,encoding='utf-8')
print('home and needs UX patch applied')
