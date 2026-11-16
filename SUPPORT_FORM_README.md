# H4SX Store - Support Form Feature

## Deskripsi Feature

Feature ini menambahkan **Support Form** yang memungkinkan pelanggan menghubungi support dengan mudah melalui WhatsApp. Ketika pelanggan menekan tombol "Support", mereka akan diarahkan ke form yang meminta:

1. **Nama** - Nama pembeli
2. **Nomor WhatsApp** - Nomor kontak pelanggan
3. **Jenis Isu** - Pilihan kategori masalah:
   - Laporan Bug / Masalah Teknikal
   - Pesanan Lambat
   - Laporan Scammer
   - Masalah Pesanan
   - Masalah Pembayaran
   - Pertanyaan Umum

4. **Pernyataan Masalah** - Deskripsi detail tentang masalah/pertanyaan

Setelah form diisi dan tombol "Hantar ke WhatsApp" ditekan:
- Sistem **secara otomatis mendeteksi tarikh & waktu saat ini** (Malaysia Time)
- Sistem **membuat pesan terformat** dengan semua informasi dari form
- **Pratonton pesan ditampilkan** sebelum dikirim
- Pelanggan dapat **mengecek dan mengedit nomor WhatsApp** sebelum mengirim
- Pesan dikirim langsung ke **WhatsApp support number** yang dikonfigurasi

## File-file yang Ditambahkan

### 1. `support-form.js`
File JavaScript utama yang menghandle:
- Membuka/menutup form modal
- Validasi input form
- Formatting tanggal dan waktu otomatis (Malaysia Time Zone)
- Generate pesan WhatsApp dengan enkripsi URL
- Konfirmasi sebelum send
- Inisialisasi dropdown jenis isu

### 2. `support-form.css`
File styling yang menghandle:
- Styling modal form
- Styling konfirmasi dialog
- Responsive design untuk mobile dan desktop
- Animasi slide dan fade
- Theme color sesuai dengan design H4SX Store

## Perubahan pada File Existing

### `index.htm`
1. **Tambah CSS link** di section `<head>`:
   ```html
   <link rel="stylesheet" href="support-form.css?v=initial-launch-20261117">
   ```

2. **Update support button di navbar** dari `<a>` tag dengan direct WhatsApp link menjadi `<button>` yang trigger modal:
   ```html
   <button class="btn-wa" id="nav-support-btn" onclick="openSupportForm()">
   ```

3. **Update support button di bottom navigation** dari link menjadi button yang trigger modal

4. **Tambah modal HTML** sebelum closing `</body>`:
   - Support Form Modal
   - Support Confirmation Dialog

5. **Tambah script link** di akhir file:
   ```html
   <script defer src="support-form.js?v=initial-launch-20261117"></script>
   ```

## Fitur Utama

### ✅ Auto-Detect Tarikh & Waktu
- Menggunakan Malaysia Time Zone (UTC+8)
- Format: `Isnin, 17 November 2026, 09:30:45`

### ✅ Validasi Form
- Nama dan nomor WhatsApp wajib diisi
- Kategori isu wajib dipilih
- Deskripsi masalah wajib diisi
- Nomor WhatsApp minimal 10 digit

### ✅ Smart Phone Number Handling
- Otomatis clean dan format nomor
- Support berbagai format input (0123..., 60123..., dll)
- Otomatis convert ke format internasional (+6...)

### ✅ Konfirmasi Pesan
- Pratonton pesan sebelum dikirim
- User dapat melihat exact pesan yang akan dikirim
- Option untuk kembali dan edit form

### ✅ WhatsApp Integration
- Direct link ke WhatsApp dengan pesan sudah terformat
- Auto-fetch nomor support dari store config
- Fallback ke default nomor jika config tidak ada

### ✅ Responsive Design
- Bekerja sempurna di mobile, tablet, dan desktop
- Animasi smooth dan UX yang baik
- Accessibility-friendly (ARIA labels, semantic HTML)

## Konfigurasi

### WhatsApp Number
Nomor WhatsApp support akan diambil dari `currentStoreConfig`:
- `config.whatsapp_link`
- `config.whatsappLink`
- `config.whatsapp_number`
- `config.whatsappNumber`

Jika tidak ditemukan, akan menggunakan default: `60137426830`

### Jenis Isu
Dapat diedit di bagian atas `support-form.js`:
```javascript
const SUPPORT_ISSUE_TYPES = [
  { id: 'bug-report', label: 'Laporan Bug / Masalah Teknikal' },
  // ... tambah lebih banyak sesuai kebutuhan
];
```

## Cara Menggunakan

### Untuk Pelanggan:
1. Tekan tombol "Support" di navbar atau bottom navigation
2. Isi form dengan informasi yang diminta
3. Pilih kategori isu dari dropdown
4. Jelaskan masalah di text area
5. Tekan "Hantar ke WhatsApp"
6. Review pesan di dialog konfirmasi
7. Tekan "Hantar ke WhatsApp" untuk mengirim

### Untuk Admin:
1. Update nomor WhatsApp support di Firebase config
2. Tambah/hapus kategori isu jika diperlukan di `support-form.js`
3. Customize styling jika perlu di `support-form.css`

## Browser Support
- Chrome/Chromium ✅
- Firefox ✅
- Safari ✅
- Edge ✅
- Mobile browsers ✅

## Mobile Optimization
- Form styling khusus untuk mobile
- Touch-friendly buttons
- Keyboard optimization dengan `inputmode` attributes
- Scroll optimization untuk long forms

## Analytics & Tracking
Setiap pesan yang dikirim mencakup:
- Timestamp lengkap (tarikh & waktu)
- Nama pembeli
- Nomor WhatsApp pembeli
- Kategori isu
- Deskripsi masalah

Format ini memudahkan admin untuk track dan categorize support tickets.

## Troubleshooting

### Form tidak muncul
- Pastikan `support-form.js` dan `support-form.css` sudah di-load
- Check browser console untuk error

### WhatsApp link tidak membuka
- Pastikan WhatsApp terinstall atau user akses dari mobile
- Check nomor WhatsApp format sudah benar

### Tarikh/Waktu tidak akurat
- System time di device harus benar
- Timezone sudah di-set ke Malaysia (UTC+8)

## Development Notes

- Feature ini standalone dan tidak mempengaruhi fungsi lain
- Kompatibel dengan existing codebase H4SX Store
- Menggunakan existing `toast()` function untuk notification
- Modal styling mengikuti pattern existing (`order-modal` class)

## Version
- Initial Launch: 2026-11-17
- Version: 1.0
