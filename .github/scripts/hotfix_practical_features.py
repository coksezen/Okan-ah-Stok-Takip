from pathlib import Path

app=Path('src/App.jsx')
cssp=Path('src/styles.css')
text=app.read_text()
css=cssp.read_text()

def rep(old,new,label):
    global text
    if old not in text:
        raise SystemExit(f'Could not find: {label}')
    text=text.replace(old,new,1)

# Do not kick branch users back to Needs after every data refresh.
rep(
"""  if(pr?.role==='branch' && pr?.branch){
    setSelectedBranch(pr.branch)
    setTab('needs')
  }
}""",
"""  if(pr?.role==='branch' && pr?.branch){
    setSelectedBranch(pr.branch)
    setTab(current=>current==='home' ? 'needs' : current)
  }
}""",
'branch tab persistence')

# New products opened from Home/quick scan need a branch just like existing products.
rep(
"""  function openNew(barcode=''){ setProductForm({...emptyProduct,barcode}); setBatchForm(emptyBatch); setModal('new') }
  function openProduct(p,quick=false){""",
"""  function openNew(barcode=''){
    setQuickScanAfterSave(false)

    if(profile?.role==='admin' && !productBranch){
      const choice=prompt(
        'Hangi kantin için işlem yapılıyor?\\n1 - Veteriner Fakültesi\\n2 - İktisat Fakültesi\\n3 - Suna UZAL\\n4 - USO'
      )
      const branchMap={'1':'veteriner','2':'iktisat','3':'suna_uzal','4':'uso'}
      const branch=branchMap[choice]
      if(!branch) return flash('Kantin seçilmedi.')
      setProductBranch(branch)
    }

    setProductForm({...emptyProduct,barcode})
    setBatchForm(emptyBatch)
    setModal('new')
  }
  function openProduct(p,quick=false){""",
'openNew branch selection')

# Quick intake form should appear before old batches.
rep(
"""  return (
    <div>
      <div className=\"productDetailHeader\">""",
"""  return (
    <div className={`productDetailRoot ${quickMode ? 'quick' : ''}`}>
      <div className=\"productDetailHeader\">""",
'product detail root class')

css += r'''

/* Quick intake puts the two required fields first */
.productDetailRoot.quick{display:flex;flex-direction:column}
.productDetailRoot.quick .productDetailHeader{order:0}
.productDetailRoot.quick .quickBatchForm{order:1;margin:10px 0 18px}
.productDetailRoot.quick>h3{order:2}
.productDetailRoot.quick .batchGroups{order:3}
.productDetailRoot.quick details{order:4}
.productDetailRoot.quick .deleteProduct{order:5}
'''

app.write_text(text)
cssp.write_text(css)
print('hotfix applied')
