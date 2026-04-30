# AZURA FULL WORKING GLOBAL SYNC — FINAL

## Bu build ichida tuzatilganlar

- Cloudflare D1 API:
  - /api/health
  - /api/init
  - /api/auth
  - /api/users
  - /api/db
- Login / Register D1 orqali ishlaydi
- Owner login:
  - UID: AZR-YJTF-QYGT
  - Parol: azura2025owner
- Foydalanuvchilar admin panelda D1'dan chiqadi
- VIP / Admin / Coin / Delete D1 orqali ishlaydi
- Bannerlar va admin metadata D1 app_data orqali push/pull qiladi
- Boshqa qurilmalar D1'dan auto-pull qiladi
- Kutubxona menyusi D1-aware qilindi
- ☁ Global Sync tugmasi owner/admin uchun chiqadi

## Muhim cheklov

D1 katta video/PDF/blob fayllar uchun emas. Agar banner video/PDF/WebP juda katta bo'lsa, keyingi bosqichda Cloudflare R2 qo'shish kerak.
Bu build metadata va kichik dataURL/bannerlarni sync qiladi.

## Deploy

Repo papkasida:

git add .
git commit -m "Final AZURA global D1 sync"
git push

Cloudflare deploy tugagach:

1. https://azura2.pages.dev/api/health
   ok:true bo'lishi kerak.

2. https://azura2.pages.dev och
3. Owner bilan kir
4. Ctrl+Shift+R qil
5. O'ng pastdagi ☁ tugmasini bos
6. https://azura2.pages.dev/api/db ochib data ichida:
   - azura_banners_v4
   - azura_manhwa_data_global_v1
   - azura_chapters_pending
   borligini tekshir

## Boshqa qurilmada

Telefon yoki boshqa PCda:
- sayt cache tozalansin
- refresh qilinsin
- 7 soniya ichida D1'dan data tortiladi
