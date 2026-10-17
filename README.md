# GuswanAI

Workspace AI bertema anime dalam bahasa Indonesia: chat dengan empat persona, editor HTML dengan live preview, dan generator gambar. Node.js 22+; tidak memerlukan dependency runtime.

## Jalankan

```sh
cd /workspace/ytta
npm ci --cache /tmp/guswanai-npm-cache
cp .env.example .env
# Isi GEMINI_API_KEY di .env untuk mengaktifkan AI. Jangan commit file ini.
npm start
```

Server menggunakan port 3000 (dapat diubah melalui `PORT`). `npm run dev` mengaktifkan restart otomatis server. Untuk pengembangan di cloud gunakan checkout yang sudah ada; tidak perlu Git worktree baru.

Tanpa API key, chat dan Code Studio menyediakan contoh **mode demo** yang diberi label. Live preview, edit/unduh HTML, pergantian karakter, unggahan gambar, dan riwayat lokal tetap bekerja. Image Studio membutuhkan API key; tidak membuat gambar palsu saat key belum ada.

## Integrasi AI

Server memanggil Google Gemini melalui HTTPS ke `generativelanguage.googleapis.com` menggunakan header `x-goog-api-key`. Buat API key di Google AI Studio, lalu isi `GEMINI_API_KEY` di `.env` atau secret environment settings. Server juga mendukung `GOOGLE_API_KEY`; key OpenAI tidak digunakan. API key tetap di server.

Model default: `gemini-2.5-flash` untuk chat/kode dan `gemini-2.5-flash-image` untuk gambar. Ubah melalui `GEMINI_CHAT_MODEL` dan `GEMINI_IMAGE_MODEL` sesuai model yang tersedia di akunmu. Model gambar harus mendukung `generateContent`, output gambar, dan `imageConfig.aspectRatio`. Rasio didukung: 1:1, 2:3, dan 3:2. Fitur gambar memerlukan akses model dan kuota yang sesuai; ketersediaan dan biaya mengikuti Google. Restart server setelah mengubah konfigurasi.

Jika sebelumnya memakai konfigurasi OpenAI, hapus requirement secret `GUSWAN_API_KEY` yang lama di environment settings; tambahkan key Gemini sebagai `GEMINI_API_KEY` dengan tujuan `generativelanguage.googleapis.com`. Jangan masukkan key di chat.

Status “Gemini terkonfigurasi” berarti key tersedia, bukan verifikasi kredensial atau kuota. Validasi live: kirim chat, generate kode dari prompt, lalu generate gambar. Belum diuji terhadap penyedia live tanpa key.

## Deploy ke Vercel

Frontend dilayani sebagai file statis dari `public/`. Endpoint `api/chat.js`, `api/images.js`, dan `api/status.js` berjalan sebagai Vercel Node functions; tidak memerlukan server yang menyala terus. Konfigurasi ada di `vercel.json`.

Melalui dashboard:

1. Push seluruh proyek ini ke repository GitHub `guswanreal/ytta` (file lokal belum otomatis masuk GitHub).
2. Di Vercel, pilih **Add New → Project**, lalu import repository tersebut.
3. Pilih preset **Other**, root direktori repository, output directory `public`, dan Node.js 24.x. Tidak ada build command; biarkan konfigurasi repository mengaturnya.
4. Tambahkan `GEMINI_API_KEY` di Environment Variables. Key tetap di server; jangan pakai prefiks `NEXT_PUBLIC_` atau memasukkannya ke file frontend.
5. Klik **Deploy**. Gunakan URL yang diberikan Vercel setelah deployment selesai.

Alternatif CLI, dari direktori proyek pada mesin yang sudah login Vercel:

```sh
npx vercel login
npx vercel
# Tambahkan GEMINI_API_KEY melalui dashboard project, lalu deploy production:
npx vercel --prod
```

Tanpa key web dapat dideploy dalam mode demo. Tambahkan key untuk environment Production (dan Preview jika diperlukan), lalu redeploy agar perubahan variabel diterapkan. Batas durasi fungsi dikonfigurasi 120 detik; tetap mengikuti batas paket Vercel. Respons fungsi Vercel memiliki batas payload, jadi gambar yang terlalu besar bisa ditolak platform. Gunakan Deployment Protection untuk workspace pribadi sebelum mengaktifkan API key berbayar.

`npm test` juga memeriksa adaptor Vercel menggunakan JSON yang sudah diparse oleh platform. Deployment live tetap perlu diverifikasi melalui `/api/status`, chat, preview, dan generate gambar; tes lokal bukan bukti deployment berhasil.

## Empat gambar karakter

Ilustrasi SVG bawaan adalah placeholder orisinal. File PNG lampiran chat belum tersedia sebagai file di workspace. Buka **Karakter → Unggah gambar** pada setiap kartu untuk memasang empat gambar yang kamu miliki. Gambar diperkecil dan disimpan di browser yang sama, bukan di server. Untuk aset bawaan permanen, simpan file di `public/characters/` dan sesuaikan `imageFor()` di `public/app.js`.

## Validasi

```sh
npm test
curl --fail http://127.0.0.1:3000/api/status
```

Tes server mencakup aset, validasi input, mode tanpa key, serta kontrak integrasi chat/gambar dengan respons penyedia tiruan. Live preview berjalan dalam iframe sandbox tanpa akses parent, cookie, form, atau jaringan eksternal; gunakan dokumen HTML mandiri dengan CSS/JS inline. Kode dari AI tetap perlu diperiksa.

Percakapan (maksimal 12 sesi) dan gambar karakter disimpan di localStorage; pengaturan menyediakan penghapusan data lokal. Prompt chat/kode dan prompt gambar dikirim ke penyedia AI ketika fitur live dipakai. Jangan isi prompt dengan rahasia.

Aplikasi ini untuk workspace pribadi. Sebelum dipublikasikan ke internet, tambahkan autentikasi dan pembatasan pemakaian server supaya API berbayar tidak bisa dipakai pengunjung tanpa izin.
