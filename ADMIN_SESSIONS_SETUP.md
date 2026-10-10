# Perangkat admin & logout semua sesi

Kod kedua-dua website menggunakan backend yang sama di `https://www.h4sxmy.xyz/api/admin-sessions`.
Backend hanya menerima UID admin H4SX yang telah disahkan oleh Firebase. Ia tidak menerima UID sasaran daripada browser.
Pemasangan tidak menamatkan sesi. Logout semua hanya berlaku apabila admin menekan butang dan mengesahkannya.

## Aktifkan backend di Vercel H4SX Store

1. Buka Firebase Console → projek **h4sx-6712c** → Project settings → Service accounts.
2. Gunakan credential service account Firebase Admin yang sesuai. Jika belum mempunyai fail JSON, pemilik projek boleh memilih **Generate new private key** sendiri.
3. Dalam Vercel, pilih projek **h4sx-store-** → Settings → Environment Variables.
4. Tambah **FIREBASE_SERVICE_ACCOUNT_JSON**. Nilainya ialah seluruh kandungan JSON credential tersebut. Pilih environment **Production**. Simpan sebagai sensitive jika pilihan tersedia.
5. **Jangan** masukkan JSON/private key dalam chat, GitHub, HTML atau JavaScript frontend.
6. Redeploy deployment terbaru website utama. Laman review tidak memerlukan credential berasingan.
7. Refresh kedua-dua website. Website utama: **Admin Profile → Perangkat & Sesi Admin**. Laman review: **Admin → Perangkat & Sesi Admin**.
8. Panel akan merekod browser semasa. Uji di perangkat kedua untuk melihat rekodnya. Ujian logout semua akan mengeluarkan sesi semasa juga; lakukan hanya apabila bersedia login semula.

Alternatif environment: **FIREBASE_CLIENT_EMAIL** dan **FIREBASE_PRIVATE_KEY** daripada service account projek yang sama. `FIREBASE_SERVICE_ACCOUNT_JSON` lebih mudah kerana satu variable.
Backend ditetapkan kepada projek `h4sx-6712c`; credential projek lain ditolak.

## Apa yang direkod

- Jenis perangkat dan browser daripada User-Agent, website kedai/review, masa login dan aktiviti yang direkod.
- Satu browser pada satu website mempunyai rekod sesi sendiri. Telefon yang menggunakan kedua-dua website boleh mempunyai dua rekod.
- Model telefon sebenar tidak sentiasa tersedia; contohnya browser boleh memberikan label umum “Telefon Android”.
- Senarai memaparkan sehingga 100 rekod terbaru. “Belum ditamatkan” bukan bukti perangkat itu sedang online.
- Sejarah sebelum ciri ini diaktifkan tidak boleh dibina semula daripada Firebase Auth.
- Tiada password, ID token, refresh token, lokasi atau alamat IP disimpan dalam rekod perangkat.

Rekod disimpan pada Realtime Database **admin_sessions_private/{uid}/devices** melalui Admin SDK sahaja.
Lokasi ini disahkan menolak bacaan tanpa auth semasa pemasangan (HTTP 401). Kekalkan peraturan root yang tidak membenarkan bacaan awam.
Timestamp pembatalan sahaja berada dalam Firestore **config/admin_session_security**, supaya tab kedua-dua website boleh mengesan logout.

## Tingkah laku logout

Butang menggunakan Firebase Admin `revokeRefreshTokens(uid)`. Sesi semasa terus logout; tab lain yang online mengesan timestamp pembatalan, dan browser yang kembali online menyemak sesi semula.
API mengesahkan ID token dengan `checkRevoked=true`. Pemeriksaan ketika halaman kelihatan berjalan setiap 60 saat tanpa menulis rekod perangkat secara berkala.
ID token lama masih boleh sah sehingga satu jam pada akses database yang rules-nya tidak menyemak pembatalan. Jika perlukan sekatan database serta-merta untuk klien yang mengabaikan logout, rules Firestore dan RTDB perlu diperketat berdasarkan timestamp pembatalan; ia memerlukan audit rules penuh yang sedang dipublish.

Jika credential belum dipasang, panel memaparkan **Backend sesi belum dikonfigurasi** dan butang logout semua dinyahaktifkan. Login dan logout biasa masih berfungsi.

## Logout satu sesi dan padam sejarah

Setiap rekod aktif mempunyai **Logout sesi ini**. Pilih satu rekod untuk logout browser pada website yang ditunjukkan; sesi lain kekal login. Satu telefon yang menggunakan website kedai dan review boleh mempunyai dua rekod berasingan.
Tab yang online mengesan sekatan sesi, atau pada pemeriksaan API berikutnya (biasanya dalam 60 saat). Perangkat offline menyemaknya apabila halaman dibuka semula. Login baharu dibenarkan dan menghasilkan rekod sesi baharu.

Rekod yang telah ditamatkan mempunyai **Padam rekod**. Backend menolak pemadaman rekod aktif. Memadam sejarah tidak memadam penanda sekatan sesi, jadi tab lama tidak boleh mendaftarkan semula rekod yang sama.
Logout biasa juga cuba menandakan sesi semasa sebagai tamat; jika API offline, logout tempatan tetap berfungsi.

Firebase tidak menawarkan pembatalan refresh token untuk satu browser tertentu. Logout individu ini ialah kawalan sesi website dan API H4SX; ia tidak membatalkan refresh token Firebase secara individu atau menyekat penggunaan token itu terus pada SDK/database di luar laman. **Logout semua perangkat** kekal menggunakan pembatalan token Firebase sebenar untuk akaun admin.

Rujukan: https://firebase.google.com/docs/auth/admin/manage-sessions dan https://firebase.google.com/docs/admin/setup
