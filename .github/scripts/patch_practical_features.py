from pathlib import Path

app_path=Path('src/App.jsx')
css_path=Path('src/styles.css')
text=app_path.read_text()
css=css_path.read_text()

def rep(old,new,label):
    global text
    if old not in text:
        raise SystemExit(f'Could not find block: {label}')
    text=text.replace(old,new,1)

# State + persistence helpers
rep(
"  const [settingsTab,setSettingsTab]=useState('general')\n",
"""  const [settingsTab,setSettingsTab]=useState('general')
  const [recentProducts,setRecentProducts]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('okan-sah-recent-products') || '[]')}catch{return []}
  })
  const [needFavorites,setNeedFavorites]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('okan-sah-need-favorites') || '[]')}catch{return []}
  })
  const [offlineQueue,setOfflineQueue]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('okan-sah-offline-queue') || '[]')}catch{return []}
  })
  const [quickScanAfterSave,setQuickScanAfterSave]=useState(false)
""",
'states')

rep(
"  const videoRef=useRef(null), scannerControls=useRef(null)\n",
"""  const videoRef=useRef(null), scannerControls=useRef(null)
  const syncingOffline=useRef(false)
""",
'offline sync ref')

anchor="""  },[darkMode])

  useEffect(()=>{
  function onTouchStart(e){"""
insert="""  },[darkMode])

  useEffect(()=>{
    localStorage.setItem('okan-sah-recent-products',JSON.stringify(recentProducts))
  },[recentProducts])

  useEffect(()=>{
    localStorage.setItem('okan-sah-need-favorites',JSON.stringify(needFavorites))
  },[needFavorites])

  useEffect(()=>{
    localStorage.setItem('okan-sah-offline-queue',JSON.stringify(offlineQueue))
  },[offlineQueue])

  useEffect(()=>{
    if(!session) return
    const sync=()=>syncOfflineQueue()
    window.addEventListener('online',sync)
    if(navigator.onLine && offlineQueue.length) sync()
    return ()=>window.removeEventListener('online',sync)
  },[session,offlineQueue])

  useEffect(()=>{
  function onTouchStart(e){"""
rep(anchor,insert,'persistence effects')

# Cache data fallback for offline launch
rep(
"""  if(pe||be||ne||pre){
    return flash((pe||be||ne||pre).message)
  }

  setProducts(p||[])
  setBatches(b||[])
  setNeeds(n||[])
  setProfile(pr||null)
""",
"""  if(pe||be||ne||pre){
    try{
      const cached=JSON.parse(localStorage.getItem('okan-sah-data-cache') || 'null')
      if(cached){
        setProducts(cached.products || [])
        setBatches(cached.batches || [])
        setNeeds(cached.needs || [])
        setProfile(cached.profile || null)
        flash('Çevrimdışısın. Son kayıtlı veriler gösteriliyor.')
        return
      }
    }catch{}
    return flash((pe||be||ne||pre).message)
  }

  setProducts(p||[])
  setBatches(b||[])
  setNeeds(n||[])
  setProfile(pr||null)
  localStorage.setItem('okan-sah-data-cache',JSON.stringify({
    products:p||[],
    batches:b||[],
    needs:n||[],
    profile:pr||null
  }))
""",
'load data cache')

