# AZURA D1 Unified Users — NEXT

Bu paket Cloudflare Pages + D1 uchun tayyorlangan.

## Nima qo‘shildi

- Telefon va kompyuter bitta `Cloudflare D1` users bazadan ishlaydi.
- Register/login D1 orqali ishlaydi.
- Owner login:
  - UID: `AZR-YJTF-QYGT`
  - Parol: `azura2025owner`
- Admin Panel → Foydalanuvchilar menyusi D1’dan o‘qiydi.
- VIP berish/olish, Admin berish/olish, Coin, Delete — D1’da saqlanadi.
- Local eski userlar birinchi yuklanishda D1’ga migrate bo‘ladi.

## Cloudflare sozlama

Pages project → Settings → Bindings → D1 database:

```text
Variable name: DB
D1 database: azura_db
```

## Birinchi ishga tushirish

Deploydan keyin brauzerda och:

```text
https://SENING-DOMENING/api/init
```

Agar `ok: true` chiqsa tayyor.

## Fayllar

- `functions/api/init.js`
- `functions/api/health.js`
- `functions/api/auth.js`
- `functions/api/users.js`
- `functions/api/db.js`
- `functions/api/_common.js`
- `js/14-d1-unified-users.js`
- `index.html` ichiga script qo‘shilgan

## Eslatma

Banner, bob PDF/WebP, katta media fayllar hali local/IndexedDB’da qoladi.
Bu paket 1-bosqich: USERS / AUTH / ADMIN USERS / VIP / COIN / ROLE ni global D1’ga o‘tkazadi.
