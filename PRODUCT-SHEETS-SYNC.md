# H4SX Store → Google Sheets (Vercel, tanpa Firebase Blaze)

## Architecture

```text
Admin Panel → Firebase RTDB /store/inventory (save asal)
                    ↓ selepas Firebase sahkan save
            POST /api/product-sheet-sync (Firebase ID token)
                    ↓ verify token + allowlist UID
            Vercel Node API + distributed lock dalam RTDB
                    ↓ baca katalog terkini, retry, atomic update
            Google Sheets API → H4SX STORE PRODUCTS
```

Semua kod menggunakan **Vercel + Firebase RTDB + Google Sheets API sahaja**. Tiada Firebase
Cloud Functions, Cloud Tasks, Cloud Scheduler, Blaze atau Google Cloud billing account diperlukan
untuk architecture ini. Google Cloud project sedia ada digunakan untuk enable Sheets API dan
mengurus service account. Kuota dan terma pelan Vercel/Firebase/Sheets tetap terpakai.

Website ialah HTML/CSS/JS statik, admin menggunakan Firebase Auth Email/Password. Produk disimpan
sebagai array di `store/inventory`; admin menulis seluruh array. ID sebenar yang digunakan aplikasi
ialah medan **`id` dalam produk**, bukan indeks RTDB `/0`, `/1` yang berubah selepas DELETE.
Sync mengekalkan identiti itu tanpa menukar schema RTDB. Cart, checkout dan endpoint API asal
tidak diubah. Hook tambahan hanya menghantar event selepas Firebase commit berjaya; kegagalan
Sheets tidak membatalkan save produk, undo, restore atau import.

### Masa sync dan batas tanpa trigger berbayar

- ADD/UPDATE/DELETE/visibility melalui admin → notifier selepas save, debounce ~0.8s → API sync.
- Admin dibuka/log masuk/online semula → sync. Admin aktif juga menyemak setiap 60 saat.
- Transient API failure → sehingga 3 percubaan dalam request; pending/error/backoff disimpan di RTDB.
- Browser retry secara berkala; server menegakkan backoff sehingga 15 minit. Pending intent kekal
  apabila tab ditutup atau request gagal. Cron harian membaca katalog semula walaupun notifier hilang.
- Vercel Hobby membenarkan cron **sekali sehari**, bukan setiap minit. `0 0 * * *` ialah sekitar
  08:00 Malaysia; waktu invocation mungkin dalam jam tersebut, bukan tepat pada minitnya.
- **Perubahan terus di Firebase Console ketika admin ditutup tidak dicetuskan serta-merta.**
  Ia disalin pada cron berikutnya atau apabila admin dibuka/Full Sync ditekan. Jika browser ditutup
  sejurus selepas save sebelum notifier dihantar, cron tetap akan membaikinya pada run berikutnya.
- Sistem ini eventual consistency, bukan audit setiap perubahan. Sheet boleh ketinggalan ketika
  outage/backoff. Had cron ini dinyatakan sengaja; tiada janji retry setiap minit apabila browser tutup.

## Struktur Sheet

| Column | Pemetaan |
| --- | --- |
| `product_id` | `String(product.id)` daripada Firebase; ID `001` kekal teks |
| `name` | `name` |
| `price` | `price` sebagai nombor RM; null/tidak ditetapkan kekal kosong |
| `stock` | `stock`; kosong bukan 0, stok 0 kekal nombor 0 |
| `category` | `category` → `gameGroup` → `game` → `platform` → `subcategory` |
| `image` | `poster` → `image` → `img` → `thumbnail`, URL HTTP(S) |
| `status` | `inactive` jika produk/parent game hidden atau active=false, selain itu `active` |
| `updated_at` | ISO UTC perubahan terakhir nilai row dalam projection; retry tidak mengubahnya |

Status active bermaksud dipaparkan, bukan semestinya in-stock. Consumer mesti semak `stock`.
Satu row per produk utama; `variants`, promo, pesanan dan maklumat pelanggan tidak dieksport.
Jangan anggap harga konsultasi kosong sebagai percuma atau harga asas sebagai semua harga variant.
URL video sedia ada boleh muncul jika medan media produk berisi video; worker tidak menukar media.