# Offline queue / recent / favorites helpers
rep(
"""async function addAllowedUser(e){""",
"""function addOfflineAction(type,payload){
  const action={
    id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    payload,
    created_at:new Date().toISOString()
  }
  setOfflineQueue(prev=>[...prev,action])
  return action
}

async function syncOfflineQueue(){
  if(syncingOffline.current || !navigator.onLine || !session || !offlineQueue.length) return
  syncingOffline.current=true

  let remaining=[...offlineQueue]
  let completed=0

  try{
    for(const action of offlineQueue){
      let error=null

      if(action.type==='addNeed'){
        const result=await supabase.from('branch_needs').insert(action.payload)
        error=result.error
      }else if(action.type==='addBatch'){
        const result=await supabase.from('batches').insert(action.payload)
        error=result.error
      }

      if(error) break

      remaining=remaining.filter(x=>x.id!==action.id)
      completed++
    }

    if(completed){
      setOfflineQueue(remaining)
      await loadData()
      flash(`${completed} çevrimdışı işlem senkronlandı.`)
    }
  }finally{
    syncingOffline.current=false
  }
}

function rememberRecentProduct(p){
  if(!p?.id) return
  setRecentProducts(prev=>[p.id,...prev.filter(id=>id!==p.id)].slice(0,8))
}

function toggleNeedFavorite(){
  const name=needForm.item_name.trim()
  const unit=needForm.unit.trim() || 'adet'
  if(!name) return flash('Önce ürün adı yazmalısın.')

  const key=name.toLocaleLowerCase('tr-TR')+'__'+unit.toLocaleLowerCase('tr-TR')
  const exists=needFavorites.some(f=>f.key===key)

  if(exists){
    setNeedFavorites(prev=>prev.filter(f=>f.key!==key))
    flash('Sık kullanılanlardan çıkarıldı.')
  }else{
    setNeedFavorites(prev=>[{key,name,unit},...prev].slice(0,16))
    flash('Sık kullanılanlara eklendi.')
  }
}

function useNeedFavorite(f){
  setNeedForm(prev=>({...prev,item_name:f.name,unit:f.unit || 'adet'}))
}

async function addAllowedUser(e){""",
'helper functions')

# Offline-friendly needs
old_addneed=text[text.find('async function addNeed(e){'):text.find('  async function partialNeed', text.find('async function addNeed(e){'))]
new_addneed="""async function addNeed(e){
  e.preventDefault()

  if(!selectedBranch) return
  if(!needForm.item_name.trim()) return flash('Ürün adı yazmalısın.')
  if(!needForm.quantity || Number(needForm.quantity) <= 0){
    return flash('Adet 1 veya daha fazla olmalı.')
  }

  const payload={
    branch:selectedBranch,
    item_name:needForm.item_name.trim(),
    quantity:Number(needForm.quantity),
    unit:needForm.unit.trim() || 'adet',
    note:needForm.note || null
  }

  if(!navigator.onLine){
    addOfflineAction('addNeed',payload)
    setNeeds(prev=>[{
      id:`offline-${Date.now()}`,
      ...payload,
      created_at:new Date().toISOString(),
      picked_up:false,
      delivered:false,
      completed:false
    },...prev])
    setNeedForm({item_name:'',quantity:1,unit:'adet',note:''})
    return flash('İnternet yok. İhtiyaç kaydedildi; bağlantı gelince gönderilecek.')
  }

  const {error}=await supabase
    .from('branch_needs')
    .insert(payload)

  if(error) return flash(error.message)

  setNeedForm({item_name:'',quantity:1,unit:'adet',note:''})
  flash('İhtiyaç eklendi.')
  loadData()
}
"""
if not old_addneed.startswith('async function addNeed(e){'):
    raise SystemExit('Could not locate addNeed')
text=text.replace(old_addneed,new_addneed,1)

# Product opening can be quick mode
rep(
"""  function openProduct(p){
    if(profile?.role==='admin' && !productBranch){""",
"""  function openProduct(p,quick=false){
    setQuickScanAfterSave(Boolean(quick))
    if(profile?.role==='admin' && !productBranch){""",
'openProduct signature')

