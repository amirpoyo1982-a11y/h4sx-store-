# Edit ulasan pelanggan

Store dan Review mempunyai butang **Edit ulasan saya · 10 minit**. Panel pelanggan hanya memaparkan kod asal, nama, rating, teks, gambar profil dan gambar feedback. Tiada kawalan role, badge, centang, pin, laporan atau moderasi.

Backend menetapkan tempoh tepat 10 minit sejak penghantaran pertama. Memuat semula halaman, membaca ulasan atau menyimpan perubahan tidak memanjangkan tempoh. Kod asal sahaja tidak cukup kerana kod turut menjadi sebahagian ID ulasan awam. Cookie `HttpOnly; Secure; SameSite=Strict` membuktikan browser yang menghantar ulasan. Data bukti disimpan dalam `review_edit_grants`, tidak boleh dibaca oleh browser. Gunakan domain/browser asal. Ciri ini tersedia untuk ulasan baharu selepas deployment yang mencipta bukti edit.

`POST /api/review-edit` menerima `load` dan `save`. Load memulangkan medan pelanggan sahaja. Save memerlukan Turnstile dengan action `review_edit`; medan tambahan ditolak. Browser tidak mempunyai kebenaran menulis terus ke `ratings` atau `review_pending`.

Perubahan disimpan dalam `review_pending` dan ulasan diterbitkan dipindahkan ke semakan secara atomik. Medan hiasan admin sedia ada kekal dalam rekod private dan dipulihkan apabila diluluskan. Auto-lulus 30 minit dikira daripada simpanan terkini; tempoh edit pelanggan kekal daripada penghantaran pertama. Ulasan yang ditolak, disorok, dimasukkan tong sampah atau ditandai sebagai penulis admin tidak boleh diedit oleh pelanggan.

Rules sedia ada `match /{document=**} { allow read, write: if false; }` melindungi `review_edit_grants`. Tiada rules awam baharu diperlukan. Untuk dokumentasi jelas, boleh tambah blok berikut sebelum fallback:

```text
match /review_edit_grants/{grantId} {
  allow read, write: if false;
}
```
