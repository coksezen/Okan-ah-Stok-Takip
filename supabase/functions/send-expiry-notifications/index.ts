import { createClient } from 'npm:@supabase/supabase-js@2'
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