# Replace addBatch with offline + quick loop
start=text.find(' async function addBatch(e){')
end=text.find('  async function changeQty',start)
if start==-1 or end==-1: raise SystemExit('Could not locate addBatch')
new_addbatch=""" async function addBatch(e){
  e.preventDefault()

  if(!batchForm.expiry_date)
    return flash('Son kullanma tarihi gerekli.')

  const branch =
    profile?.role === 'branch'
      ? profile.branch
      : productBranch

  if(!branch)
    return flash('Şube belirlenemedi.')

  const isBox=Number(productForm.box_size)>1
  let payload

  if(isBox){
    const boxCount=Math.max(1,Number(batchForm.box_count || 1))
    payload=Array.from({length:boxCount},()=>({
      product_id:productForm.id,
      branch,
      expiry_date:batchForm.expiry_date,
      quantity:Number(productForm.box_size || 1),
      box_count:1,
      status:'closed'
    }))
  }else{
    payload={
      product_id:productForm.id,
      branch,
      expiry_date:batchForm.expiry_date,
      quantity:Number(batchForm.quantity),
      box_count:1,
      status:'closed'
    }
  }

  if(!navigator.onLine){
    addOfflineAction('addBatch',payload)
    const optimistic=(Array.isArray(payload) ? payload : [payload]).map((row,i)=>({
      id:`offline-batch-${Date.now()}-${i}`,
      ...row,
      products:{
        name:productForm.name,
        barcode:productForm.barcode,
        unit:productForm.unit,
        box_size:productForm.box_size
      }
    }))
    setBatches(prev=>[...prev,...optimistic])
    setBatchForm(emptyBatch)
    flash('İnternet yok. Parti kaydedildi; bağlantı gelince gönderilecek.')

    if(quickScanAfterSave){
      setModal(null)
      setTimeout(()=>startScanner('quick'),250)
    }
    return
  }

  const {error}=await supabase
    .from('batches')
    .insert(payload)

  if(error) return flash(error.message)

  const boxCount=Array.isArray(payload) ? payload.length : 1
  setBatchForm(emptyBatch)
  await loadData()
  flash(isBox ? `${boxCount} kutu eklendi.` : 'Parti eklendi.')

  if(quickScanAfterSave){
    setModal(null)
    setTimeout(()=>startScanner('quick'),250)
  }
}
"""
text=text[:start]+new_addbatch+text[end:]

# Barcode logic with quick flow + recent scans
start=text.find(' function handleBarcode(code,mode){')
end=text.find('  async function notify()',start)
if start==-1 or end==-1: raise SystemExit('Could not locate handleBarcode')
new_handle=""" function handleBarcode(code,mode){
  const p=products.find(x=>x.barcode===code)

  if(mode==='quick'){
    if(p){
      rememberRecentProduct(p)
      openProduct(p,true)
    }else{
      setQuickScanAfterSave(false)
      flash('Bu barkod ilk kez görülüyor. Ürünü bir kez tanımlaman gerekiyor.')
      openNew(code)
    }
    return
  }

  if(mode==='new'){
    if(p){
      rememberRecentProduct(p)
      openProduct(p)
    }else{
      openNew(code)
    }
    return
  }

  if(p){
    rememberRecentProduct(p)
    openProduct(p)
  }else if(confirm('Bu barkod kayıtlı değil. Yeni ürün olarak eklemek ister misin?')){
    openNew(code)
  }
}
"""
text=text[:start]+new_handle+text[end:]

# Derived suggestions + recent + dashboard values
rep(
"""  const filtered=products.filter(p=>(p.name+' '+(p.barcode||'')+' '+(p.category||'')).toLowerCase().includes(query.toLowerCase()))

  function openNew""",
"""  const filtered=products.filter(p=>(p.name+' '+(p.barcode||'')+' '+(p.category||'')).toLowerCase().includes(query.toLowerCase()))
  const recentProductRows=recentProducts.map(id=>products.find(p=>p.id===id)).filter(Boolean)
  const needSuggestions=[...new Set([
    ...needFavorites.map(f=>f.name),
    ...products.map(p=>p.name),
    ...needs.map(n=>n.item_name)
  ].filter(Boolean))]
    .filter(name=>{
      const q=needForm.item_name.trim().toLocaleLowerCase('tr-TR')
      return q && name.toLocaleLowerCase('tr-TR').includes(q) && name.toLocaleLowerCase('tr-TR')!==q
    })
    .slice(0,6)

  function openNew""",
'derived recent suggestions')

# Insert dashboard counts after groupedNeeds
needle=""".filter(g=>
  Object.values(g.branchRows).some(rows=>
    rows.some(r=>!r.delivered)
  )
)
  return <div className=\"app\">"""
replacement=""".filter(g=>
  Object.values(g.branchRows).some(rows=>
    rows.some(r=>!r.delivered)
  )
)

const dashboard={
  urgent3:batches.filter(b=>daysLeft(b.expiry_date)>=0 && daysLeft(b.expiry_date)<=3).length,
  near10:batches.filter(b=>daysLeft(b.expiry_date)>=0 && daysLeft(b.expiry_date)<=10).length,
  openBoxes:batches.filter(b=>b.status==='open').length,
  depotPending:groupedNeeds.filter(g=>!g.allPickedUp).length,
  deliveryPending:needs.filter(n=>n.picked_up && !n.delivered).length
}
  return <div className=\"app\">"""
