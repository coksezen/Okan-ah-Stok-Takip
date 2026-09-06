import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Barcode, Bell, Boxes, CalendarDays, ClipboardList, LogOut, Minus, Plus, Search, Settings, Trash2, X } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { supabase, configured } from './supabase'
import { enableNotifications } from './notifications'

const emptyProduct = { name:'', barcode:'', category:'', unit:'adet', notes:'', min_stock:0 }
const emptyBatch = { lot_no:'', expiry_date:'', quantity:1 }
const daysLeft = d => Math.ceil((new Date(d+'T23:59:59') - new Date()) / 86400000)
const fmt = d => d ? new Intl.DateTimeFormat('tr-TR').format(new Date(d+'T12:00:00')) : '-'

export default function App(){
  const [session,setSession]=useState(null), [loading,setLoading]=useState(true)
  const [tab,setTab]=useState(new URLSearchParams(location.search).get('tab') || 'home')
  const [products,setProducts]=useState([]), [batches,setBatches]=useState([]), [query,setQuery]=useState('')
  const [login,setLogin]=useState({email:'',password:''}), [loginError,setLoginError]=useState('')
  const [modal,setModal]=useState(null), [productForm,setProductForm]=useState(emptyProduct), [batchForm,setBatchForm]=useState(emptyBatch)
  const [selectedBranch,setSelectedBranch]=useState(null)
  const [needs,setNeeds]=useState([])
  const [profile,setProfile]=useState(null)
  const [allowedUsers,setAllowedUsers]=useState([])
  const [userForm,setUserForm]=useState({
  email:'',
  role:'branch',
  branch:'suna_uzal'
})
const [needForm,setNeedForm]=useState({
  item_name:'',
  quantity:1,
  unit:'adet',
  note:''
})
  const [message,setMessage]=useState(''), [scanner,setScanner]=useState(false), [scanMode,setScanMode]=useState('find')
  const videoRef=useRef(null), scannerControls=useRef(null)

  useEffect(()=>{
    if(!configured){ setLoading(false); return }
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{ if(session) loadData() },[session])
  useEffect(()=>()=>scannerControls.current?.stop(),[])
async function loadData(){
  const [
    {data:p,error:pe},
    {data:b,error:be},
    {data:n,error:ne},
    {data:pr,error:pre}
  ] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('batches').select('*,products(name,barcode,unit)').order('expiry_date'),
    supabase.from('branch_needs').select('*').order('created_at',{ascending:false}),
    supabase.from('user_profiles').select('*').eq('user_id',session.user.id).single()
  ])

  if(pe||be||ne||pre){
    return flash((pe||be||ne||pre).message)
  }

  setProducts(p||[])
  setBatches(b||[])
  setNeeds(n||[])
  setProfile(pr||null)

  if(pr?.role==='admin'){
    const {data:au,error:aue}=await supabase
      .from('allowed_users')
      .select('*')
      .order('email')

    if(aue) return flash(aue.message)

    setAllowedUsers(au||[])
  }else{
    setAllowedUsers([])
  }

  if(pr?.role==='branch' && pr?.branch){
    setSelectedBranch(pr.branch)
    setTab('needs')
  }
}
async function addAllowedUser(e){
  e.preventDefault()

  const email=userForm.email.trim().toLowerCase()

  if(!email) return flash('E-posta adresi yazmalısın.')

  const branch=userForm.role==='admin' ? null : userForm.branch

  const {error}=await supabase
    .from('allowed_users')
    .insert({
      email,
      role:userForm.role,
      branch
    })

  if(error) return flash(error.message)

  setUserForm({
    email:'',
    role:'branch',
    branch:'suna_uzal'
  })

  flash('Kullanıcı yetkisi eklendi.')
  loadData()
}

async function updateAllowedUser(email,role,branch){
  const finalBranch=role==='admin' ? null : branch

  const {error}=await supabase
    .from('allowed_users')
    .update({
      role,
      branch:finalBranch
    })
    .eq('email',email)

  if(error) return flash(error.message)

  flash('Kullanıcı yetkisi güncellendi.')
  loadData()
}

