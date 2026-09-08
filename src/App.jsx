import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Barcode, Bell, Boxes, CalendarDays, ClipboardList, Eye, EyeOff, LogOut, Minus, Plus, Search, Settings, Trash2, X } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { supabase, configured } from './supabase'
import { enableNotifications } from './notifications'

const emptyProduct = {
  name:'',
  barcode:'',
  category:'',
  unit:'adet',
  notes:'',
  min_stock:0,
  box_size:1
}
const emptyBatch = { lot_no:'', expiry_date:'', quantity:1 }
const daysLeft = d => Math.ceil((new Date(d+'T23:59:59') - new Date()) / 86400000)
const fmt = d => d ? new Intl.DateTimeFormat('tr-TR').format(new Date(d+'T12:00:00')) : '-'

export default function App(){
  const [session,setSession]=useState(null), [loading,setLoading]=useState(true)
  const [showSplash,setShowSplash]=useState(true)
  const [tab,setTab]=useState(new URLSearchParams(location.search).get('tab') || 'home')
  const [products,setProducts]=useState([]), [batches,setBatches]=useState([]), [query,setQuery]=useState('')
  const [login,setLogin]=useState({email:'',password:''}), [loginError,setLoginError]=useState('')
  const [modal,setModal]=useState(null), [productForm,setProductForm]=useState(emptyProduct), [batchForm,setBatchForm]=useState(emptyBatch)
  const [selectedBranch,setSelectedBranch]=useState(null)
  const [productBranch,setProductBranch]=useState(null)
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
  const swipeStartX=useRef(null)
const swipeStartY=useRef(null)
  useEffect(()=>{
  function onTouchStart(e){
    if(e.touches.length!==1) return

    const touch=e.touches[0]

    // Sadece ekranın sol kenarından başlayan hareket
    if(touch.clientX>35) return

    swipeStartX.current=touch.clientX
    swipeStartY.current=touch.clientY
  }

  function onTouchEnd(e){
    if(swipeStartX.current===null) return

    const touch=e.changedTouches[0]

    const diffX=touch.clientX-swipeStartX.current
    const diffY=Math.abs(touch.clientY-swipeStartY.current)

    swipeStartX.current=null
    swipeStartY.current=null

    // Yeterince sağa kaydırılmadıysa veya dikey hareket fazlaysa iptal
    if(diffX<80 || diffY>70) return

    if(scanner){
      scannerControls.current?.stop()
      setScanner(false)
      return
    }

    if(modal){
      setModal(null)
      return
    }

    if(tab==='products' && profile?.role==='admin' && productBranch){
      setProductBranch(null)
      return
    }

    if(tab==='needs' && profile?.role==='admin' && selectedBranch){
      setSelectedBranch(null)
      return
    }

    if(profile?.role==='admin' && tab!=='home'){
      setTab('home')
    }
  }

  window.addEventListener('touchstart',onTouchStart,{passive:true})
  window.addEventListener('touchend',onTouchEnd,{passive:true})

  return ()=>{
    window.removeEventListener('touchstart',onTouchStart)
    window.removeEventListener('touchend',onTouchEnd)
  }
},[scanner,modal,tab,profile,productBranch,selectedBranch])

  useEffect(()=>{
    if(!configured){ setLoading(false); return }
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])
useEffect(()=>{
  if(loading) return

  const startedAt=window.__STOKCEP_START__ || Date.now()
  const elapsed=Date.now()-startedAt
  const remaining=Math.max(0,2300-elapsed)

  const timer=setTimeout(()=>{
    setShowSplash(false)
  },remaining)

  return ()=>clearTimeout(timer)
},[loading])
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
async function markGroupPickedUp(ids){
  const ok=confirm('Bu ürün depodan alındı olarak işaretlensin mi?')
  if(!ok) return

  const {error}=await supabase
    .from('branch_needs')
    .update({
      picked_up:true,
      picked_up_at:new Date().toISOString()
    })
    .in('id',ids)

  if(error) return flash(error.message)

  flash('Depodan alındı olarak işaretlendi.')
  loadData()
}
  async function markNeedDelivered(ids){
  const ok=confirm('Bu ürün ilgili kantine teslim edildi mi?')
  if(!ok) return

  const {error}=await supabase
    .from('branch_needs')
    .update({
      delivered:true,
      delivered_at:new Date().toISOString()
    })
    .in('id',ids)

  if(error) return flash(error.message)

  flash('Teslim edildi olarak işaretlendi.')
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
  async function finishNeedsList(){
  if(!selectedBranch)
    return flash('Önce şube seçmelisin.')

  const branchNeeds=needs.filter(n=>n.branch===selectedBranch)

  if(!branchNeeds.length)
    return flash('Liste zaten boş.')

  const unfinished=branchNeeds.filter(n=>!n.completed)

  const text=unfinished.length
    ? `Listede ${unfinished.length} alınmamış ürün var. Yine de listeyi bitirip tamamını silmek istiyor musun?`
    : 'Tüm ürünler alındı. Liste bitirilip temizlensin mi?'

  if(!confirm(text)) return

  const {error}=await supabase
    .from('branch_needs')
    .delete()
    .eq('branch',selectedBranch)

  if(error) return flash(error.message)

  flash('Liste tamamlandı ve temizlendi.')
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
 const productQty=id=>batches
  .filter(b=>
    b.product_id===id &&
    b.branch===(profile?.role==='branch' ? profile.branch : productBranch)
  )
  .reduce((a,b)=>a+Number(b.quantity||0),0)
  const filtered=products.filter(p=>(p.name+' '+(p.barcode||'')+' '+(p.category||'')).toLowerCase().includes(query.toLowerCase()))

  function openNew(barcode=''){ setProductForm({...emptyProduct,barcode}); setBatchForm(emptyBatch); setModal('new') }
  function openProduct(p){ setProductForm({...p}); setBatchForm(emptyBatch); setModal('product') }
async function saveNew(e){
  e.preventDefault()

  if(!productForm.name.trim())
    return flash('Ürün adı gerekli.')

  const branch =
    profile?.role==='branch'
      ? profile.branch
      : productBranch

  if(!branch)
    return flash('Önce üniversite seçmelisin.')
  let p=null

const barcode=productForm.barcode?.trim() || null

if(barcode){
  const {data:existing,error:findError}=await supabase
    .from('products')
    .select('*')
    .eq('barcode',barcode)
    .maybeSingle()

  if(findError) return flash(findError.message)

 if(existing){
  p=existing

  if(
    productForm.unit==='kutu' &&
    Number(productForm.box_size)>0 &&
    Number(existing.box_size)!==Number(productForm.box_size)
  ){
    const {data:updated,error:updateError}=await supabase
      .from('products')
      .update({
        box_size:Number(productForm.box_size)
      })
      .eq('id',existing.id)
      .select()
      .single()

    if(updateError) return flash(updateError.message)

    p=updated
  }
}
}

if(!p){
  const {data:newProduct,error:productError}=await supabase
    .from('products')
   .insert({
  ...productForm,
  barcode,
  unit:'adet',
  created_by:session.user.id
})
    .select()
    .single()

  if(productError) return flash(productError.message)

  p=newProduct
}
  const enteredQty=Number(batchForm.quantity)
const boxSize=Number(productForm.box_size || p.box_size || 1)

const stockQty=
  productForm.unit==='kutu'
    ? enteredQty * boxSize
    : enteredQty
  const {error:be}=await supabase
    .from('batches')
    .insert({
      product_id:p.id,
      ...batchForm,
      branch,
      quantity:stockQty
    })

  if(be) return flash(be.message)

  setModal(null)
  await loadData()
  flash('Ürün stoğa eklendi.')
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
      : productBranch

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
  const p=products.find(x=>x.barcode===code)

  if(mode==='new'){
    if(p){
      setProductForm({
        ...p,
        unit:Number(p.box_size)>1 ? 'kutu' : 'adet'
      })
      setBatchForm(emptyBatch)
      setModal('new')
    }else{
      openNew(code)
    }
    return
  }

  if(p){
    openProduct(p)
  }else if(confirm('Bu barkod kayıtlı değil. Yeni ürün olarak eklemek ister misin?')){
    openNew(code)
  }
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
if(showSplash) return (
  <div
    style={{
      minHeight:'100vh',
      display:'flex',
      flexDirection:'column',
      alignItems:'center',
      justifyContent:'center',
      background:'#ffffff',
color:'#0f172a',
      textAlign:'center',
      padding:'24px',
paddingBottom:'180px',
    }}
  >
    <img
      src="/icon.svg"
      alt="Okan-Şah Gıda"
      style={{
        width:'90px',
        height:'90px',
        marginBottom:'24px'
      }}
    />

    <h1
      style={{
        fontSize:'34px',
        margin:'0 0 8px'
      }}
    >
      Okan-Şah Gıda
    </h1>

    <p
      style={{
        margin:0,
        fontSize:'16px',
        opacity:.7
      }}
    >
      Stok ve Kantin Yönetimi
    </p>
  </div>
)
  if(loading) return <div className="center">Yükleniyor…</div>
  if(!configured) return <SetupMissing />
  if(!session) return <Login login={login} setLogin={setLogin} error={loginError} submit={signIn} signUp={signUp}/>

  const expiryList=[...batches].sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date))
  const today=new Date()
today.setHours(0,0,0,0)

const expiryWarnings=batches
  .filter(b=>{
    // Çalışan sadece kendi şubesinin uyarısını görsün
    if(profile?.role==='branch' && b.branch!==profile.branch) return false

    const expiry=new Date(b.expiry_date+'T00:00:00')
    const daysLeft=Math.ceil((expiry-today)/(1000*60*60*24))

    return daysLeft>=0 && daysLeft<=10
  })
  .map(b=>{
    const expiry=new Date(b.expiry_date+'T00:00:00')
    const daysLeft=Math.ceil((expiry-today)/(1000*60*60*24))

    return {...b,daysLeft}
  })
  .sort((a,b)=>a.daysLeft-b.daysLeft)
  const branchLabels={
  veteriner:'Veteriner Fakültesi',
  iktisat:'İktisat Fakültesi',
  suna_uzal:'Suna UZAL',
  uso:'USO'
}

const groupedNeeds=Object.values(
  needs.reduce((acc,n)=>{
    const item=(n.item_name || '').trim()
    const unit=(n.unit || 'adet').trim()
    const key=`${item.toLocaleLowerCase('tr-TR')}__${unit.toLocaleLowerCase('tr-TR')}`

    if(!acc[key]){
      acc[key]={
        key,
        item_name:item,
        unit,
        total:0,
        branches:{},
        branchRows:{},
        ids:[],
        allPickedUp:true
      }
    }

    const qty=Number(n.quantity) || 0

    acc[key].total+=qty
    acc[key].branches[n.branch]=(acc[key].branches[n.branch] || 0)+qty
    if(!acc[key].branchRows[n.branch]){
  acc[key].branchRows[n.branch]=[]
}

acc[key].branchRows[n.branch].push(n)
    acc[key].ids.push(n.id)

    if(!n.picked_up){
      acc[key].allPickedUp=false
    }

    return acc
  },{})
).filter(g=>
  Object.values(g.branchRows).some(rows=>
    rows.some(r=>!r.delivered)
  )
)
  return <div className="app">
    <header><div><b>StokCep</b><small>Ortak stok takibi</small></div><button className="icon" onClick={signOut}><LogOut size={20}/></button></header>
   {expiryWarnings.length>0 && (
  <div className="card">
    <h3>⚠️ SKT Uyarıları</h3>

    <div className="list">
      {expiryWarnings.map(b=>(
        <div className="productRow" key={b.id}>
          <div>
            <b>{b.products?.name || 'Ürün'}</b>

            <small>
              {b.daysLeft<=3
                ? `🚨 SKT'ye ${b.daysLeft} gün kaldı`
                : `⚠️ SKT'ye ${b.daysLeft} gün kaldı`}
            </small>

            <small>
              {b.expiry_date}
            </small>
          </div>

          <button
            type="button"
            onClick={()=>deleteBatch(b.id)}
          >
            Toplandı
          </button>
        </div>
      ))}
    </div>
  </div>
)}
    <main>
      {tab==='home' && <>
        <section className="hero"><h1>Stokların kontrol altında.</h1><p>Barkod okut, ürün ekle ve SKT yaklaşanları tek ekrandan gör.</p><button onClick={()=>startScanner('find')}><Barcode size={20}/> Barkod okut</button></section>
        <div className="stats"><Stat n={totals.qty} t="Toplam adet"/><Stat n={totals.near} t="10 gün içinde" warn/><Stat n={totals.expired} t="Süresi geçen" danger/></div>
        <div className="sectionTitle"><h2>Yaklaşan tarihler</h2><button className="link" onClick={()=>setTab('expiry')}>Tümünü gör</button></div>
        <div className="list">{expiryList.slice(0,5).map(b=><BatchRow key={b.id} b={b}/>)}{!expiryList.length&&<Empty text="Henüz parti kaydı yok."/>}</div>
      </>}
      {profile?.role==='admin' && tab==='home' && (
  <div className="card">
    <h3>Depodan Alınacaklar</h3>

    {!groupedNeeds.length ? (
      <p>Şu an ortak ihtiyaç yok.</p>
    ) : (
      <div className="list">
        {groupedNeeds.map(g=>(
         <div className="productRow" key={g.key}>
  <div>
    <b>{g.item_name}</b>

    <small>
      Toplam: {g.total} {g.unit}
    </small>

  {Object.entries(g.branches).map(([branch,qty])=>{
  const rows=g.branchRows[branch] || []
  const allDelivered=rows.length>0 && rows.every(r=>r.delivered)

  return (
    <div key={branch}>
      <small>
        {branchLabels[branch] || branch}: {qty} {g.unit}
      </small>

      {g.allPickedUp && (
        allDelivered ? (
          <button type="button" className="secondary" disabled>
            ✓ Teslim Edildi
          </button>
        ) : (
          <button
            type="button"
            onClick={()=>markNeedDelivered(rows.map(r=>r.id))}
          >
            Teslim Ettim
          </button>
        )
      )}
    </div>
  )
})}
  </div>

  {g.allPickedUp ? (
    <button type="button" className="secondary" disabled>
      ✓ Depodan Alındı
    </button>
  ) : (
    <button
      type="button"
      onClick={()=>markGroupPickedUp(g.ids)}
    >
      Depodan Aldım
    </button>
  )}
</div>
        ))}
      </div>
    )}
  </div>
)}
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

     {profile?.role==='admin' && (
  <button
    className="secondary"
    onClick={()=>setSelectedBranch(null)}
  >
    Geri
  </button>
)}
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
    {n.completed ? (
      <button
        type="button"
        className="secondary"
        disabled
      >
        ✓ ALINDI
      </button>
    ) : (
      <>
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
      </>
    )}

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
      {profile?.role==='admin' &&
  needs.some(n=>n.branch===selectedBranch) && (
    <button
      type="button"
      onClick={finishNeedsList}
      style={{marginTop:'16px'}}
    >
      ✓ Listeyi Bitir
    </button>
)}
    </div>
  )}