rep(needle,replacement,'dashboard counts')

# Offline banner before main
rep(
"""    <main>
      {tab==='home' && <>""",
"""    {offlineQueue.length>0 && (
      <div className=\"offlineBanner\">
        <b>Çevrimdışı kayıtlar bekliyor</b>
        <span>{offlineQueue.length} işlem bağlantı gelince otomatik gönderilecek.</span>
      </div>
    )}
    <main>
      {tab==='home' && <>""",
'offline banner')

# Home dashboard and quick intake + recents
old_home="""        <section className=\"hero\"><h1>Stokların kontrol altında.</h1><p>Barkod okut, ürün ekle ve SKT yaklaşanları tek ekrandan gör.</p><button onClick={()=>startScanner('find')}><Barcode size={20}/> Barkod okut</button></section>
        <div className=\"stats\"><Stat n={totals.qty} t=\"Toplam adet\"/><Stat n={totals.near} t=\"10 gün içinde\" warn/><Stat n={totals.expired} t=\"Süresi geçen\" danger/></div>
        <div className=\"sectionTitle\"><h2>Yaklaşan tarihler</h2><button className=\"link\" onClick={()=>setTab('expiry')}>Tümünü gör</button></div>
        <div className=\"list\">{expiryList.slice(0,5).map(b=><BatchRow key={b.id} b={b}/>)}{!expiryList.length&&<Empty text=\"Henüz parti kaydı yok.\"/>}</div>"""
new_home="""        <section className=\"hero\">
          <h1>Stokların kontrol altında.</h1>
          <p>Mal kabulünde hızlı giriş kullan; barkodu okutunca doğrudan SKT ekranı açılsın.</p>
          <div className=\"heroActions\">
            <button onClick={()=>startScanner('quick')}><Barcode size={20}/> Hızlı Mal Girişi</button>
            <button className=\"heroSecondary\" onClick={()=>startScanner('find')}><Search size={19}/> Barkod Ara</button>
          </div>
        </section>

        <div className=\"stats quickStats\">
          <Stat n={dashboard.urgent3} t=\"3 gün içinde\" danger/>
          <Stat n={dashboard.near10} t=\"10 gün içinde\" warn/>
          <Stat n={dashboard.openBoxes} t=\"Açık kutu\"/>
          <Stat n={dashboard.depotPending} t=\"Depodan alınacak\"/>
          <Stat n={dashboard.deliveryPending} t=\"Teslim bekleyen\"/>
        </div>

        {recentProductRows.length>0 && <>
          <div className=\"sectionTitle\"><h2>Son Okutulanlar</h2></div>
          <div className=\"recentGrid\">
            {recentProductRows.slice(0,6).map(p=>(
              <button key={p.id} className=\"recentItem\" onClick={()=>openProduct(p)}>
                <b>{p.name}</b>
                <small>{p.barcode || 'Barkod yok'}</small>
              </button>
            ))}
          </div>
        </>}

        <div className=\"sectionTitle\"><h2>Yaklaşan tarihler</h2><button className=\"link\" onClick={()=>setTab('expiry')}>Tümünü gör</button></div>
        <div className=\"list\">{expiryList.slice(0,5).map(b=><BatchRow key={b.id} b={b}/>)}{!expiryList.length&&<Empty text=\"Henüz parti kaydı yok.\"/>}</div>"""
rep(old_home,new_home,'home dashboard')

# Add quick scan button on products page
rep(
"""      <button onClick={()=>openNew()}>
        <Plus size={18}/> Ürün Ekle
      </button>

      <div className=\"search\">""",
"""      <div className=\"productTopActions\">
        <button onClick={()=>startScanner('quick')}>
          <Barcode size={18}/> Hızlı Mal Girişi
        </button>
        <button className=\"secondary\" onClick={()=>openNew()}>
          <Plus size={18}/> Yeni Ürün
        </button>
      </div>

      <div className=\"search\">""",
'products quick actions')

