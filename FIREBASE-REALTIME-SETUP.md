# Firebase Realtime Database setup

Kod storefront dan `catalog-control.htm` menggunakan database berikut:

`https://h4sx-6712c-default-rtdb.asia-southeast1.firebasedatabase.app`

1. Buka Firebase Console untuk projek `h4sx-6712c`.
2. Pergi ke **Build > Realtime Database**, cipta database di region Singapore/Asia Southeast jika belum ada.
3. Pastikan akaun admin Email/Password sudah wujud di **Authentication > Users**. Log masuk ke `/catalog-control.htm` dan tekan **Salin UID** di bar atas untuk semak akaun yang sedang digunakan.
4. `firebase-database.rules.json` kini mengandungi UID admin tersebut. Jika akaun admin berubah, gantikan UID lama pada setiap semakan rules dengan UID akaun baru sebelum publish. UID bukan password atau secret.
5. Salin rules ke **Build > Realtime Database > Rules**, kemudian Publish. Semak UID dalam rules sepadan dengan akaun admin sebelum publish supaya akses tidak terkunci.
6. Buka `/catalog-control.htm`, log masuk, pergi ke **Import & Backup**, kemudian tekan **Import ke Firebase** sekali sahaja.
7. Selepas data berjaya diimport, semua edit produk, game dan setting dibuat dari halaman control tersebut dan storefront menerima update secara realtime.

Jika URL database yang Firebase Console beri berbeza, tukar `databaseURL` dalam `app.js` dan `catalog-control.js` kepada URL tepat itu.

Rules yang disertakan membenarkan bacaan katalog awam tetapi hanya **UID admin yang ditetapkan** boleh membaca data peribadi dan mengubah data kedai. Pengguna Phone Auth masih boleh mencipta order/claim baru mengikut validasi sedia ada, tetapi tidak memperoleh akses admin. Fail rules dalam Git tidak diterapkan secara automatik: perubahan hanya aktif selepas rules dipublish di Firebase Console.