ADD tambah satu ID; UPDATE mengekalkan ID; DELETE **mengeluarkan row produk** daripada projection.
Susunan ID sedia ada dikekalkan, ID baru ditambah, deletion memadatkan baki row. Jangan jadikan
nombor row sebagai identifier. Object Firebase dengan key stabil bukan numerik disokong sebagai
fallback jika tiada `id`; key numerik tanpa `id` ditolak. Duplicate ID dalam Firebase ditolak;
duplicate row di Sheet dibaiki oleh Full Sync/cron. ID tidak pernah digantikan dengan indeks array.

## Google Cloud / Firebase setup (tanpa billing)

1. Pilih projek Firebase sedia ada **h4sx-6712c** dalam Google Cloud Console.
2. Enable **Google Sheets API**. Firebase Auth/Realtime Database sedia ada digunakan terus.
   Jangan enable Cloud Functions, Cloud Tasks atau Cloud Scheduler untuk feature ini.
3. Cipta service account khusus, contohnya nama `h4sx-product-sync`.
4. Beri role **Firebase Realtime Database Admin** (`roles/firebasedatabase.admin`) untuk baca
   katalog serta tulis private sync state, dan **Firebase Authentication Viewer**
   (`roles/firebaseauth.viewer`) untuk semak revoked/disabled Firebase ID token.
   Jangan beri Owner. Service account mempunyai akses DB yang luas; simpan key hanya di backend.
5. Cipta JSON key service account untuk penggunaan backend Vercel. Masukkan kandungan penuh
   sebagai `GOOGLE_SERVICE_ACCOUNT_JSON` dalam **Vercel → Settings → Environment Variables**.
   Jangan masukkan fail key ke repository, frontend, Sheet atau chat. Padam salinan download
   apabila selesai mengikut amalan penyimpanan key anda; rotate jika terdedah.
6. Ambil UID admin sebenar daripada **Firebase Authentication → Users**, isi allowlist.

State lock/status/pending berada di `_productSheetSync/<hash-sheet-id-dan-tab>` di luar `store`.
Rules repo asal menafikan client access ke root ini secara default. **Pastikan rules production
tidak memberi `.read: true`/`.write: true` di root atau kepada path ini.** Tiada perubahan pada
`firebase-database.rules.json` diperlukan. API guna service account, bukan rule client untuk lock.
Rules asal `store` membenarkan semua pengguna authenticated menulis; sync tidak memperluaskannya.

## Google Sheet setup

1. Cipta spreadsheet bernama **H4SX STORE PRODUCTS**.
2. Cipta/rename **tab kosong** kepada **H4SX STORE PRODUCTS** juga (nama fail dan tab berasingan).
3. Share kepada email service account sebagai **Editor**. IAM projek sahaja tidak memberi akses fail.
4. Salin ID daripada `https://docs.google.com/spreadsheets/d/<ID>/edit` ke `PRODUCT_SHEET_ID`.
5. Full Sync pertama menulis header A1:H1 dan semua existing products. Tiada entry manual diperlukan.
6. A:H ialah projection yang diurus sync. Jangan edit/sort manual atau tambah formula bebas di situ;
   guna tab lain untuk analisis. Header tidak sepadan → sync berhenti untuk melindungi data.
7. Beri akses baca pada akaun Google Drive/Meta Business Agent dan pilih fail ini sebagai sumber.
   Sambungan/refresh agent perlu dikonfigurasi dalam produk itu sendiri; ia bukan Meta Commerce
   feed lengkap. Jadual ingestion agent boleh berbeza daripada jadual sync Sheet.

## Environment variables — isi sendiri dalam Vercel

| Variable | Nilai |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Secret wajib:** JSON key sebenar service account, termasuk private_key |
| `PRODUCT_SHEET_ID` | **Wajib:** ID spreadsheet sebenar, bukan URL |
| `PRODUCT_SHEET_TAB` | Nama tab, default `H4SX STORE PRODUCTS` |
| `PRODUCT_SYNC_ADMIN_UIDS` | **Wajib:** UID admin Firebase sebenar, pisahkan dengan koma |
| `FIREBASE_DATABASE_URL` | URL RTDB; default projek semasa sudah ada dalam `.env.example` |
| `CRON_SECRET` | **Secret wajib untuk cron:** random string sekurang-kurangnya 32 aksara |

Generate CRON_SECRET di komputer anda, kemudian salin terus ke Vercel:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Jangan gunakan prefix `NEXT_PUBLIC_`/`VITE_` untuk secrets. `.env.example` tidak mengandungi credential
palsu; medan perlu diisi dibiarkan kosong. Local dev boleh guna `.env.local` yang diabaikan Git.
Jangan set credential production pada preview tidak dipercayai. Gunakan Sheet/Firebase staging
berasingan untuk ujian deployment preview; jangan berkongsi Sheet production dengan staging.

