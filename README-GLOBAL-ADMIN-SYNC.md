# AZURA Global Admin Sync Fix

Bu build login/registerdan tashqari admin paneldagi muhim ma'lumotlarni ham D1 app_data orqali global qiladi.

## Global sync qilingan joylar
- Bannerlar: azura_banners_v4
- Promo bannerlar: azura_promo_banners
- Promokodlar: azura_promos
- Bob metadata: azura_chapters_pending
- Adult content metadata: azura_adult_content
- To'lovlar: azura_payments
- Manhwa katalog metadata: MANHWA_DATA → azura_manhwa_data_global_v1
- Kutubxona: user_library_<UID>

## Muhim cheklov
Katta video/PDF/blob fayllar D1 uchun emas. Ular keyingi bosqichda Cloudflare R2 ga o'tkazilishi kerak.
Bu patch metadata va dataURL ko'rinishidagi kichik rasmlarni sync qiladi.

## Deploy
git add .
git commit -m "Add global admin data sync"
git push

Cloudflare deploy tugagach:
1. https://azura2.pages.dev/api/health tekshir
2. Owner bilan kir
3. Admin panelda o'ng pastdagi ☁ tugmasini bosib eski PCdagi ma'lumotlarni globalga push qil
4. Telefon/boshqa qurilmada Ctrl+refresh yoki cache tozalab qayta och