# Needs favorites UI
rep(
"""    <div className=\"card\">
  <h3>İhtiyaç Ekle</h3>

  <form onSubmit={addNeed}>""",
"""    <div className=\"card\">
  <h3>İhtiyaç Ekle</h3>

  {needFavorites.length>0 && (
    <div className=\"needFavorites\">
      <small>Sık kullanılanlar</small>
      <div className=\"favoriteChips\">
        {needFavorites.map(f=>(
          <button key={f.key} type=\"button\" className=\"favoriteChip\" onClick={()=>useNeedFavorite(f)}>
            ★ {f.name}
          </button>
        ))}
      </div>
    </div>
  )}

  <form onSubmit={addNeed}>""",
'favorites section')

rep(
"""   <input
  type=\"text\"
  placeholder=\"Ürün adı\"
  value={needForm.item_name}
  onChange={e=>setNeedForm({...needForm,item_name:e.target.value})}
  required
/>

<input""",
"""   <div className=\"needNameField\">
    <input
      type=\"text\"
      placeholder=\"Ürün adı\"
      value={needForm.item_name}
      onChange={e=>setNeedForm({...needForm,item_name:e.target.value})}
      autoComplete=\"off\"
      required
    />

    {needSuggestions.length>0 && (
      <div className=\"needSuggestions\">
        {needSuggestions.map(name=>(
          <button
            type=\"button\"
            key={name}
            onClick={()=>setNeedForm({...needForm,item_name:name})}
          >
            {name}
          </button>
        ))}
      </div>
    )}
   </div>

<input""",
'need autocomplete')

rep(
"""    <button type=\"submit\">
      İhtiyaç Ekle
    </button>
  </form>""",
"""    <div className=\"needFormActions\">
      <button type=\"submit\">
        İhtiyaç Ekle
      </button>
      <button type=\"button\" className=\"secondary\" onClick={toggleNeedFavorite}>
        {needFavorites.some(f=>f.key===needForm.item_name.trim().toLocaleLowerCase('tr-TR')+'__'+(needForm.unit.trim()||'adet').toLocaleLowerCase('tr-TR'))
          ? '★ Sık Kullanılandan Çıkar'
          : '☆ Sık Kullanılana Ekle'}
      </button>
    </div>
  </form>""",
'favorite toggle')

# Pass quick mode into ProductDetail
rep(
"""batch={batchForm} setBatch={setBatchForm} update={updateProduct} addBatch={addBatch} changeQty={changeQty} openBatch={openBatch} deleteBatch={deleteBatch} deleteProduct={deleteProduct}/>} """,
"""batch={batchForm} setBatch={setBatchForm} update={updateProduct} addBatch={addBatch} changeQty={changeQty} openBatch={openBatch} deleteBatch={deleteBatch} deleteProduct={deleteProduct} quickMode={quickScanAfterSave}/>} """,
'ProductDetail quick prop')