## Install / test / deploy Vercel

```sh
npm ci
npm test
npm run build
```

Node.js 22.x ditetapkan dalam package.json. Commit/push/deploy ikut aliran Vercel projek anda.
Di Vercel, **Framework Preset: Other**, build `npm run build`, output directory `public`;
pastikan tiada dashboard override yang menukar tetapan `vercel.json`. Root directory kekal repo.
`api/product-sheet-sync.js` ialah Node serverless function; dua API asal kekal.

Build menyalin **allowlist** aset website sahaja ke `public/`. Folder `server/`, tests, README,
`.env*` dan key tidak disajikan sebagai static files. API membundle modul `server/product-sheets`.
Jangan tukar output directory semula kepada root repo. `public/` dijana, bukan disimpan dalam Git.

Cron `GET /api/product-sheet-sync` hanya menerima `Authorization: Bearer CRON_SECRET` yang Vercel
hantar secara automatik. Tanpa secret sah → 401. `POST` hanya menerima Firebase ID token admin
dalam allowlist; token revoked/disabled ditolak. Tiada produk daripada body browser dipercayai:
backend sentiasa membaca Firebase. Status response tidak dicache dan log tidak mencetak secret.

Cron berjalan pada production deployment. Semak Vercel Cron Jobs selepas deploy; jika deployment
dilindungi, pastikan konfigurasi protection membenarkan cron Vercel rasmi dan uji invocation.
Tanpa cron berjaya, recovery ketika admin ditutup tidak berlaku. Tiada deployment dibuat oleh
perubahan kod ini; secrets, Sheet dan akses akaun sebenar mesti disediakan oleh pemilik.

## Full Sync / Semak Status

Log masuk `/catalog-control.htm` → **Import & Backup → Google Sheets produk**.

- **Full Sync:** reconcile semua existing products walaupun fingerprint tidak berubah, termasuk
  membaiki duplicate row atau edit manual Sheet. Satu permintaan manual setiap 60 saat.
- **Semak Status:** baca lastSuccessAt, product count, pending/error dan backoff daripada private state.
- `running`/`pending`/`retry-pending` **bukan** selesai. Tunggu `success` dengan timestamp baharu.
  Status boleh memaparkan kejayaan terakhir ketika perubahan baru masih pending.

Auto sync boleh berhenti bagi sesi browser selepas konfigurasi/auth gagal; selepas membetulkan
env/UID, tekan Full Sync atau reload admin. Proses simpan produk tetap menggunakan Firebase asal.

## Cara test (staging dahulu)

1. **ADD:** tambah ID baru `100 Robux`, RM4.40, stock 999, category/game Roblox dan URL imej sebenar.
   Save → satu row untuk ID tersebut; status success.
2. **UPDATE:** ubah nama/harga/stok/category/image pada ID sama. Pastikan nilai berubah tanpa
   menambah row; ulang beberapa kali. Uji stock 0 dan hide/unhide produk/parent game.
3. **DELETE:** delete produk awal dalam array. Row ID itu hilang, ID lain tidak berubah walaupun
   indeks RTDB berubah. Delete terakhir → header sahaja. Path inventory null dianggap katalog kosong;
   network/permission failure tidak pernah dianggap katalog kosong.
4. **FULL SYNC:** masukkan existing products sebelum deployment, tekan Full Sync. Tambah duplicate
   row secara manual pada Sheet staging, Full Sync sekali lagi selepas 60s → ID unik semula.
5. **Retry:** tarik akses Editor Sheet sementara, edit produk. Firebase save mesti berjaya; API/log
   menunjukkan kegagalan dan pending. Pulihkan akses, tunggu backoff/retry atau tekan Full Sync.
6. **Concurrency:** edit daripada dua tab admin; request bertindih mendapat pending, bukan dua writer.
   Selepas retry, Sheet mencerminkan Firebase terkini.
7. **Recovery browser tutup:** ubah Firebase Console staging ketika admin ditutup; jalankan cron
   rasmi secara manual dari dashboard Vercel/menunggu jadual, atau buka admin. Perubahan disalin.
8. **Auth:** anonymous/invalid token → 401; UID lain → 403; cron secret salah → 401; tiada Google
   key dalam Network response/browser JS/static `public/`.