async function removeAllowedUser(email){
  const ok=confirm(`${email} için uygulama erişimi kaldırılsın mı?`)
  if(!ok) return

  if(email.toLowerCase()===session.user.email?.toLowerCase()){
    return flash('Kendi erişimini kaldıramazsın.')
  }

  const {error}=await supabase
    .from('allowed_users')
    .delete()
    .eq('email',email)

  if(error) return flash(error.message)

  flash('Kullanıcının erişimi kaldırıldı.')
  loadData()
}
async function addNeed(e){
  e.preventDefault()

  if(!selectedBranch) return
  if(!needForm.item_name.trim()) return flash('Ürün adı yazmalısın.')
  if(!needForm.quantity || Number(needForm.quantity) <= 0){
    return flash('Adet 1 veya daha fazla olmalı.')
  }

  const {error}=await supabase
    .from('branch_needs')
.insert({
  branch:selectedBranch,
  item_name:needForm.item_name.trim(),
  quantity:Number(needForm.quantity),
  unit:needForm.unit.trim() || 'adet',
  note:needForm.note || null
})
  if(error) return flash(error.message)

  setNeedForm({
  item_name:'',
  quantity:1,
  unit:'adet',
  note:''
})
  flash('İhtiyaç eklendi.')
  loadData()
}
  async function partialNeed(id,currentQty){
  const value = prompt(`Kaç adet teslim edildi? Mevcut ihtiyaç: ${currentQty}`)
  if(value===null) return

  const delivered = Number(value)

  if(!delivered || delivered <= 0){
    return flash('Geçerli bir miktar gir.')
  }

  if(delivered >= Number(currentQty)){
    return completeNeed(id)
  }

  const remaining = Number(currentQty) - delivered

  const {error}=await supabase
    .from('branch_needs')
    .update({quantity:remaining})
    .eq('id',id)

  if(error) return flash(error.message)

  flash(`Teslim kaydedildi. Kalan: ${remaining}`)
  loadData()
}

