from pathlib import Path

path = Path('src/App.jsx')
text = path.read_text(encoding='utf-8')

old_sync = """      if(action.type==='addNeed'){
        const result=await supabase.from('branch_needs').insert(action.payload)
        error=result.error
      }else if(action.type==='addBatch'){
        const result=await supabase.from('batches').insert(action.payload)
        error=result.error
      }
"""

new_sync = """      if(action.type==='addNeed'){
        const result=await supabase.from('branch_needs').insert(action.payload)
        error=result.error
      }else if(action.type==='mergeNeed'){
        const {data:current,error:readError}=await supabase
          .from('branch_needs')
          .select('quantity,note')
          .eq('id',action.payload.id)
          .maybeSingle()

        if(readError){
          error=readError
        }else if(current){
          const notes=[current.note,action.payload.note]
            .map(v=>(v || '').trim())
            .filter(Boolean)
          const mergedNote=[...new Set(notes)].join(' • ') || null

          const result=await supabase
            .from('branch_needs')
            .update({
              quantity:Number(current.quantity || 0)+Number(action.payload.delta || 0),
              note:mergedNote
            })
            .eq('id',action.payload.id)

          error=result.error
        }
      }else if(action.type==='addBatch'){
        const result=await supabase.from('batches').insert(action.payload)
        error=result.error
      }
"""

if old_sync not in text:
    raise SystemExit('syncOfflineQueue target not found')
text = text.replace(old_sync, new_sync, 1)

start = text.find('async function addNeed(e){')
end = text.find('\n  async function partialNeed', start)
if start == -1 or end == -1:
    raise SystemExit('addNeed function target not found')

new_add_need = r"""async function addNeed(e){
  e.preventDefault()

  if(!selectedBranch) return

  const itemName=needForm.item_name.trim().replace(/\s+/g,' ')
  const unit=(needForm.unit.trim() || 'adet').replace(/\s+/g,' ')
  const quantity=Number(needForm.quantity)
  const note=needForm.note?.trim() || null
  const normalize=value=>(value || '')
    .trim()
    .replace(/\s+/g,' ')
    .toLocaleLowerCase('tr-TR')
  const combineNotes=(oldNote,newNote)=>{
    const notes=[oldNote,newNote]
      .map(v=>(v || '').trim())
      .filter(Boolean)
    return [...new Set(notes)].join(' • ') || null
  }
  const resetForm=()=>setNeedForm({item_name:'',quantity:1,unit:'adet',note:''})

  if(!itemName) return flash('Ürün adı yazmalısın.')
  if(!quantity || quantity<=0) return flash('Adet 1 veya daha fazla olmalı.')

  const payload={
    branch:selectedBranch,
    item_name:itemName,
    quantity,
    unit,
    note
  }

  // Henüz sunucuya gitmemiş aynı çevrimdışı kayıt varsa onu büyüt.
  const localExisting=needs.find(n=>
    n.branch===selectedBranch &&
    !n.completed &&
    !n.picked_up &&
    !n.delivered &&
    normalize(n.item_name)===normalize(itemName) &&
    normalize(n.unit || 'adet')===normalize(unit)
  )

  if(localExisting && String(localExisting.id).startsWith('offline-')){
    const nextQty=Number(localExisting.quantity || 0)+quantity
    const mergedNote=combineNotes(localExisting.note,note)

    setOfflineQueue(prev=>prev.map(action=>{
      if(action.type!=='addNeed') return action
      const p=action.payload || {}
      const same=
        p.branch===selectedBranch &&
        normalize(p.item_name)===normalize(itemName) &&
        normalize(p.unit || 'adet')===normalize(unit)

      return same
        ? {...action,payload:{...p,quantity:Number(p.quantity || 0)+quantity,note:mergedNote}}
        : action
    }))

    setNeeds(prev=>prev.map(n=>
      n.id===localExisting.id
        ? {...n,quantity:nextQty,note:mergedNote}
        : n
    ))

    resetForm()
    return flash(`Aynı ihtiyaç birleştirildi. Toplam ${nextQty} ${unit}.`)
  }

  if(!navigator.onLine){
    if(localExisting){
      const nextQty=Number(localExisting.quantity || 0)+quantity
      const mergedNote=combineNotes(localExisting.note,note)

      addOfflineAction('mergeNeed',{
        id:localExisting.id,
        delta:quantity,
        note
      })

      setNeeds(prev=>prev.map(n=>
        n.id===localExisting.id
          ? {...n,quantity:nextQty,note:mergedNote}
          : n
      ))

      resetForm()
      return flash(`Aynı ihtiyaç birleştirildi. Toplam ${nextQty} ${unit}; internet gelince gönderilecek.`)
    }

    const offlineId=`offline-${Date.now()}`
    addOfflineAction('addNeed',payload)
    setNeeds(prev=>[{
      id:offlineId,
      ...payload,
      created_at:new Date().toISOString(),
      picked_up:false,
      delivered:false,
      completed:false
    },...prev])

    resetForm()
    return flash('İnternet yok. İhtiyaç kaydedildi; bağlantı gelince gönderilecek.')
  }

  // Sunucudaki güncel listeyi kontrol et; aynı aktif ihtiyaç varsa yeni satır açma.
  const {data:branchRows,error:findError}=await supabase
    .from('branch_needs')
    .select('id,item_name,quantity,unit,note,picked_up,delivered,completed')
    .eq('branch',selectedBranch)

  if(findError) return flash(findError.message)

  const existing=(branchRows || []).find(n=>
    !n.completed &&
    !n.picked_up &&
    !n.delivered &&
    normalize(n.item_name)===normalize(itemName) &&
    normalize(n.unit || 'adet')===normalize(unit)
  )

  if(existing){
    const nextQty=Number(existing.quantity || 0)+quantity
    const mergedNote=combineNotes(existing.note,note)

    const {error:updateError}=await supabase
      .from('branch_needs')
      .update({
        quantity:nextQty,
        note:mergedNote
      })
      .eq('id',existing.id)

    if(updateError) return flash(updateError.message)

    resetForm()
    flash(`Aynı ihtiyaç birleştirildi. Toplam ${nextQty} ${unit}.`)
    loadData()
    return
  }

  const {error}=await supabase
    .from('branch_needs')
    .insert(payload)

  if(error) return flash(error.message)

  resetForm()
  flash('İhtiyaç eklendi.')
  loadData()
}
"""

text = text[:start] + new_add_need + text[end:]
path.write_text(text, encoding='utf-8')
print('duplicate-needs merge patch applied')
