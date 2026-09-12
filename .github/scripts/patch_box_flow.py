from pathlib import Path

path = Path('src/App.jsx')
text = path.read_text()

def rep(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'Could not find block: {label}')
    text = text.replace(old, new, 1)

rep(
    "const emptyBatch = { lot_no:'', expiry_date:'', quantity:1 }",
    """const emptyBatch = {
  lot_no:'',
  expiry_date:'',
  quantity:1,
  box_count:1,
  status:'closed'
}""",
    'emptyBatch'
)

rep(
    "supabase.from('batches').select('*,products(name,barcode,unit)').order('expiry_date')",
    "supabase.from('batches').select('*,products(name,barcode,unit,box_size)').order('expiry_date')",
    'batch product relation'
)

rep(
    "  function openProduct(p){ setProductForm({...p}); setBatchForm(emptyBatch); setModal('product') }",
    """  function openProduct(p){
    if(profile?.role==='admin' && !productBranch){
      const choice=prompt(
        'Hangi kantin için işlem yapılıyor?\\n1 - Veteriner Fakültesi\\n2 - İktisat Fakültesi\\n3 - Suna UZAL\\n4 - USO'
      )
      const branchMap={
        '1':'veteriner',
        '2':'iktisat',
        '3':'suna_uzal',
        '4':'uso'
      }
      const branch=branchMap[choice]
      if(!branch) return flash('Kantin seçilmedi.')
      setProductBranch(branch)
    }

    setProductForm({...p})
    setBatchForm(emptyBatch)
    setModal('product')
  }""",
    'openProduct'
)

rep(
    """  const {error:be}=await supabase
    .from('batches')
    .insert({
      product_id:p.id,
      ...batchForm,
      branch,
      quantity:stockQty
    })

  if(be) return flash(be.message)""",
    """  let be=null

  if(productForm.unit==='kutu'){
    const rows=Array.from({length:enteredQty},()=>({
      product_id:p.id,
      branch,
      expiry_date:batchForm.expiry_date,
      quantity:boxSize,
      box_count:1,
      status:'closed'
    }))

    const result=await supabase
      .from('batches')
      .insert(rows)

    be=result.error
  }else{
    const result=await supabase
      .from('batches')
      .insert({
        product_id:p.id,
        branch,
        expiry_date:batchForm.expiry_date,
        quantity:stockQty,
        box_count:1,
        status:'closed'
      })

    be=result.error
  }

  if(be) return flash(be.message)""",
    'saveNew batch insert'
)

old_add = """ async function addBatch(e){
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
}"""

new_add = """ async function addBatch(e){
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
  let error=null

  if(isBox){
    const boxCount=Math.max(1,Number(batchForm.box_count || 1))
    const rows=Array.from({length:boxCount},()=>({
      product_id:productForm.id,
      branch,
      expiry_date:batchForm.expiry_date,
      quantity:Number(productForm.box_size || 1),
      box_count:1,
      status:'closed'
    }))

    const result=await supabase
      .from('batches')
      .insert(rows)

    error=result.error

    if(!error){
      setBatchForm(emptyBatch)
      await loadData()
      return flash(`${boxCount} kutu eklendi.`)
    }
  }else{
    const result=await supabase
      .from('batches')
      .insert({
        product_id:productForm.id,
        branch,
        expiry_date:batchForm.expiry_date,
        quantity:Number(batchForm.quantity),
        box_count:1,
        status:'closed'
      })

    error=result.error
  }

  if(error) return flash(error.message)

  setBatchForm(emptyBatch)
  await loadData()
  flash('Parti eklendi.')
}"""

rep(old_add, new_add, 'addBatch')

rep(
    """  async function deleteBatch(id){
    if(!confirm('Bu partiyi silmek istiyor musun?'))return""",
    """  async function openBatch(batch){
    const earlier=batches
      .filter(b=>
        b.id!==batch.id &&
        b.product_id===batch.product_id &&
        b.branch===batch.branch &&
        b.status==='closed' &&
        b.expiry_date<batch.expiry_date
      )
      .sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date))

    if(earlier.length){
      const ok=confirm(
        `Daha erken SKT'li kapalı kutu var (${fmt(earlier[0].expiry_date)}). Yine de bu kutuyu açmak istiyor musun?`
      )
      if(!ok) return
    }

    const {error}=await supabase
      .from('batches')
      .update({
        status:'open',
        opened_at:new Date().toISOString()
      })
      .eq('id',batch.id)

    if(error) return flash(error.message)

    await loadData()
    flash('Kutu açık olarak işaretlendi.')
  }

  async function deleteBatch(id){
    if(!confirm('Bu kutu / parti bitti mi? Kayıt listeden kaldırılacak.'))return""",
    'openBatch and deleteBatch'
)