# Replace ProductDetail (last function) with grouped SKT UI
start=text.find('function ProductDetail({')
if start==-1: raise SystemExit('Could not find ProductDetail')
new_component=r'''function ProductDetail({
  product,
  setProduct,
  batches,
  batch,
  setBatch,
  update,
  addBatch,
  openBatch,
  deleteBatch,
  deleteProduct,
  quickMode
}){
  const isBox=Number(product.box_size)>1
  const sortedBatches=[...batches].sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date))
  const groupedBatches=Object.values(sortedBatches.reduce((acc,b)=>{
    const key=b.expiry_date || 'tarihsiz'
    if(!acc[key]) acc[key]={key,expiry_date:b.expiry_date,rows:[]}
    acc[key].rows.push(b)
    return acc
  },{})).map(g=>({
    ...g,
    openRows:g.rows.filter(r=>r.status==='open'),
    closedRows:g.rows.filter(r=>r.status!=='open'),
    totalQty:g.rows.reduce((sum,r)=>sum+Number(r.quantity||0),0)
  }))

  const earliestClosedExpiry=isBox
    ? groupedBatches.find(g=>g.closedRows.length)?.expiry_date
    : null

  return (
    <div>
      <div className="productDetailHeader">
        <div>
          <h2>{product.name}</h2>
          <p>{product.barcode || 'Barkod yok'}</p>
        </div>
        {quickMode && <span className="quickModeBadge">Hızlı Giriş</span>}
      </div>

      <h3>SKT / Partiler</h3>

      <div className="list compact batchGroups">
        {isBox ? groupedBatches.map(g=>{
          const isFirst=g.expiry_date===earliestClosedExpiry && g.closedRows.length>0
          const finishRow=g.openRows[0] || g.closedRows[0]

          return (
            <div className={`batchGroup ${isFirst ? 'firstToOpen' : ''}`} key={g.key}>
              <div className="batchGroupInfo">
                <div className="batchGroupTitle">
                  <b>{fmt(g.expiry_date)}</b>
                  {isFirst && <span className="firstOpenBadge">ÖNCE BUNU AÇ</span>}
                </div>
                <small>
                  {g.rows.length} kutu · {g.openRows.length} açık · {g.closedRows.length} kapalı
                </small>
              </div>

              <div className="batchGroupActions">
                {g.closedRows.length>0 && (
                  <button type="button" className="secondary" onClick={()=>openBatch(g.closedRows[0])}>
                    Kutu Aç
                  </button>
                )}
                {finishRow && (
                  <button type="button" className="dangerBtn" onClick={()=>deleteBatch(finishRow.id)}>
                    1 Kutu Bitti
                  </button>
                )}
              </div>
            </div>
          )
        }) : sortedBatches.map(b=>(
          <div className="manageBatch" key={b.id}>
            <div>
              <b>{fmt(b.expiry_date)}</b>
              <small>{b.quantity} adet</small>
            </div>
            <div className="qty">
              <button type="button" className="dangerBtn" onClick={()=>deleteBatch(b.id)}>
                Bitti
              </button>
            </div>
          </div>
        ))}

        {!sortedBatches.length && <Empty text="Bu üründe aktif parti yok."/>}
      </div>

      <form onSubmit={addBatch} className="addBatch quickBatchForm">
        <h3>+ Yeni Parti Ekle</h3>

        {isBox ? (
          <label>
            Kaç Kutu Geldi?
            <input
              type="number"
              min="1"
              required
              value={batch.box_count || 1}
              onChange={e=>setBatch({...batch,box_count:e.target.value})}
            />
          </label>
        ) : (
          <label>
            Adet
            <input
              type="number"
              min="1"
              required
              value={batch.quantity}
              onChange={e=>setBatch({...batch,quantity:e.target.value})}
            />
          </label>
        )}

        <label>
          Son Kullanma Tarihi
          <input
            type="date"
            required
            value={batch.expiry_date}
            onChange={e=>setBatch({...batch,expiry_date:e.target.value})}
          />
        </label>

        <button>{quickMode ? 'Kaydet ve Sonraki Barkodu Okut' : 'Partiyi Ekle'}</button>
      </form>

      <details style={{marginTop:'18px'}}>
        <summary style={{cursor:'pointer',fontWeight:700}}>Ürün bilgilerini düzenle</summary>

        <form onSubmit={update} style={{marginTop:'12px'}}>
          <label>
            Ürün Adı
            <input value={product.name || ''} onChange={e=>setProduct({...product,name:e.target.value})} required />
          </label>

          <label>
            Barkod
            <input value={product.barcode || ''} onChange={e=>setProduct({...product,barcode:e.target.value})} />
          </label>

          <label>
            Not
            <input value={product.notes || ''} onChange={e=>setProduct({...product,notes:e.target.value})} />
          </label>

          {isBox && (
            <label>
              1 Kutuda Kaç Adet?
              <input
                type="number"
                min="1"
                value={product.box_size || 1}
                onChange={e=>setProduct({...product,box_size:Number(e.target.value)})}
              />
            </label>
          )}

          <button>Ürün Bilgilerini Kaydet</button>
        </form>
      </details>

      <button className="deleteProduct" onClick={()=>deleteProduct(product.id)}>
        <Trash2 size={18}/> Ürünü Sil
      </button>
    </div>
  )
}
'''
text=text[:start]+new_component

