# StokCep — Kurulum

Bu proje iki kişinin aynı stokları kullandığı, barkod okutabilen ve son kullanma tarihine 10 gün kala push bildirimi gönderen kurulumdur.

## 1) Supabase projesini aç
1. https://supabase.com üzerinden ücretsiz bir proje oluştur.
2. SQL Editor aç, `supabase/schema.sql` dosyasının tamamını çalıştır.
3. Authentication > Users bölümünden iki kullanıcı oluştur. Örnek: kendi e-postan ve arkadaşının e-postası. İkisine ayrı şifre ver.
4. Project Settings > API bölümünden Project URL ve anon/public key değerlerini al.

## 2) Uygulama ayarlarını gir
`.env.example` dosyasını `.env` olarak kopyala ve şu alanları doldur:

```env
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_VAPID_PUBLIC_KEY=...
```

## 3) Push bildirim anahtarlarını oluştur
Bilgisayarda Node.js kuruluysa proje klasöründe:

```bash
npx web-push generate-vapid-keys
```

çıktısındaki public/private anahtarları sakla.

Public key'i `.env` içindeki `VITE_VAPID_PUBLIC_KEY` alanına koy.

Supabase Edge Function secrets bölümüne şunları ekle:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` = kendi e-posta adresin, ör. `mailto:ornek@mail.com`

`send-expiry-notifications` klasörünü Supabase Edge Functions'a deploy et.

Sonra Supabase Dashboard > Cron bölümünde bu fonksiyonu her gün 09:00'da çalışacak şekilde ayarla. Türkiye saati için UTC farkını dikkate al; örneğin 06:00 UTC yaklaşık 09:00 Türkiye saatidir.

## 4) Bilgisayarda test
Node.js 20+ önerilir.

```bash
npm install
npm run dev
```

Açılan adrese girip iki hesaptan da giriş yapabilirsin.

## 5) İnternete yayınla
En kolay yol Vercel:
1. Projeyi GitHub'a yükle.
2. Vercel'de “New Project” ile repo'yu seç.
3. Environment Variables kısmına `.env` içindeki 3 değişkeni ekle.
4. Deploy et.

Netlify/Cloudflare Pages da kullanılabilir.

## 6) iPhone'a uygulama gibi kur
1. Yayındaki adresi Safari'de aç.
2. Paylaş simgesine dokun.
3. “Ana Ekrana Ekle” seç.
4. Ana ekrandaki StokCep ikonundan aç.
5. Uygulama içinde Ayarlar > Bildirimleri aç'a dokun ve izni ver.

Aynı işlemi arkadaşının iPhone'unda da yap. Arkadaşın kendi hesabıyla giriş yapar ama ikiniz aynı ürün ve stok verisini görürsünüz.

## 7) Android'e kur
Chrome'da siteyi aç > menü > Ana ekrana ekle / Uygulamayı yükle. Ardından Ayarlar > Bildirimleri aç.

## Kullanım
- Ürünler > Ürün ekle: ürün adı, barkod, kategori, lot, adet ve SKT eklenir.
- Barkod okut: kayıtlı barkodsa ürün ekranı açılır, kayıtlı değilse yeni ürün oluşturur.
- Aynı ürünün farklı SKT'li partileri ayrı tutulur.
- Parti ekranından + / - ile stok değişir.
- SKT ekranında yaklaşan ve geçmiş tarihler görünür.
- Sunucudaki günlük görev, tam 10 gün kalan partileri bulur ve iki telefona bildirim yollar.

## Güvenlik
Supabase Row Level Security aktiftir; uygulamaya yalnızca oluşturduğunuz kullanıcı hesapları giriş yapabilir. Anon key'in web uygulamasında görünmesi normaldir; Service Role Key kesinlikle uygulamanın `.env` dosyasına veya GitHub'a konmamalıdır.