rep(
    """ if(mode==='new'){
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
  }""",
    """ if(mode==='new'){
    if(p){
      openProduct(p)
    }else{
      openNew(code)
    }
    return
  }""",
    'barcode existing product'
)

rep(
    "min_stock:Number(productForm.min_stock||0)}).eq('id',productForm.id)",
    "min_stock:Number(productForm.min_stock||0),box_size:Number(productForm.box_size||1)}).eq('id',productForm.id)",
    'update product box size'
)

rep(
    "update={updateProduct} addBatch={addBatch} changeQty={changeQty} deleteBatch={deleteBatch} deleteProduct={deleteProduct}/>",
    "update={updateProduct} addBatch={addBatch} changeQty={changeQty} openBatch={openBatch} deleteBatch={deleteBatch} deleteProduct={deleteProduct}/>",
    'ProductDetail props'
)

start = text.find('function ProductDetail({')
if start == -1:
    raise SystemExit('Could not find ProductDetail')

new_component = r'''function ProductDetail({
  product,
  setProduct,
  batches,
  batch,
  setBatch,
  update,
  addBatch,
  openBatch,
  deleteBatch,
  deleteProduct
}){
  const isBox=Number(product.box_size)>1
  const sortedBatches=[...batches].sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date))

  return (
    <div>
      <h2>{product.name}</h2>
      <p style={{marginTop:'-6px',color:'#64748b'}}>
        {product.barcode || 'Barkod yok'}
      </p>

      <h3>SKT / Partiler</h3>

      <div className="list compact">
        {sortedBatches.map(b=>(
          <div className="manageBatch" key={b.id}>
            <div>
              <b>{fmt(b.expiry_date)}</b>
              <small>
                {isBox ? '1 kutu' : `${b.quantity} adet`}
                {' · '}
                {b.status==='open' ? '🟢 AÇIK' : '🔒 KAPALI'}
              </small>
            </div>

            <div className="qty">
              {isBox && b.status!=='open' && (
                <button
                  type="button"
                  className="secondary"
                  onClick={()=>openBatch(b)}
                >
                  Kutuyu Aç
                </button>
              )}

              {isBox && b.status==='open' && (
                <button type="button" className="secondary" disabled>
                  ✓ Açık
                </button>
              )}

              <button
                type="button"
                className="dangerBtn"
                onClick={()=>deleteBatch(b.id)}
              >
                Bitti
              </button>
            </div>
          </div>
        ))}

        {!sortedBatches.length &&
          <Empty text="Bu üründe aktif parti yok."/>
        }
      </div>

      <form onSubmit={addBatch} className="addBatch">
        <h3>+ Yeni Parti Ekle</h3>

        {isBox ? (
          <label>
            Kaç Kutu Geldi?
            <input
              type="number"
              min="1"
              required
              value={batch.box_count || 1}
              onChange={e=>setBatch({
                ...batch,
                box_count:e.target.value
              })}
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
              onChange={e=>setBatch({
                ...batch,
                quantity:e.target.value
              })}
            />
          </label>
        )}

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

        <button>Partiyi Ekle</button>
      </form>

      <details style={{marginTop:'18px'}}>
        <summary style={{cursor:'pointer',fontWeight:700}}>
          Ürün bilgilerini düzenle
        </summary>

        <form onSubmit={update} style={{marginTop:'12px'}}>
          <label>
            Ürün Adı
            <input
              value={product.name || ''}
              onChange={e=>setProduct({...product,name:e.target.value})}
              required
            />
          </label>

          <label>
            Barkod
            <input
              value={product.barcode || ''}
              onChange={e=>setProduct({...product,barcode:e.target.value})}
            />
          </label>

          <label>
            Not
            <input
              value={product.notes || ''}
              onChange={e=>setProduct({...product,notes:e.target.value})}
            />
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

      <button
        className="deleteProduct"
        onClick={()=>deleteProduct(product.id)}
      >
        <Trash2 size={18}/> Ürünü Sil
      </button>
    </div>
  )
}
'''

text = text[:start] + new_component
path.write_text(text)
