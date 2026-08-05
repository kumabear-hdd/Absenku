# 🏫 AbsenKu

Aplikasi absensi siswa dengan foto & notifikasi real-time untuk orang tua.

## ✨ Fitur

- 📸 **Absen dengan Foto Selfie** - Siswa foto selfie saat masuk/pulang sekolah
- 🔔 **Notifikasi Real-time** - Orang tua langsung tahu saat anak absen (Socket.io)
- 📊 **Dashboard Admin** - Kelola data siswa, lihat rekap absensi
- 👨‍👩‍👧 **Dashboard Orang Tua** - Pantau kehadiran anak secara live
- 📅 **Riwayat & Statistik** - Rekap kehadiran lengkap per siswa

## 🛠️ Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Backend | Node.js + Express.js |
| Database | SQLite (sql.js) |
| Real-time | Socket.io |
| Frontend | HTML + CSS + Vanilla JS |
| Camera | WebRTC (browser native) |
| Auth | Session + bcrypt |

## 🚀 Cara Install & Jalankan

### 1. Clone Repository
```bash
git clone https://github.com/kumabear-hdd/Absenku.git
cd Absenku
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Jalankan Server
```bash
npm start
```

Server berjalan di **http://localhost:3000**

---

## 🔄 Cara Restart Server

Jika server sudah dimatikan, cara menjalankan ulang:

```bash
cd "F:\App absen"
npm start
```

---

## 🗑️ Cara Reset Database

### Local (Komputer Sendiri)
```bash
cd "F:\App absen"
del absenku.db
npm start
```

### Railway (Online)
1. Login sebagai **Admin** di Railway URL
2. Klik tombol **🗑️ Reset Database** di Dashboard Admin
3. Konfirmasi 2x (data siswa & absensi akan dihapus, akun admin tetap ada)
4. Tambah data siswa baru melalui tab **➕ Tambah Siswa**

---

## ⚠️ Troubleshooting

### Port 3000 Sudah Dipakai
```bash
# Cari proses yang pakai port 3000
netstat -ano | findstr :3000

# Matikan prosesnya (ganti <PID> dengan angka yang muncul)
taskkill /F /PID <PID>

# Jalankan lagi
npm start
```

### Node.js Belum Terinstall
Download & install Node.js dari: https://nodejs.org

### npm install Gagal
```bash
# Hapus folder node_modules dan install ulang
rmdir /s /q node_modules
del package-lock.json
npm install
```

---

## 👤 Akun Demo

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `teti06` |
| Siswa (Budi) | `2024001` | `siswa123` |
| Siswa (Siti) | `2024002` | `siswa123` |
| Orang Tua (Budi) | `ortu1` | `ortu123` |
| Orang Tua (Siti) | `ortu2` | `ortu123` |

---

## 📱 Alur Penggunaan

### Siswa
1. Login → Buka kamera → Foto selfie → Absen Masuk/Pulang
2. Foto + waktu terkirim ke server

### Orang Tua
1. Login → Dashboard real-time
2. Notifikasi muncul otomatis saat anak absen
3. Lihat foto selfie anak + waktu absen

### Admin
1. Login → Dashboard statistik
2. Kelola data siswa & orang tua
3. Lihat rekap absensi

---

## 📁 Struktur Project

```
├── server.js          # Express + Socket.io + API
├── database.js        # SQLite database
├── package.json
├── public/
│   ├── index.html     # Landing page
│   ├── login.html     # Login
│   ├── admin.html     # Dashboard admin
│   ├── student.html   # Halaman absen siswa
│   ├── parent.html    # Dashboard orang tua
│   ├── css/style.css  # Styles
│   └── js/
│       ├── app.js     # Shared utilities
│       ├── login.js
│       ├── admin.js
│       ├── student.js
│       └── parent.js
```

---

## 📝 License

MIT