</div>
  </>}
</>}
    {tab==='products' && <>
  {profile?.role==='admin' && !productBranch ? (
    <>
      <div className="sectionTitle">
        <h1>Üniversite Seç</h1>
      </div>

      <div className="list">
        <button
          className="productRow"
          onClick={()=>setProductBranch('veteriner')}
        >
          <div>
            <b>Veteriner Fakültesi</b>
            <small>Stokları görüntüle</small>
          </div>
        </button>

        <button
          className="productRow"
          onClick={()=>setProductBranch('iktisat')}
        >
          <div>
            <b>İktisat Fakültesi</b>
            <small>Stokları görüntüle</small>
          </div>
        </button>

        <button
          className="productRow"
          onClick={()=>setProductBranch('suna_uzal')}
        >
          <div>
            <b>Suna UZAL</b>
            <small>Stokları görüntüle</small>
          </div>
        </button>

        <button
          className="productRow"
          onClick={()=>setProductBranch('uso')}
        >
          <div>
            <b>USO</b>
            <small>Stokları görüntüle</small>
          </div>
        </button>
      </div>
    </>
  ) : (
    <>
      <div className="sectionTitle">
        <h1>
          {(profile?.role==='branch' ? profile.branch : productBranch)==='veteriner'
            ? 'Veteriner Fakültesi'
            : (profile?.role==='branch' ? profile.branch : productBranch)==='iktisat'
              ? 'İktisat Fakültesi'
              : (profile?.role==='branch' ? profile.branch : productBranch)==='suna_uzal'
                ? 'Suna UZAL'
                : 'USO'} Stokları
        </h1>

        {profile?.role==='admin' && (
          <button
            className="secondary"
            onClick={()=>setProductBranch(null)}
          >
            Üniversite Değiştir
          </button>
        )}
      </div>

      <button onClick={()=>openNew()}>
        <Plus size={18}/> Ürün Ekle
      </button>

      <div className="search">
        <Search size={18}/>
        <input
          placeholder="Ürün veya barkod ara"
          value={query}
          onChange={e=>setQuery(e.target.value)}
        />
      </div>

      <div className="list">
        {filtered
          .filter(p=>batches.some(b=>
            b.product_id===p.id &&
            b.branch===(profile?.role==='branch' ? profile.branch : productBranch)
          ))
          .map(p=>
            <button
              className="productRow"
              key={p.id}
              onClick={()=>openProduct(p)}
            >
              <div>
                <b>{p.name}</b>
                <small>{p.barcode || 'Barkod yok'}</small>
              </div>
            </button>
          )
        }
      </div>
    </>
  )}
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
    className={tab==='products' ? 'active' : ''}
    onClick={()=>setTab('products')}
  >
    <Search size={22}/>
    <span>Ürünler</span>
  </button>

  <button
    className={tab==='needs' ? 'active' : ''}
    onClick={()=>setTab('needs')}
  >
    <ClipboardList size={22}/>
    <span>İhtiyaçlar</span>
  </button>

  <button
    className={tab==='expiry' ? 'active' : ''}
    onClick={()=>setTab('expiry')}
  >
    <CalendarDays size={22}/>
    <span>SKT</span>
  </button>
</nav>
)}
    {message&&<div className="toast">{message}</div>}
    {scanner&&<div className="scanner"><button className="close" onClick={()=>{scannerControls.current?.stop();setScanner(false)}}><X/></button><video ref={videoRef}/><div className="frame"></div><p>Barkodu çerçevenin içine getir</p></div>}
    {modal&&<Modal close={()=>setModal(null)}>
      {modal==='new'?<ProductForm title="Yeni ürün" form={productForm} setForm={setProductForm} batch={batchForm} setBatch={setBatchForm} submit={saveNew} scan={()=>startScanner('new')} isNew/>:
      <ProductDetail product={productForm} setProduct={setProductForm} batches={batches.filter(b=>
  b.product_id===productForm.id &&
  b.branch===(profile?.role==='branch' ? profile.branch : productBranch)
)} batch={batchForm} setBatch={setBatchForm} update={updateProduct} addBatch={addBatch} changeQty={changeQty} deleteBatch={deleteBatch} deleteProduct={deleteProduct}/>} 
    </Modal>}
  </div>
}

