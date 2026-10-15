# Video feedback melalui link

Tiada Firebase Storage, Blaze atau environment variable video diperlukan.

1. Dalam Hantar Ulasan atau Edit ulasan saya, isi **Link video feedback** dengan pautan HTTPS terus yang berakhir `.mp4` atau `.webm` (query string dibenarkan).
2. Tekan **Pratonton video**, kemudian Play untuk semak video.
3. Hantar / simpan ulasan seperti biasa. Gambar dan video boleh dilampirkan bersama.

Link halaman YouTube, TikTok atau Google Drive bukan fail video terus. Laman host perlu membenarkan video dimainkan dalam browser. Video dimainkan apabila pengunjung menekan **Lihat video**, tanpa autoplay.

Video ikut moderasi ulasan. Link tidak dipaparkan oleh website sebelum kelulusan; admin boleh melihatnya dalam moderasi. Hosting dan akses fail asal diurus oleh pemilik link tersebut.

Gambar feedback boleh diambil dari galeri, kamera, butang **Paste gambar clipboard**, atau Ctrl+V dalam kotak paste. Jika browser menolak akses clipboard, guna kotak Ctrl+V.

Aliran upload Firebase Storage lama telah dibuang. Tidak perlu tambah `REVIEW_VIDEO_BUCKET`, CORS bucket, atau Storage rules.
