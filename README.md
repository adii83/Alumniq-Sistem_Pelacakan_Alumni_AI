# AlumniQ - Intelligent Alumni Tracking System 🎓

![AlumniQ Banner](https://adii83.github.io/Alumniq-Sistem_Pelacakan_Alumni_AI/favicon.svg)

AlumniQ adalah sistem pelacakan alumni otomatis yang dirancang untuk membantu perguruan tinggi dalam memperbarui data aktivitas profesional dan akademik alumni melalui berbagai platform publik di internet.

## 🚀 Fitur Utama
Sistem ini diimplementasikan berdasarkan rancangan pada **Daily Project 2**, meliputi:
- **Multi-Platform Tracking**: Melacak jejak digital di LinkedIn, Google Scholar, ResearchGate, GitHub, dan lainnya.
- **Intelligent Scoring**: Algoritma pencocokan berbasis skor untuk memastikan validitas data (Nama, Kampus, dan Prodi).
- **Manual Verification Mode**: Memberikan kendali penuh kepada operator untuk memverifikasi dan memilih bukti terbaik sebelum data disimpan.
- **Audit Evidence**: Menyimpan setiap temuan sebagai bukti audit yang dapat ditinjau kembali kapan saja.
- **Auto-Polling UI**: Antarmuka responsif yang memperbarui status pelacakan secara otomatis (*live*).

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5, Tailwind CSS, JavaScript (ES6+).
- **Backend**: FastAPI (Python), SQLAlchemy ORM.
- **Database**: PostgreSQL (Production), SQLite (Local Development).
- **Server/Hosting**: Render (Backend & DB), GitHub Pages (Frontend).

## 📊 Pengujian Aspek Kualitas (Daily Project 2)

Sesuai dengan aspek kualitas yang ditentukan pada tahap rancangan, berikut adalah hasil pengujian aplikasi:

| Aspek Kualitas | Kriteria Pengujian | Hasil Pengujian | Status |
| :--- | :--- | :--- | :---: |
| **Akurasi (Accuracy)** | Sistem mampu membedakan individu dengan nama yang sama menggunakan sinyal kampus & prodi. | Algoritma *Intelligent Scoring* berhasil memberikan skor tinggi (80-120) pada alumni yang relevan dan skor rendah pada hasil random. | ✅ Pass |
| **Efisiensi (Efficiency)** | Sistem dapat menjalankan pelacakan secara otomatis di latar belakang (*background task*). | Pelacakan berjalan di latar belakang menggunakan `BackgroundTasks` FastAPI sehingga user tidak perlu menunggu di halaman yang sama. | ✅ Pass |
| **Auditability** | Setiap hasil pelacakan disimpan beserta tautan sumbernya sebagai bukti valid. | Sistem menyimpan hingga 10 kandidat terbaik per alumni di tabel `TrackingResult` sebagai bukti otentik. | ✅ Pass |
| **Reviewability** | Operator dapat melakukan verifikasi manual jika hasil otomatis dirasa belum meyakinkan. | Fitur "Tinjau & Simpan" memungkinkan operator memilih kartu bukti secara manual sebelum status berubah menjadi 'Teridentifikasi'. | ✅ Pass |
| **Reliability** | Koneksi database stabil meskipun berjalan di infrastruktur cloud (Render). | Implementasi `pool_pre_ping` dan independen session management menjamin koneksi database tetap hidup saat proses tracking lama. | ✅ Pass |

## 📦 Cara Menjalankan

### Backend (Local)
1. Masuk ke folder `backend`.
2. Install dependensi: `pip install -r requirements.txt`.
3. Jalankan server: `uvicorn main:app --reload`.

### Frontend
1. Pastikan `API_URL` di `app.js` sudah mengarah ke server backend.
2. Buka `index.html` di browser.

## 🌐 Deployment
- **Frontend**: [https://adii83.github.io/Alumniq-Sistem_Pelacakan_Alumni_AI/](https://adii83.github.io/Alumniq-Sistem_Pelacakan_Alumni_AI/)
- **Backend API**: [https://alumni-tracking-backend.onrender.com/docs](https://alumni-tracking-backend.onrender.com/docs)

---
**Slamet Hariyadi** - 202310370311221  
*Rekayasa Kebutuhan B - Universitas Muhammadiyah Malang*
