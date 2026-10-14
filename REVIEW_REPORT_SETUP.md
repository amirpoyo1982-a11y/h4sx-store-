# Laporan dan auto-sorok

Laporan baharu disimpan oleh `/api/review-report` selepas token Cloudflare disahkan. Firebase transaction menyimpan laporan, had browser/rangkaian/akaun dan kiraan auto-sorok secara serentak.

- Had pelanggan: 3 laporan dalam 60 minit, jarak 60 saat, ulasan sama sekali dalam 24 jam.
- ID browser dan alamat rangkaian dihash dengan HMAC. IP mentah tidak disimpan. Pelawat tanpa login tidak boleh dikenal pasti sebagai orang sebenar; orang pada rangkaian sama berkongsi had rangkaian.
- 3 rangkaian berbeza dalam 24 jam menyebabkan `moderationStatus: hidden` dan `autoHiddenByReports: true`. Ulasan boleh disemak dalam Moderasi → Perlu semakan / Auto-sorok laporan. Ia tidak menggunakan auto-lulus 30 minit.
- Moderasi → Laporan → Munculkan semula / Tutup Lapor / Aktifkan Lapor. Munculkan semula memulakan kumpulan kiraan report baharu. Tutup Lapor turut dikuatkuasakan di backend.
- Admin UID yang disahkan boleh melapor tanpa had, termasuk ulasan yang butang Lapornya ditutup. Report admin biasa tidak dikira untuk auto-sorok. Untuk uji auto-sorok sendiri, buka Moderasi → Laporan → **Aktifkan ujian auto-sorok** pada satu ulasan, kemudian report ulasan itu 3 kali dengan akaun admin. Kiraan ujian diasingkan daripada pelapor awam; ulasan benar-benar disorok pada laporan ketiga. **Munculkan semula** memulihkan ulasan dan mematikan mod ujian. Cloudflare masih diperlukan. Pelawat tidak boleh mengaktifkan mod ujian melalui payload.

## Environment

`TURNSTILE_SECRET_KEY` sedia ada digunakan sebagai kunci HMAC. Tiada environment wajib baharu. Pilihan: `REPORT_HASH_SECRET` berasingan sekurang-kurangnya 32 aksara. Jangan ubah kunci ini ketika laporan masih dalam tempoh had 24 jam kerana hash lama tidak akan sepadan.

## Firestore Rules — wajib untuk menutup laluan tulis client lama

Ganti blok `review_reports` sedia ada dengan blok berikut dalam rules projek `h4sx-6712c`. Backend menggunakan Firebase Admin dan tidak tertakluk kepada rules client. Kekalkan blok lain. Pastikan tiada wildcard lain membenarkan tulis awam ke koleksi ini kerana rules `allow` digabungkan.

```text
match /review_reports/{id} {
  allow read, update, delete: if request.auth != null
    && request.auth.uid == 'LWRN6IDv4OV1PZd7Vldgp6F9pdH3';
  allow create: if false;
}
match /review_report_limits/{id} { allow read, write: if false; }
match /review_report_stats/{id} { allow read, write: if false; }
```

Client baharu menggunakan API. Jika rules lama masih membenarkan `create` awam ke `review_reports`, client yang diubah suai boleh terus menulis laporan di luar had API. Koleksi limits/stats mesti kekal tertutup kepada browser. Ujian automatik tidak menerbitkan rules projek.
