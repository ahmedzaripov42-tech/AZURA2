# AZURA PRO FINAL — User ZIP’dan takomillashtirilgan

## Bu versiyada
- Eski zipdagi admin panel/funksiyalar saqlab qolindi
- D1: users, app_data, chapters, views
- R2: banner image/video media
- R2 tugmasi normal userlarda chiqmaydi
- ☁ tugma faqat owner/adminlarda chiqadi, bosib tortib joyini o‘zgartirish mumkin
- Video banner R2 ga upload bo‘lib D1 ichida `/api/media?key=...` URL saqlaydi
- Boblar D1 orqali global
- Views D1 orqali global
- Kutubxona o‘qilgan/ochilgan manhwani saqlaydi
- Mobil optimizatsiya avtomatik, Lite tugma yo‘q

## Cloudflare binding
Pages → Settings → Functions → Bindings

D1:
Name: DB
Database: azura_db

R2:
Name: MEDIA
Bucket: azura-media

## Deploy
git add .
git commit -m "Pro final sync from stable admin zip"
git push

## Deploydan keyin
1. https://azura2.pages.dev/api/health
2. Owner bilan kir
3. Ctrl+Shift+R
4. ☁ tugmani bos
5. Tekshir:
   - /api/db
   - /api/chapters
   - /api/views

## Muhim
20MB+ video JSON orqali upload qilinmaydi. Video katta bo‘lsa siqib 20MB dan kichik qiling yoki keyingi bosqichda direct signed R2 upload qo‘shiladi.