function Login({login,setLogin,error,submit,signUp}){
  const [register,setRegister]=useState(false)
  const [registerError,setRegisterError]=useState('')
  const [registerSuccess,setRegisterSuccess]=useState('')
  const [busy,setBusy]=useState(false)
  const [showPassword,setShowPassword]=useState(false)

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
    await signUp(login.email,login.password)

setRegisterSuccess('Hesabın oluşturuldu. Şimdi giriş yapabilirsin.')

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
  name="username"
  autoComplete="username"
  placeholder="E-posta"
  value={login.email}
  onChange={e=>setLogin({...login,email:e.target.value})}
  required
/>

    <div style={{position:'relative'}}>
  <input
    type={showPassword ? 'text' : 'password'}
    name="password"
    autoComplete={register ? "new-password" : "current-password"}
    placeholder="Şifre"
    value={login.password}
    onChange={e=>setLogin({...login,password:e.target.value})}
    required
    style={{paddingRight:'48px'}}
  />

  <button
    type="button"
    onClick={()=>setShowPassword(!showPassword)}
    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
    style={{
      position:'absolute',
      right:'14px',
      top:'50%',
      transform:'translateY(-50%)',
      background:'transparent',
      border:'none',
      padding:0,
      width:'auto',
      minWidth:0,
      color:'#64748b',
      cursor:'pointer'
    }}
  >
    {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
  </button>
</div>

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
function BatchRow({b}){
  const d=daysLeft(b.expiry_date)

  return (
    <div className="batchRow">
      <div>
        <b>{b.products?.name || 'Ürün'}</b>
        <small>
          {b.quantity} adet · {fmt(b.expiry_date)}
        </small>
      </div>

      <span className={d<0 ? 'pill red' : d<=10 ? 'pill orange' : 'pill'}>
        {d<0
          ? `${Math.abs(d)} gün geçti`
          : d===0
            ? 'Bugün'
            : `${d} gün`}
      </span>
    </div>
  )
}
function Modal({children,close}){return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal"><button className="closeModal" onClick={close}><X/></button>{children}</div></div>}
function ProductForm({title,form,setForm,batch,setBatch,submit,scan,isNew}){
  return (
    <form onSubmit={submit}>
      <h2>{title}</h2>

      <label>
        Barkod
        <div className="inline">
          <input
            value={form.barcode || ''}
            onChange={e=>setForm({...form,barcode:e.target.value})}
            placeholder="Barkod"
          />
          <button type="button" onClick={scan}>
            <Barcode size={18}/> Okut
          </button>
        </div>
      </label>

      <label>
        Ürün Adı
        <input
          value={form.name || ''}
          onChange={e=>setForm({...form,name:e.target.value})}
          placeholder="Ürün adı"
          required
        />
      </label>

     <label>
  Giriş Şekli
  <select
    value={form.unit || 'adet'}
    onChange={e=>setForm({...form,unit:e.target.value})}
  >
    <option value="adet">Adet</option>
    <option value="kutu">Kutu</option>
  </select>
</label>

{form.unit==='kutu' && (
  <label>
    1 Kutuda Kaç Adet?
    <input
      type="number"
      min="1"
      value={form.box_size || 1}
      onChange={e=>setForm({...form,box_size:Number(e.target.value)})}
      required
    />
  </label>
)}

<label>
  {form.unit==='kutu' ? 'Kaç Kutu Geldi?' : 'Kaç Adet Geldi?'}
  <input
    type="number"
    min="1"
    value={batch.quantity}
    onChange={e=>setBatch({...batch,quantity:e.target.value})}
    required
  />
</label>
      <label>
        Son Kullanma Tarihi
        <input
          type="date"
          value={batch.expiry_date || ''}
          onChange={e=>setBatch({...batch,expiry_date:e.target.value})}
          required
        />
      </label>

      <label>
        Not
        <input
          value={form.notes || ''}
          onChange={e=>setForm({...form,notes:e.target.value})}
          placeholder="İsteğe bağlı"
        />
      </label>

      <button type="submit">
        {isNew ? 'Stoğa Ekle' : 'Kaydet'}
      </button>
    </form>
  )
}
function ProductDetail({
  product,
  setProduct,
  batches,
  batch,
  setBatch,
  update,
  addBatch,
  changeQty,
  deleteBatch,
  deleteProduct
}){
  return (
    <div>
      <ProductForm
        title="Ürün bilgileri"
        form={product}
        setForm={setProduct}
        batch={batch}
        setBatch={setBatch}
        submit={update}
      />

      <hr/>

      <h3>SKT / Stoklar</h3>

      <div className="list compact">
        {batches.map(b=>(
          <div className="manageBatch" key={b.id}>
            <div>
              <b>{fmt(b.expiry_date)}</b>
            </div>

            <div className="qty">
              <button
                className="secondary"
                onClick={()=>changeQty(b,-1)}
              >
                <Minus size={16}/>
              </button>

              <strong>{b.quantity}</strong>

              <button
                className="secondary"
                onClick={()=>changeQty(b,1)}
              >
                <Plus size={16}/>
              </button>

              <button
                className="dangerBtn"
                onClick={()=>deleteBatch(b.id)}
              >
                <Trash2 size={16}/>
              </button>
            </div>
          </div>
        ))}

        {!batches.length &&
          <Empty text="Bu üründe SKT kaydı yok."/>
        }
      </div>

      <form onSubmit={addBatch} className="addBatch">
        <h3>Yeni SKT Ekle</h3>

        <label>
          Adet
          <input
            type="number"
            min="1"
            required
            value={batch.quantity}
            onChange={e=>setBatch({
              ...batch,
              quantity:e.target.value
            })}
          />
        </label>

        <label>
          Son Kullanma Tarihi
          <input
            type="date"
            required
            value={batch.expiry_date}
            onChange={e=>setBatch({
              ...batch,
              expiry_date:e.target.value
            })}
          />
        </label>

        <button>SKT Ekle</button>
      </form>

      <button
        className="deleteProduct"
        onClick={()=>deleteProduct(product.id)}
      >
        <Trash2 size={18}/> Ürünü Sil
      </button>
    </div>
  )
}
