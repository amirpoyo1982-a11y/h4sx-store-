# Review di dalam H4SX Store

Halaman rasmi baharu: **https://www.h4sxmy.xyz/review**.

- Kod penuh berada dalam `review/` dan hanya dimuat pada halaman review.
- Firestore ratings, kod review, role/VIP, nama berwarna, GIF, balasan, moderasi, banner, vote dan alat admin menggunakan projek Firebase sedia ada. Tiada data pelanggan disalin atau dipadam.
- `/api/review-verify-turnstile` mengekalkan pemeriksaan review/report pada hostname utama. Ia menggunakan `TURNSTILE_SECRET_KEY` sedia ada; site key Cloudflare mesti membenarkan hostname utama.
- Homepage, popup review, borang submit dan helper mempunyai pautan ke `/review`.
- Service worker menggunakan cache navigasi berasingan untuk review. Hard refresh review tidak unregister PWA kedai atau memadam cache homepage.
- Login di kedai dan review pada domain utama dikongsi. Sesi ditunjukkan sebagai **H4SX Store & Review**; identiti sesi kedai lama dikekalkan supaya sekatan sesi tidak terbatal.

## Urutan pelepasan

1. Deploy halaman baharu dahulu; domain review lama terus berfungsi.
2. Uji routing/assets, data/rating, carian, badge/GIF, preview admin, banner drag, borang/Turnstile dan sesi admin.
3. Selepas semakan lulus, aktifkan redirect domain lama. Query `preview`, `reviewId` dan `vote` dikekalkan.
4. Mulakan dengan **307 sementara** supaya rollback mudah semasa penggunaan awal. Tukar kepada redirect kekal apabila pemilik berpuas hati dengan operasi halaman baharu.

## Rollback

Jika halaman baharu bermasalah, rollback deployment **REVIEW-CUSTOMER** yang menambah redirect dahulu. Domain lama akan kembali memaparkan sistem review asal. Selepas itu, jika perlu rollback deployment H4SX Store kepada versi sebelum migrasi. Data Firebase kekal sama.

Jangan delete projek Vercel lama atau folder review asal semasa tempoh pemerhatian.

Rujukan: https://vercel.com/docs/project-configuration/vercel-json dan https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
