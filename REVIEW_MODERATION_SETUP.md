# Moderasi dan auto-approve 30 minit

Ulasan pelanggan dihantar melalui /api/review-submit. Cloudflare Turnstile disemak di server. Kod pelanggan digunakan sekali dalam transaksi yang sama dengan simpanan ulasan. Ulasan baru masuk koleksi private review_pending, bukan ratings. Ratings lama kekal. Backend menggunakan Firebase Admin yang telah disediakan untuk sesi admin.

## Cron-job.org

1. Tambah environment variable REVIEW_CRON_SECRET dalam Vercel projek H4SX Store, Production. Guna secret rawak sekurang-kurangnya 32 aksara. Jangan gunakan API key cron-job.org sebagai secret ini.
2. Redeploy Production selepas menambah variable.
3. Create cronjob: URL https://www.h4sxmy.xyz/api/review-auto-approve, method GET, setiap 1 minit, timezone Asia/Kuala_Lumpur.
4. Advanced / Headers: Authorization: Bearer YOUR_REVIEW_CRON_SECRET.
5. Test run, pastikan HTTP 200 dan success:true. Kemudian aktifkan jadual.

401 bermaksud header/secret tidak sepadan. 503 bermaksud env/credential belum sedia atau backend gagal. Cron hanya meluluskan rekod berstatus pending yang sudah cukup 30 minit mengikut masa server. Rekod ditolak, dipadam atau sudah diluluskan tidak diterbitkan semula. Jika jadual gagal, ulasan kekal menunggu; senarai admin tetap boleh digunakan.

## Admin

Review → Admin → Moderasi. Pilih Menunggu semakan, tekan ikon Luluskan atau Tolak. Gambar feedback boleh dilihat sebelum meluluskan. Pilihan Semak ulasan baharu boleh ditutup; ulasan baru selepas itu terus diterbitkan. Rekod pending yang telah dihantar sebelum OFF masih menunggu semakan atau tamat 30 minit.

Auto balas bot dibuat selepas ulasan diluluskan, menggunakan tetapan autoReply terkini. Balasan bot tidak mengubah tempoh semakan.

## Firestore Rules: tutup laluan borang lama

Backend Admin SDK tidak memerlukan public create pada ratings. Dalam Firebase Console → Firestore → Rules, ubah syarat allow create untuk ratings supaya hanya admin boleh create secara langsung:

    match /ratings/{reviewId} {
      allow create: if isAdmin();
      // KEKALKAN syarat read/update/delete yang sedia ada.
    }

Ini adalah perubahan pada blok sedia ada, bukan blok tambahan kedua: syarat allow yang lain boleh tetap memberikan akses. Jangan gantikan keseluruhan Rules dengan contoh pendek di atas. Pastikan tiada allow write/allow create awam lain yang turut meliputi ratings. Ini mencegah pengguna dengan borang lama/cache lama melangkau semakan server.

review_pending mesti tidak mempunyai public read/write. Semakan REST tanpa login semasa pembangunan mengesahkan ratings HTTP 200 dan review_pending HTTP 403. Jika Rules anda berubah kemudian, kekalkan koleksi ini private. Pending/rejected dibaca oleh admin melalui API yang mengesahkan UID admin, bukan browser Firestore.

Tiada jadual berbayar Vercel atau Firebase Cloud Scheduler ditambah. Permintaan cron dan Firebase menggunakan kuota hosting/database sedia ada. Jangan aktifkan satu lagi jadual Vercel untuk URL sama.