# CSS additions
css += r'''

/* Practical workflow improvements */
.heroActions{display:flex;flex-wrap:wrap;gap:9px}
.heroActions .heroSecondary{background:transparent !important;color:#fff !important;border:1px solid #ffffff55}
.quickStats{grid-template-columns:repeat(5,minmax(0,1fr));margin-top:14px}
.quickStats .stat{min-width:0}
.quickStats .stat strong{font-size:22px}
.recentGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:22px}
.recentItem{display:flex;flex-direction:column;align-items:flex-start !important;justify-content:center !important;text-align:left;min-height:70px;background:#fff !important;color:#0f172a !important;border:1px solid #e2e8f0 !important;border-radius:15px !important;padding:12px 14px !important;min-width:0}
.recentItem b{width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.recentItem small{margin-top:4px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%}
.productTopActions{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:8px}
.offlineBanner{max-width:780px;margin:10px auto 0;padding:11px 16px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:14px;display:flex;justify-content:space-between;gap:12px;font-size:13px}
.offlineBanner span{color:#c2410c}
.needFavorites{margin:0 0 14px}
.needFavorites>small{display:block;color:#64748b;font-weight:700;margin-bottom:7px}
.favoriteChips{display:flex;gap:7px;flex-wrap:wrap}
.favoriteChip{background:#f1f5f9 !important;color:#334155 !important;border:1px solid #e2e8f0 !important;border-radius:999px !important;padding:8px 11px !important;font-size:13px !important}
.needNameField{position:relative}
.needSuggestions{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:8;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 12px 28px #0f172a18;overflow:hidden}
.needSuggestions button{width:100%;display:block !important;text-align:left !important;background:#fff !important;color:#0f172a !important;border-radius:0 !important;padding:10px 12px !important;border-bottom:1px solid #f1f5f9 !important;font-weight:650 !important}
.needSuggestions button:last-child{border-bottom:0 !important}
.needFormActions{display:flex;flex-wrap:wrap;gap:9px}
.productDetailHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-right:42px}
.productDetailHeader h2{margin-bottom:4px}
.productDetailHeader p{margin:0;color:#64748b}
.quickModeBadge{background:#dbeafe;color:#1d4ed8;padding:6px 9px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap}
.batchGroups{gap:10px}
.batchGroup{width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.batchGroup.firstToOpen{border-color:#f59e0b;box-shadow:0 0 0 2px #fef3c7 inset}
.batchGroupInfo{min-width:0;flex:1}
.batchGroupTitle{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.batchGroupInfo small{display:block;margin-top:5px;color:#64748b}
.firstOpenBadge{background:#fef3c7;color:#92400e;border-radius:999px;padding:4px 7px;font-size:10px;font-weight:900;letter-spacing:.2px}
.batchGroupActions{display:flex;gap:7px;flex:0 0 auto}
.batchGroupActions button{white-space:nowrap}
.quickBatchForm>button{width:100%}

html.dark .recentItem,
html.dark .batchGroup,
html.dark .needSuggestions,
html.dark .needSuggestions button{background:#111827 !important;color:#f8fafc !important;border-color:#263244 !important}
html.dark .recentItem small,
html.dark .batchGroupInfo small,
html.dark .needFavorites>small{color:#94a3b8}
html.dark .favoriteChip{background:#172033 !important;color:#cbd5e1 !important;border-color:#334155 !important}
html.dark .needSuggestions button{border-bottom-color:#263244 !important}
html.dark .batchGroup.firstToOpen{border-color:#b45309;box-shadow:0 0 0 2px #422006 inset}
html.dark .firstOpenBadge{background:#422006;color:#fdba74}
html.dark .quickModeBadge{background:#172554;color:#93c5fd}
html.dark .offlineBanner{background:#2b1606;border-color:#7c2d12;color:#fdba74}
html.dark .offlineBanner span{color:#fed7aa}

@media(max-width:700px){
  .quickStats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .quickStats .stat:first-child{grid-column:auto}
  .recentGrid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:520px){
  .heroActions{display:grid;grid-template-columns:1fr}
  .heroActions button{width:100%}
  .productTopActions{display:grid;grid-template-columns:1fr 1fr}
  .productTopActions button{width:100%;padding-left:8px !important;padding-right:8px !important;font-size:13px}
  .offlineBanner{margin:8px 12px 0;flex-direction:column;gap:2px}
  .needFormActions{display:grid;grid-template-columns:1fr}
  .needFormActions button{width:100%}
  .batchGroup{align-items:stretch;flex-direction:column}
  .batchGroupActions{width:100%;display:grid;grid-template-columns:1fr 1fr}
  .batchGroupActions button{width:100%}
  .productDetailHeader{padding-right:38px}
}
'''

app_path.write_text(text)
css_path.write_text(css)
print('Practical feature patch applied')
