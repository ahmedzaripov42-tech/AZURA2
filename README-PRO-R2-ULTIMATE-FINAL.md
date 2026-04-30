# AZURA PRO R2 ULTIMATE FINAL

## Pro daraja qilinganlar

- R2 media pipeline kuchaytirildi
- Galereyadan qo‘shilgan banner video/image dataURL avtomatik R2 ga upload bo‘ladi
- D1 ichida endi katta base64 emas, faqat `/api/media?key=...` URL saqlanadi
- Video bannerlar mobilga mos:
  - muted
  - loop
  - playsinline
  - preload metadata
- Boblar D1 global
- Views D1 global
- Kutubxona D1 global
- Kuchsiz telefonlar uchun Lite mode

## Cloudflare bindinglar

Pages project → Settings → Functions → Bindings:

D1:
- Type: D1 database
- Variable name: DB
- Database: azura_db

R2:
- Type: R2 bucket
- Variable name: MEDIA
- Bucket: azura-media

## Deploy

git add .
git commit -m "Pro R2 ultimate final"
git push

## Deploydan keyin test

1. https://azura2.pages.dev/api/health
2. Owner bilan kir
3. Admin paneldan video banner qo‘sh
4. O‘ng pastdagi ☁ yoki R2 tugmasini bos
5. /api/db och:
   banner media endi `data:video...` emas, `/api/media?key=...` bo‘lishi kerak
6. Telefonda refresh qil

## Cheklov

Bu JSON upload pipeline 20MB gacha media uchun. 20MB+ video uchun keyingi bosqich:
direct signed R2 upload.
