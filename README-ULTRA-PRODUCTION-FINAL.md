# AZURA ULTRA PRODUCTION FINAL

## Tuzatilganlar
- Lite tugmasi olib tashlandi
- Sayt avtomatik optimizatsiya qilinadi, foydalanuvchi yoqib/o‘chirmaydi
- R2 banner video upload kuchaytirildi
- Banner video/image dataURL → R2 URL → D1
- Boblar D1 orqali global bo‘ladi
- Ko‘rishlar soni D1 orqali global bo‘ladi
- Bob o‘qiganda / manhwa ochilganda kutubxonaga tushadi
- Mobil qotish kamaytirildi: og‘ir animatsiya/hover/glow mobil rejimda yengillashtirildi

## Cloudflare bindinglar
Pages → Settings → Functions → Bindings

D1:
Name: DB
Database: azura_db

R2:
Name: MEDIA
Bucket: azura-media

## Deploy
git add .
git commit -m "Ultra production final"
git push

## Deploydan keyin
1. Owner bilan kir
2. Ctrl+Shift+R
3. ☁ tugmasini bos
4. Console kerak bo‘lsa:
   azuraGlobalForcePushAll()
   azuraMigrateChaptersToD1()
   azuraAttachChaptersFromD1()
5. /api/db da banner media `/api/media?key=...` bo‘lishi kerak.
6. /api/chapters ochib boblar borligini tekshir.
7. /api/views ochib views global ekanini tekshir.
