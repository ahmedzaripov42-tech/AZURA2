# AZURA FINAL — Boblar, Views, Performance

## Qo‘shilganlar
- /api/chapters — boblar D1 database orqali
- /api/views — ko‘rishlar soni global D1 orqali
- js/21-chapters-views-performance-final.js
  - local boblarni D1 ga migratsiya qiladi
  - boshqa userlar boblarni D1 dan oladi
  - views hamma qurilmada bitta bo‘ladi
  - kuchsiz telefonlar uchun Lite/performance mode qo‘shildi
  - bob o‘qiganda manhwa kutubxonaga tushadi

## Deploy
git add .
git commit -m "Fix chapters views and mobile performance"
git push

## Deploydan keyin
1. https://azura2.pages.dev/api/health → ok:true
2. Owner bilan kir
3. Agar eski boblar faqat shu PCda bo‘lsa Console:
   azuraMigrateChaptersToD1()
4. Keyin:
   azuraAttachChaptersFromD1()
5. Boshqa telefonda Ctrl/refresh yoki cache tozalab och

## Muhim
Katta video/PDF fayllar uchun R2 yoki assets/CDN kerak. D1 bob metadata va kichik sahifa URLlarini saqlaydi.
