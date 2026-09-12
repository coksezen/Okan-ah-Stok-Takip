from pathlib import Path

# 1) Use the exact same calendar-day calculation everywhere in the app.
app_path = Path('src/App.jsx')
app = app_path.read_text(encoding='utf-8')

old_helper = "const daysLeft = d => Math.ceil((new Date(d+'T23:59:59') - new Date()) / 86400000)"
new_helper = """const daysLeft = d => {
  if(!d) return Infinity
  const today=new Date()
  today.setHours(0,0,0,0)
  const expiry=new Date(d+'T00:00:00')
  return Math.round((expiry.getTime()-today.getTime())/86400000)
}"""

if old_helper not in app:
    raise SystemExit('daysLeft helper target not found')
app = app.replace(old_helper, new_helper, 1)

old_warnings = """  const expiryList=[...batches].sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date))
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
"""

new_warnings = """  const expiryList=[...batches].sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date))

const expiryWarnings=batches
  .filter(b=>{
    // Çalışan sadece kendi şubesinin uyarısını görsün
    if(profile?.role==='branch' && b.branch!==profile.branch) return false

    const remaining=daysLeft(b.expiry_date)
    return remaining>=0 && remaining<=10
  })
  .map(b=>({...b,daysLeft:daysLeft(b.expiry_date)}))
  .sort((a,b)=>a.daysLeft-b.daysLeft)
"""

if old_warnings not in app:
    raise SystemExit('expiryWarnings block target not found')
app = app.replace(old_warnings, new_warnings, 1)
app_path.write_text(app, encoding='utf-8')

# 2) Keep the repository Edge Function aligned with the desired 10-day + 3-day notifications.
edge_path = Path('supabase/functions/send-expiry-notifications/index.ts')
edge_path.write_text(r'''import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
const supabase = createClient(supabaseUrl, serviceKey)

function turkeyDateParts(){
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())

  const values = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  }
}

function dateAfterDays(days:number){
  const {year,month,day} = turkeyDateParts()
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return d.toISOString().slice(0,10)
}

async function sendToSubscriptions(subscriptions:any[], payload:string){
  let sent = 0

  for (const s of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: {
            p256dh: s.p256dh,
            auth: s.auth
          }
        },
        payload
      )
      sent++
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', s.id)
      }
    }
  }

  return sent
}

Deno.serve(async (req) => {
  try {
    let isTest = false

    try {
      const body = await req.json()
      isTest = body?.test === true
    } catch {
      isTest = false
    }

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')

    if (subError) {
      return new Response(subError.message, { status: 500 })
    }

    if (!subscriptions?.length) {
      return Response.json({
        ok: true,
        sent: 0,
        message: 'Kayıtlı bildirim cihazı yok'
      })
    }

    if (isTest) {
      const payload = JSON.stringify({
        title: 'StokCep test bildirimi',
        body: 'Bildirim sistemi başarıyla çalışıyor.',
        tag: 'stokcep-test',
        data: { test: true }
      })

      const sent = await sendToSubscriptions(subscriptions, payload)
      return Response.json({ ok: true, test: true, sent })
    }

    let sent = 0
    let matched = 0

    for (const days of [10, 3]) {
      const targetDate = dateAfterDays(days)
      const notificationType = `expiry_${days}d`

      const { data: batches, error } = await supabase
        .from('batches')
        .select('id,expiry_date,quantity,lot_no,products(name,unit)')
        .eq('expiry_date', targetDate)
        .gt('quantity', 0)

      if (error) {
        return new Response(error.message, { status: 500 })
      }

      for (const batch of batches || []) {
        const { data: existing } = await supabase
          .from('notification_log')
          .select('id')
          .eq('batch_id', batch.id)
          .eq('notification_type', notificationType)
          .maybeSingle()

        if (existing) continue
        matched++

        const payload = JSON.stringify({
          title: days === 3 ? 'SKT çok yaklaştı' : 'Son kullanma tarihi yaklaşıyor',
          body: `${batch.products?.name || 'Ürün'} için ${days} gün kaldı. Stok: ${batch.quantity} ${batch.products?.unit || 'adet'}`,
          tag: `expiry-${days}-${batch.id}`,
          data: {
            batch_id: batch.id,
            days_left: days
          }
        })

        sent += await sendToSubscriptions(subscriptions, payload)

        await supabase
          .from('notification_log')
          .insert({
            batch_id: batch.id,
            notification_type: notificationType
          })
      }
    }

    return Response.json({ ok: true, sent, matched })
  } catch (e) {
    return new Response(
      e?.message || 'Beklenmeyen hata',
      { status: 500 }
    )
  }
})
''', encoding='utf-8')

# 3) Update setup documentation: 11:00 Turkey = 08:00 UTC.
doc_path = Path('KURULUM.md')
doc = doc_path.read_text(encoding='utf-8')
doc = doc.replace(
    'Sonra Supabase Dashboard > Cron bölümünde bu fonksiyonu her gün 09:00\'da çalışacak şekilde ayarla. Türkiye saati için UTC farkını dikkate al; örneğin 06:00 UTC yaklaşık 09:00 Türkiye saatidir.',
    'Sonra Supabase Dashboard > Cron bölümünde bu fonksiyonu her gün Türkiye saatiyle 11:00\'da çalışacak şekilde ayarla. Supabase cron UTC kullanıyorsa 08:00 UTC olarak ayarla.'
)
doc_path.write_text(doc, encoding='utf-8')

print('SKT day calculation and notification code patched')
