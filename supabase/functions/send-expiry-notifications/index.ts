import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
const supabase = createClient(supabaseUrl, serviceKey)

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

    // TEST BİLDİRİMİ
    if (isTest) {
      const payload = JSON.stringify({
        title: 'StokCep test bildirimi',
        body: 'Bildirim sistemi başarıyla çalışıyor.',
        tag: 'stokcep-test',
        data: { test: true }
      })

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

      return Response.json({
        ok: true,
        test: true,
        sent
      })
    }

    // NORMAL SKT KONTROLÜ
    const target = new Date()
    target.setDate(target.getDate() + 10)
    const targetDate = target.toISOString().slice(0, 10)

    const { data: batches, error } = await supabase
      .from('batches')
      .select('id,expiry_date,quantity,lot_no,products(name,unit)')
      .eq('expiry_date', targetDate)
      .gt('quantity', 0)

    if (error) {
      return new Response(error.message, { status: 500 })
    }

    if (!batches?.length) {
      return Response.json({
        ok: true,
        sent: 0
      })
    }

    let sent = 0

    for (const batch of batches) {
      const { data: existing } = await supabase
        .from('notification_log')
        .select('id')
        .eq('batch_id', batch.id)
        .eq('notification_type', 'expiry_10d')
        .maybeSingle()

      if (existing) continue

      const payload = JSON.stringify({
        title: 'Son kullanma tarihi yaklaşıyor',
        body: `${batch.products?.name || 'Ürün'} için 10 gün kaldı. Stok: ${batch.quantity} ${batch.products?.unit || 'adet'}`,
        tag: `expiry-${batch.id}`,
        data: {
          batch_id: batch.id
        }
      })

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

      await supabase
        .from('notification_log')
        .insert({
          batch_id: batch.id,
          notification_type: 'expiry_10d'
        })
    }

    return Response.json({
      ok: true,
      sent
    })

  } catch (e) {
    return new Response(
      e?.message || 'Beklenmeyen hata',
      { status: 500 }
    )
  }
})
