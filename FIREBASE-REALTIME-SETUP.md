# Firebase Realtime Database setup

Kod storefront dan `catalog-control.htm` menggunakan database berikut:

`https://h4sx-6712c-default-rtdb.asia-southeast1.firebasedatabase.app`

1. Buka Firebase Console untuk projek `h4sx-6712c`.
2. Pergi ke **Build > Realtime Database**, cipta database di region Singapore/Asia Southeast jika belum ada.
3. Salin kandungan `firebase-database.rules.json` ke tab **Rules**, kemudian Publish.
4. Pastikan akaun admin Email/Password sudah wujud di **Authentication > Users**.
5. Buka `/catalog-control.htm`, log masuk, pergi ke **Import & Backup**, kemudian tekan **Import ke Firebase** sekali sahaja.
6. Selepas data berjaya diimport, semua edit produk, game dan setting dibuat dari halaman control tersebut dan storefront menerima update secara realtime.

Jika URL database yang Firebase Console beri berbeza, tukar `databaseURL` dalam `app.js` dan `catalog-control.js` kepada URL tepat itu.

Rules yang disertakan membenarkan bacaan katalog awam tetapi hanya pengguna Firebase Authentication yang sudah log masuk boleh menulis.