9. **Regression:** semak admin publish/edit/delete, undo, import/restore, storefront realtime, cart,
   checkout dan API Roblox/Turnstile selepas deployment staging.

## Konsistensi, retry dan had

Lock menggunakan RTDB REST ETag compare-and-swap, merentasi semua instance Vercel. Setiap request
mendaftarkan pending intent sebelum claim lock; request baru semasa sync tidak hilang. Lock 5 minit
lebih panjang daripada `maxDuration: 60` dan tempoh pemprosesan Sheets. Lease owner diperiksa
sebelum write. Jangan naikkan maxDuration melebihi lease atau menambah writer lain kepada tab ini.

Jika write timeout/5xx mempunyai hasil tidak pasti, lease dikekalkan sehingga tamat untuk mengelak
write lama yang masih diproses Google berlumba dengan writer baharu. `SHEET_WRITE_UNCERTAIN`
boleh menunggu sehingga 5 minit sebelum retry. Crash boleh meninggalkan lease; run selepas expiry
mengambil alih. Jangan buang lock manual ketika request masih berjalan.

Projection ditulis dalam **satu atomic Sheets batchUpdate**, termasuk membersihkan row deleted.
Nama/ID/image disimpan sebagai stringValue, bukan formula. Fingerprint katalog mengelakkan Sheet
API reads/writes berulang untuk katalog sama; Full Sync/cron tetap memeriksa Sheet untuk repair.
Reads Firebase dan status masih menggunakan kuota pelan anda.

Had konservatif: 5,000 produk, 4,000 aksara/medan, payload write 1.8 MB. Melebihi had/duplicate ID/
malformed data → error jelas dan Sheet lama dikekalkan. Sync tidak boleh menjamin ingestion agent
serta-merta atau ketersediaan upstream. API retry dan reconciliation memulihkan setelah upstream pulih.

Vercel Logs: `product_sheet_sync_success`, `product_sheet_retry`, `product_sheet_sync_failed`,
`product_sheet_request_failed`. Kod biasa:
- `SYNC_NOT_CONFIGURED`: isi env sebenar dan redeploy.
- `UPSTREAM_403`: semak IAM, enable Sheets API, share Editor, runtime credential.
- `SHEET_TAB_NOT_FOUND` / `SHEET_HEADER_MISMATCH`: semak tab/header khusus A:H.
- `DUPLICATE_PRODUCT_ID` / `MISSING_PRODUCT_ID`: baiki melalui admin Health Check.
- `SYNC_LEASE_LOST` / `SHEET_WRITE_UNCERTAIN`: pending dilindungi; tunggu retry/lease tamat.

Pantau error, status lastSuccessAt dan invocation cron. Rollback boleh mengeluarkan script/card,
notifier hook, API dan cron daripada deployment; produk dalam `store` tidak perlu diubah.

## Fail implementation dan verification

Root projek: `C:\Users\haziq\OneDrive\Documents\GitHub\h4sx-store-`

Ditambah:

- `api/product-sheet-sync.js`
- `server/product-sheets/adapters.js`, `catalog.js`, `config.js`, `engine.js`, `handler.js`,
  `state-store.js`, `sync.js`
- `product-sheet-sync.js`
- `scripts/build-static.mjs`
- `tests/admin.test.js`, `engine.test.js`, `handler.test.js`, `product-sheets.test.js`, `state-store.test.js`
- `vercel.json`, `package-lock.json`, `.env.example`, `.gitignore`, `.vercelignore`
- `PRODUCT-SHEETS-SYNC.md`

Diubah: `catalog-control.js`, `catalog-control.htm`, `package.json`, `README.md`.
Implementation sementara `functions/` dan `firebase.json` telah dibuang; tiada dependency
`firebase-functions`, queue, scheduler Google Cloud atau endpoint Cloud Functions tinggal.

Verification tempatan: 27 tests lulus pada Node 22.23.3, API import tanpa credential berjaya,
static build allowlist diperiksa, `git diff --check` lulus, npm audit 0 vulnerability.
Tiada live write ke Firebase/Google Sheet, deployment Vercel atau test checkout transaksi dibuat.
Live staging/UAT dalam senarai di atas masih perlu selepas secrets dan Sheet dikonfigurasi.

## Rujukan

- [Vercel Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Firebase REST conditional requests](https://firebase.google.com/docs/database/rest/save-data#section-conditional-requests)
- [Google Sheets batchUpdate](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)
- [Google Sheets API limits](https://developers.google.com/workspace/sheets/api/limits)