async function completeNeed(id){
  const ok = confirm('Bu ihtiyaç tamamen karşılandı mı?')
  if(!ok) return

  const {error}=await supabase
    .from('branch_needs')
    .delete()
    .eq('id',id)

  if(error) return flash(error.message)

  flash('İhtiyaç tamamlandı.')
  loadData()
}
  async function deleteNeed(id){
  const ok = confirm('Bu ihtiyaç listeden silinsin mi?')
  if(!ok) return

  const {error}=await supabase
    .from('branch_needs')
    .delete()
    .eq('id',id)

  if(error) return flash(error.message)

  flash('İhtiyaç listeden silindi.')
  loadData()
}
async function sendNeedsList(){
  if(!selectedBranch) return

  const count = needs.filter(n=>n.branch===selectedBranch).length

  if(count===0){
    return flash('Gönderilecek ihtiyaç yok.')
  }

  try{
    const {data,error}=await supabase.functions.invoke(
      'send-needs-notification',
      {
        body:{
          branch:selectedBranch
        }
      }
    )

    if(error) throw error

    flash(`Liste yöneticilere gönderildi. ${data?.sent ?? 0} cihaza bildirim gitti.`)
  }catch(e){
    flash(`Bildirim hatası: ${e.message}`)
  }
}
function flash(t){
  setMessage(t)
  setTimeout(()=>setMessage(''),3500)
}
  async function signIn(e){
    e.preventDefault(); setLoginError('')
    const {error}=await supabase.auth.signInWithPassword(login)
    if(error)setLoginError('E-posta veya şifre hatalı.')
  }async function signUp(email,password){
  const {data,error}=await supabase.auth.signUp({
    email,
    password
  })

  if(error) throw error

  return data
}
  async function signOut(){ await supabase.auth.signOut() }

  const totals=useMemo(()=>{
    const qty=batches.reduce((a,b)=>a+Number(b.quantity||0),0)
    const near=batches.filter(b=>daysLeft(b.expiry_date)>=0&&daysLeft(b.expiry_date)<=10).length
    const expired=batches.filter(b=>daysLeft(b.expiry_date)<0).length
    return {qty,near,expired}
  },[batches])
  const productQty=id=>batches.filter(b=>b.product_id===id).reduce((a,b)=>a+Number(b.quantity||0),0)
  const filtered=products.filter(p=>(p.name+' '+(p.barcode||'')+' '+(p.category||'')).toLowerCase().includes(query.toLowerCase()))

  function openNew(barcode=''){ setProductForm({...emptyProduct,barcode}); setBatchForm(emptyBatch); setModal('new') }
  function openProduct(p){ setProductForm({...p}); setBatchForm(emptyBatch); setModal('product') }

  async function saveNew(e){
    e.preventDefault()
    if(!productForm.name.trim()) return flash('Ürün adı gerekli.')
    const {data:p,error}=await supabase.from('products').insert({...productForm,created_by:session.user.id}).select().single()
    if(error) return flash(error.message.includes('duplicate')?'Bu barkod zaten kayıtlı.':error.message)
    if(batchForm.expiry_date || batchForm.lot_no || Number(batchForm.quantity)>0){
      const {error:be}=await supabase.from('batches').insert({product_id:p.id,...batchForm,quantity:Number(batchForm.quantity),created_by:session.user.id})
      if(be) return flash(be.message)
    }
    setModal(null); await loadData(); flash('Ürün eklendi.')
  }
  async function updateProduct(e){
    e.preventDefault()
    const {error}=await supabase.from('products').update({name:productForm.name,barcode:productForm.barcode||null,category:productForm.category,unit:productForm.unit,notes:productForm.notes,min_stock:Number(productForm.min_stock||0)}).eq('id',productForm.id)
    if(error)return flash(error.message)
    setModal(null);await loadData();flash('Ürün güncellendi.')
  }
 async function addBatch(e){
  e.preventDefault()

  if(!batchForm.expiry_date)
    return flash('Son kullanma tarihi gerekli.')

  const branch =
    profile?.role === 'branch'
      ? profile.branch
      : selectedBranch

  if(!branch)
    return flash('Şube belirlenemedi.')

  const {error}=await supabase
    .from('batches')
    .insert({
      product_id:productForm.id,
      ...batchForm,
      branch,
      quantity:Number(batchForm.quantity)
    })

  if(error) return flash(error.message)

  setBatchForm(emptyBatch)
  await loadData()
  flash('Parti eklendi.')
}
  }
  async function changeQty(batch,delta){
    const next=Math.max(0,Number(batch.quantity)+delta)
    const {error}=await supabase.rpc('change_batch_quantity',{p_batch_id:batch.id,p_delta:delta,p_user_id:session.user.id})
    if(error) return flash(error.message)
    if(next===0) flash('Parti stoğu 0 oldu.'); await loadData()
  }
  async function deleteBatch(id){
    if(!confirm('Bu partiyi silmek istiyor musun?'))return
    const {error}=await supabase.from('batches').delete().eq('id',id); if(error)return flash(error.message)
    await loadData();flash('Parti silindi.')
  }
  async function deleteProduct(id){
    if(!confirm('Ürünü ve tüm parti kayıtlarını silmek istiyor musun?'))return
    const {error}=await supabase.from('products').delete().eq('id',id); if(error)return flash(error.message)
    setModal(null);await loadData();flash('Ürün silindi.')
  }

  async function startScanner(mode='find'){
  setScanMode(mode)
  setScanner(true)

  setTimeout(async()=>{
    try{
      const reader=new BrowserMultiFormatReader()

      scannerControls.current=await reader.decodeFromConstraints(
        {
          video:{
            facingMode:{ideal:'environment'},
            width:{ideal:1920},
            height:{ideal:1080}
          }
        },
        videoRef.current,
        (result)=>{
          if(result){
            scannerControls.current?.stop()
            setScanner(false)
            handleBarcode(result.getText(),mode)
          }
        }
      )

      // iPhone destekliyorsa sürekli autofocus + hafif zoom
      const stream=videoRef.current?.srcObject
      const track=stream?.getVideoTracks?.()[0]

      if(track){
        const caps=track.getCapabilities?.() || {}
        const advanced={}

        if(caps.focusMode?.includes?.('continuous')){
          advanced.focusMode='continuous'
        }

        if(caps.zoom){
          const min=caps.zoom.min ?? 1
          const max=caps.zoom.max ?? 1
          advanced.zoom=Math.min(max,Math.max(min,1.5))
        }

        if(Object.keys(advanced).length){
          try{
            await track.applyConstraints({advanced:[advanced]})
          }catch{}
        }
      }

    }catch(e){
      setScanner(false)
      flash('Kamera açılamadı. Kamera iznini kontrol et.')
    }
  },100)
}
  function handleBarcode(code,mode){
    if(mode==='new'){openNew(code);return}
    const p=products.find(x=>x.barcode===code)
    if(p)openProduct(p); else { if(confirm('Bu barkod kayıtlı değil. Yeni ürün olarak eklemek ister misin?')) openNew(code) }
  }
  async function notify(){
    try{await enableNotifications(session.user.id);flash('Bildirimler açıldı.')}catch(e){flash(e.message)}
  }async function testNotification(){
  try{
    const {data,error}=await supabase.functions.invoke(
      'send-expiry-notifications',
      {body:{test:true}}
    )

    if(error) throw error

    flash(`Test bildirimi gönderildi. ${data?.sent ?? 0} cihaza gönderildi.`)
  }catch(e){
    flash(`Test bildirimi hatası: ${e.message}`)
  }
}

  if(loading) return <div className="center">Yükleniyor…</div>
  if(!configured) return <SetupMissing />
  if(!session) return <Login login={login} setLogin={setLogin} error={loginError} submit={signIn} signUp={signUp}/>

  const expiryList=[...batches].sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date))
  return <div className="app">
    <header><div><b>StokCep</b><small>Ortak stok takibi</small></div><button className="icon" onClick={signOut}><LogOut size={20}/></button></header>
    <main>
      {tab==='home' && <>
        <section className="hero"><h1>Stokların kontrol altında.</h1><p>Barkod okut, ürün ekle ve SKT yaklaşanları tek ekrandan gör.</p><button onClick={()=>startScanner('find')}><Barcode size={20}/> Barkod okut</button></section>
        <div className="stats"><Stat n={totals.qty} t="Toplam adet"/><Stat n={totals.near} t="10 gün içinde" warn/><Stat n={totals.expired} t="Süresi geçen" danger/></div>
        <div className="sectionTitle"><h2>Yaklaşan tarihler</h2><button className="link" onClick={()=>setTab('expiry')}>Tümünü gör</button></div>
        <div className="list">{expiryList.slice(0,5).map(b=><BatchRow key={b.id} b={b}/>)}{!expiryList.length&&<Empty text="Henüz parti kaydı yok."/>}</div>
      </>}
      {tab==='needs' && <>
 {profile?.role==='admin' && !selectedBranch ? <>
    <div className="sectionTitle">
      <h1>İhtiyaçlar</h1>
    </div>

    <div className="list">
      <button className="productRow" onClick={()=>setSelectedBranch('veteriner')}>
        <div>
          <b>Veteriner Fakültesi</b>
          <small>Eksik listesini görüntüle</small>
        </div>
      </button>

      <button className="productRow" onClick={()=>setSelectedBranch('iktisat')}>
        <div>
          <b>İktisat Fakültesi</b>
          <small>Eksik listesini görüntüle</small>
        </div>
      </button>

      <button className="productRow" onClick={()=>setSelectedBranch('suna_uzal')}>
        <div>
          <b>Suna UZAL</b>
          <small>Eksik listesini görüntüle</small>
        </div>
      </button>

      <button className="productRow" onClick={()=>setSelectedBranch('uso')}>
        <div>
          <b>USO</b>
          <small>Eksik listesini görüntüle</small>
        </div>
      </button>
    </div>
  </> : <>
    <div className="sectionTitle">
      <h1>
        {selectedBranch==='veteriner' ? 'Veteriner Fakültesi' :
         selectedBranch==='iktisat' ? 'İktisat Fakültesi' :
         selectedBranch==='suna_uzal' ? 'Suna UZAL' : 'USO'}
      </h1>

      <button
        className="secondary"
        onClick={()=>setSelectedBranch(null)}
      >
        Geri
      </button>
    </div>

    <div className="card">
  <h3>İhtiyaç Ekle</h3>

  <form onSubmit={addNeed}>
   <input
  type="text"
  placeholder="Ürün adı"
  value={needForm.item_name}
  onChange={e=>setNeedForm({...needForm,item_name:e.target.value})}
  required
/>

<input
  type="text"
  placeholder="Birim (adet, koli, paket, kg...)"
  value={needForm.unit}
  onChange={e=>setNeedForm({...needForm,unit:e.target.value})}
  required
/>

    <input
      type="number"
      min="1"
      placeholder="Adet"
      value={needForm.quantity}
      onChange={e=>setNeedForm({...needForm,quantity:e.target.value})}
      required
    />

    <input
      type="text"
      placeholder="Not (isteğe bağlı)"
      value={needForm.note}
      onChange={e=>setNeedForm({...needForm,note:e.target.value})}
    />

    <button type="submit">
      İhtiyaç Ekle
    </button>
  </form>
</div>

<div className="card">
  <h3>İhtiyaç Listesi</h3>
<button
  type="button"
  onClick={sendNeedsList}
>
  Listeyi Gönder
</button>
  {needs.filter(n=>n.branch===selectedBranch).length===0 ? (
    <p>Henüz ihtiyaç eklenmedi.</p>
  ) : (
    <div className="list">
      {needs
        .filter(n=>n.branch===selectedBranch)
        .map(n=>
         <div className="productRow" key={n.id}>
  <div>
    <b>{n.item_name}</b>
    <small>
      {n.quantity} {n.unit}
      {n.note ? ` • ${n.note}` : ''}
    </small>
  </div>

{profile?.role==='admin' && (
  <div>
    <button
      type="button"
      onClick={()=>partialNeed(n.id,n.quantity)}
    >
      Kısmi Teslim
    </button>

    <button
      type="button"
      onClick={()=>completeNeed(n.id)}
    >
      Tamamlandı
    </button>

    <button
      type="button"
      className="secondary"
      onClick={()=>deleteNeed(n.id)}
    >
      Sil
    </button>
  </div>
)}
</div>
        )}
    </div>
  )}
</div>
  </>}
</>}
      {tab==='products' && <>
        <div className="sectionTitle"><h1>Ürünler</h1><button onClick={()=>openNew()}><Plus size={18}/> Ürün ekle</button></div>
        <div className="search"><Search size={18}/><input placeholder="Ürün veya barkod ara" value={query} onChange={e=>setQuery(e.target.value)}/><button className="scanmini" onClick={()=>startScanner('find')}><Barcode size={20}/></button></div>
        <div className="list">{filtered.map(p=><button className="productRow" key={p.id} onClick={()=>openProduct(p)}><div><b>{p.name}</b><small>{p.barcode||'Barkod yok'} · {p.category||'Kategori yok'}</small></div><strong>{productQty(p.id)} {p.unit}</strong></button>)}{!filtered.length&&<Empty text="Ürün bulunamadı."/>}</div>
      </>}
    {tab==='expiry' && <>
  <div className="sectionTitle">
    <h1>SKT Takibi</h1>
  </div>

  {profile?.role==='admin' && (
    <div className="list">
      <button
        className={selectedBranch==='veteriner' ? '' : 'secondary'}
        onClick={()=>setSelectedBranch('veteriner')}
      >
        Veteriner Fakültesi
      </button>

      <button
        className={selectedBranch==='iktisat' ? '' : 'secondary'}
        onClick={()=>setSelectedBranch('iktisat')}
      >
        İktisat Fakültesi
      </button>

      <button
        className={selectedBranch==='suna_uzal' ? '' : 'secondary'}
        onClick={()=>setSelectedBranch('suna_uzal')}
      >
        Suna UZAL
      </button>

      <button
        className={selectedBranch==='uso' ? '' : 'secondary'}
        onClick={()=>setSelectedBranch('uso')}
      >
        USO
      </button>
    </div>
  )}

  <div className="list">
    {expiryList
      .filter(b=>b.branch===selectedBranch)
      .map(b=><BatchRow key={b.id} b={b}/>)
    }

    {!expiryList.filter(b=>b.branch===selectedBranch).length && (
      <Empty text="Bu şubede yaklaşan SKT kaydı yok."/>
    )}
  </div>
</>}
      {tab==='settings' && <>
        <div className="card">
  <h3>Telefon bildirimleri</h3>
  <p>Son kullanma tarihine 10 gün kalan partiler için bu telefonda bildirim al.</p>

  <button onClick={notify}>
    Bildirimleri aç
  </button>

  <button
    className="secondary"
    onClick={testNotification}
    style={{marginLeft:'10px'}}
  >
    Test bildirimi gönder
  </button>
</div>
        {profile?.role==='admin' && (
  <div className="card">
    <h3>Kullanıcı Yönetimi</h3>

    <form onSubmit={addAllowedUser}>
      <input
        type="email"
        placeholder="E-posta adresi"
        value={userForm.email}
        onChange={e=>setUserForm({...userForm,email:e.target.value})}
        required
      />

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

      <button type="submit">
        Kullanıcı Ekle
      </button>
    </form>

    <h3>Yetkili Kullanıcılar</h3>

    <div className="list">
      {allowedUsers.map(u=>(
        <div className="productRow" key={u.email}>
          <div>
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

          <div>
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
    </div>
  </div>
)}
        <div className="card"><h3>Hesap</h3><p>{session.user.email}</p><button className="secondary" onClick={signOut}>Çıkış yap</button></div>
      </>}
    </main>
    {profile?.role === 'admin' ? (
  <nav>
    {[
      ['home',Boxes,'Ana Sayfa'],
      ['products',Search,'Ürünler'],
      ['needs',ClipboardList,'İhtiyaçlar'],
      ['expiry',CalendarDays,'SKT'],
      ['settings',Settings,'Ayarlar']
    ].map(([id,Icon,label])=>
      <button
        key={id}
        className={tab===id?'active':''}
        onClick={()=>setTab(id)}
      >
        <Icon size={22}/>
        <span>{label}</span>
      </button>
    )}
  </nav>
) : (
  <nav>
    <button
      className="active"
      onClick={()=>setTab('needs')}
    >
      <ClipboardList size={22}/>
      <span>İhtiyaçlar</span>
    </button>
  </nav>
)}
    {message&&<div className="toast">{message}</div>}
    {scanner&&<div className="scanner"><button className="close" onClick={()=>{scannerControls.current?.stop();setScanner(false)}}><X/></button><video ref={videoRef}/><div className="frame"></div><p>Barkodu çerçevenin içine getir</p></div>}
    {modal&&<Modal close={()=>setModal(null)}>
      {modal==='new'?<ProductForm title="Yeni ürün" form={productForm} setForm={setProductForm} batch={batchForm} setBatch={setBatchForm} submit={saveNew} scan={()=>startScanner('new')} isNew/>:
      <ProductDetail product={productForm} setProduct={setProductForm} batches={batches.filter(b=>b.product_id===productForm.id)} batch={batchForm} setBatch={setBatchForm} update={updateProduct} addBatch={addBatch} changeQty={changeQty} deleteBatch={deleteBatch} deleteProduct={deleteProduct}/>} 
    </Modal>}
  </div>
}

function Login({login,setLogin,error,submit,signUp}){
  const [register,setRegister]=useState(false)
  const [registerError,setRegisterError]=useState('')
  const [registerSuccess,setRegisterSuccess]=useState('')
  const [busy,setBusy]=useState(false)

  async function handleSubmit(e){
    if(!register){
      return submit(e)
    }

    e.preventDefault()
    setRegisterError('')
    setRegisterSuccess('')

    if(!login.email || !login.password){
      return setRegisterError('E-posta ve şifre gerekli.')
    }

    if(login.password.length < 6){
      return setRegisterError('Şifre en az 6 karakter olmalı.')
    }

    setBusy(true)

    try{
      const data=await signUp(login.email,login.password)

      if(data?.session){
        setRegisterSuccess('Hesabın oluşturuldu.')
      }else{
        setRegisterSuccess('Hesabın oluşturuldu. E-postana gelen doğrulama bağlantısına tıkla, sonra giriş yap.')
      }

      setRegister(false)
    }catch(e){
      setRegisterError(
        e.message?.includes('Database error')
          ? 'Bu e-posta adresinin kayıt izni yok veya hesap zaten mevcut.'
          : e.message
      )
    }finally{
      setBusy(false)
    }
  }

  return <div className="login">
    <div className="brand">
      <img src="/icon.svg"/>
      <h1>StokCep</h1>
      <p>Ortak stok takibi</p>
    </div>

    <form onSubmit={handleSubmit}>
      <h2>{register ? 'Kayıt Ol' : 'Giriş Yap'}</h2>

      <input
        type="email"
        placeholder="E-posta"
        value={login.email}
        onChange={e=>setLogin({...login,email:e.target.value})}
        required
      />

      <input
        type="password"
        placeholder="Şifre"
        value={login.password}
        onChange={e=>setLogin({...login,password:e.target.value})}
        required
      />

      {(registerError || error) &&
        <p className="error">{registerError || error}</p>
      }

      {registerSuccess &&
        <p>{registerSuccess}</p>
      }

      <button type="submit" disabled={busy}>
        {busy ? 'Bekleyin...' : register ? 'Hesap Oluştur' : 'Giriş Yap'}
      </button>

      <button
        type="button"       
        className="secondary"
        onClick={()=>{
          setRegister(!register)
          setRegisterError('')
        }}
      >
        {register ? 'Giriş ekranına dön' : 'Kayıt Ol'}
      </button>
    </form>
  </div>
}
function SetupMissing(){return <div className="login"><div className="brand"><img src="/icon.svg"/><h1>StokCep hazır</h1><p>Bağlantı bilgileri henüz girilmemiş. Paketteki KURULUM.md dosyasındaki adımları tamamla.</p></div></div>}
function Stat({n,t,warn,danger}){return <div className={'stat '+(warn?'warn ':'')+(danger?'danger':'')}><strong>{n}</strong><span>{t}</span></div>}
function Empty({text}){return <div className="empty">{text}</div>}
function BatchRow({b}){const d=daysLeft(b.expiry_date);return <div className="batchRow"><div><b>{b.products?.name||'Ürün'}</b><small>{b.lot_no?`Lot: ${b.lot_no} · `:''}{b.quantity} {b.products?.unit||'adet'} · {fmt(b.expiry_date)}</small></div><span className={d<0?'pill red':d<=10?'pill orange':'pill'}>{d<0?`${Math.abs(d)} gün geçti`:d===0?'Bugün':`${d} gün`}</span></div>}
function Modal({children,close}){return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal"><button className="closeModal" onClick={close}><X/></button>{children}</div></div>}
function ProductForm({title,form,setForm,batch,setBatch,submit,scan,isNew}){return <form onSubmit={submit}><h2>{title}</h2><label>Ürün adı<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Barkod<div className="inline"><input value={form.barcode||''} onChange={e=>setForm({...form,barcode:e.target.value})}/>{scan&&<button type="button" className="secondary" onClick={scan}><Barcode size={18}/></button>}</div></label><div className="grid2"><label>Kategori<input value={form.category||''} onChange={e=>setForm({...form,category:e.target.value})}/></label><label>Birim<select value={form.unit||'adet'} onChange={e=>setForm({...form,unit:e.target.value})}><option>adet</option><option>kutu</option><option>şişe</option><option>paket</option><option>ml</option></select></label></div><label>Minimum stok<input type="number" min="0" value={form.min_stock||0} onChange={e=>setForm({...form,min_stock:e.target.value})}/></label><label>Not<textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></label>{isNew&&<><h3>İlk parti</h3><div className="grid2"><label>Lot no<input value={batch.lot_no} onChange={e=>setBatch({...batch,lot_no:e.target.value})}/></label><label>Adet<input type="number" min="0" value={batch.quantity} onChange={e=>setBatch({...batch,quantity:e.target.value})}/></label></div><label>Son kullanma tarihi<input type="date" value={batch.expiry_date} onChange={e=>setBatch({...batch,expiry_date:e.target.value})}/></label></>}<button type="submit">Kaydet</button></form>}
function ProductDetail({product,setProduct,batches,batch,setBatch,update,addBatch,changeQty,deleteBatch,deleteProduct}){return <div><ProductForm title="Ürün bilgileri" form={product} setForm={setProduct} batch={batch} setBatch={setBatch} submit={update}/><hr/><h3>Partiler</h3><div className="list compact">{batches.map(b=><div className="manageBatch" key={b.id}><div><b>{fmt(b.expiry_date)}</b><small>{b.lot_no?`Lot ${b.lot_no}`:'Lot yok'}</small></div><div className="qty"><button className="secondary" onClick={()=>changeQty(b,-1)}><Minus size={16}/></button><strong>{b.quantity}</strong><button className="secondary" onClick={()=>changeQty(b,1)}><Plus size={16}/></button><button className="dangerBtn" onClick={()=>deleteBatch(b.id)}><Trash2 size={16}/></button></div></div>)}{!batches.length&&<Empty text="Bu üründe parti yok."/>}</div><form onSubmit={addBatch} className="addBatch"><h3>Yeni parti ekle</h3><div className="grid2"><label>Lot no<input value={batch.lot_no} onChange={e=>setBatch({...batch,lot_no:e.target.value})}/></label><label>Adet<input type="number" min="1" required value={batch.quantity} onChange={e=>setBatch({...batch,quantity:e.target.value})}/></label></div><label>Son kullanma tarihi<input type="date" required value={batch.expiry_date} onChange={e=>setBatch({...batch,expiry_date:e.target.value})}/></label><button>Parti ekle</button></form><button className="deleteProduct" onClick={()=>deleteProduct(product.id)}><Trash2 size={18}/> Ürünü sil</button></div>}
