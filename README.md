# H4SX Store

Storefront statik dan Catalog Control dengan Firebase Realtime Database; endpoint `api/` menggunakan Vercel Node Functions.

- [Setup Firebase sedia ada](FIREBASE-REALTIME-SETUP.md)
- [Auto Sync produk ke Google Sheets — setup, deployment, full sync dan ujian](PRODUCT-SHEETS-SYNC.md)

Ujian sync: `npm ci`, kemudian `npm test` (Node.js 22). Build: `npm run build`.
Auto Sync menggunakan Vercel API + Firebase RTDB + Google Sheets API. Tiada Firebase Blaze,
Cloud Functions atau Cloud Tasks diperlukan. Isi server environment variables dan share Sheet
sebelum deploy; setup lengkap dalam panduan di atas.
