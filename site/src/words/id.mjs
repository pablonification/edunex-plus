// Every word on the website, in Indonesian (the default: the readers are ITB students). en.mjs has the
// same keys in English. Written the way the app's own words are (.agents/skills/copywriting): kamu, everyday
// words, the shortest true sentence. A name on a system's own screen comes with its English in brackets,
// since a phone or laptop may be set to either language.
export default {
  code: "id",
  locale: "id_ID",
  name: "Indonesia",
  switchTo: "English",

  nav: {
    home: "Beranda Edunex Plus",
    features: "Fitur",
    install: "Cara pasang",
    faq: "Tanya jawab",
    get: "Pasang gratis",
    menu: "Menu",
    skip: "Langsung ke isi",
    language: "Bahasa",
    crumbs: "Jejak halaman",
  },

  devices: {
    android: "Android",
    iphone: "iPhone",
    windows: "Windows",
    mac: "Mac",
    linux: "Linux",
  },

  cta: {
    install: "Pasang di {device}",
    installGeneric: "Pasang gratis",
    features: "Lihat fiturnya",
    how: "Lihat cara pasang",
    others: "perangkat lain",
    free: "Gratis untuk Android, iPhone, Windows, Mac, dan Linux",
    version: "Versi {version}",
  },

  home: {
    title: "Edunex Plus: Edunex dan SIX di satu aplikasi untuk mahasiswa ITB",
    description:
      "Aplikasi gratis untuk mahasiswa ITB. Tugas, jadwal, presensi, dan nilai dari Edunex dan SIX di satu tempat. Untuk Android, iPhone, Windows, Mac, dan Linux.",
    ogTitle: "Edunex Plus: Edunex dan SIX, akhirnya di satu tempat",
    ogDescription: "Aplikasi gratis buatan mahasiswa ITB. Tugas, jadwal, presensi, dan nilaimu di satu aplikasi, di HP dan laptop.",
    ogAlt: "Edunex Plus: Edunex dan SIX, akhirnya di satu tempat. Layar Beranda aplikasi di HP dan laptop.",
    card: "Gratis untuk mahasiswa ITB · HP dan laptop",

    hero: {
      badge: "Buatan mahasiswa ITB · bukan aplikasi resmi",
      title: ["Edunex dan SIX,", "akhirnya di satu tempat."],
      sub: "Tugas, jadwal, presensi, dan nilaimu di satu aplikasi. Gratis, untuk HP dan laptop.",
      laptopAlt: "Beranda di laptop: kuliah yang sedang berjalan dengan ruangannya, kuliah hari ini, dan yang berubah",
      phoneHomeAlt: "Beranda di HP: kuliah yang sedang berjalan, tombol Isi Presensi, tenggat terdekat, dan layanan SIX dan Edunex",
      phoneScheduleAlt: "Jadwal di HP: kuliah minggu ini dengan ruangannya, dan dua kuliah yang bentrok",
    },

    what: {
      label: "Apa itu Edunex Plus",
      title: "Satu aplikasi yang membaca Edunex dan SIX untukmu.",
      body: "Biasanya kamu bolak-balik. Edunex untuk tugas dan materi, SIX untuk jadwal, kehadiran, dan nilai. Edunex Plus masuk dengan akun ITB-mu sendiri, membaca keduanya, lalu memberi tahu apa yang perlu kamu urus hari ini.",
      points: [
        { title: "Masuk sekali", body: "Pakai akun ITB-mu di halaman Microsoft yang asli. Edunex dan SIX langsung terhubung." },
        { title: "Semua di satu tempat", body: "Tugas, ujian, jadwal, ruangan, presensi, nilai, KRS, dan UKT." },
        { title: "Gratis dan terbuka", body: "Tanpa iklan. Kodenya terbuka di GitHub, siapa pun bisa memeriksanya." },
      ],
      sourcesTitle: "Yang dibaca aplikasi",
      sources: [
        { name: "Edunex", body: "Tugas, materi, ujian, dan Presensi" },
        { name: "SIX", body: "Jadwal dan ruangan, kehadiran, nilai, KRS, dan UKT" },
        { name: "Kalender akademik", body: "Masa UTS dan UAS, jadwal KRS, hari libur" },
        { name: "Katalog mata kuliah", body: "Kurikulummu dan SKS yang tersisa" },
      ],
      into: "Edunex Plus",
    },

    features: {
      label: "Fitur",
      title: "Buka aplikasi, langsung tahu harus apa.",
      body: "Namanya sama seperti di Edunex dan SIX, jadi tidak ada yang perlu dipelajari lagi.",
      items: {
        home: {
          name: "Beranda",
          title: "Kuliah apa sekarang, di ruang mana.",
          body: "Kuliah yang sedang berjalan, kapan presensinya ditutup, dan tenggat terdekat. Semua di layar pertama.",
          alt: "Beranda: kuliah Ekonomi dan Inovasi dalam Perencanaan sedang berjalan di R.SG PWK LT.6, dengan tombol Isi Presensi",
        },
        tasks: {
          name: "Tugas & Ujian",
          title: "Semua tenggat, dengan status aslinya.",
          body: "Belum dikerjakan, draf, atau sudah dikumpulkan, dari semua mata kuliah. Kumpulkan langsung dari aplikasi.",
          alt: "Tugas: UTS minggu depan dengan hari dan ruangannya, lalu Tugas 02 Bab II dengan tenggatnya",
        },
        presence: {
          name: "Presensi",
          title: "Tahu sisa jatah absenmu.",
          body: "SIX bilang “Hadir 4 dari 6”. Edunex Plus bilang kamu masih boleh absen berapa kali lagi, sebelum terlambat.",
          alt: "Kuliah: tiap mata kuliah dengan sisa jatah absennya, dari absen habis sampai sisa 2 absen",
        },
        schedule: {
          name: "Jadwal",
          title: "Seminggu penuh, lengkap dengan ruangan.",
          body: "Termasuk kelas pengganti yang hanya diumumkan di Edunex, dan peringatan kalau dua kuliah bentrok.",
          alt: "Jadwal minggu ini: tiga kuliah hari Kamis, dua di antaranya bentrok",
        },
        grades: {
          name: "Nilai",
          title: "IPK-mu sekarang, dan nanti.",
          body: "Isi perkiraan nilaimu semester ini, lalu lihat IPK-mu jadi berapa. Bisa disembunyikan kalau ada yang mengintip.",
          alt: "Nilai: IPK 3,26, perkiraan 3,29 setelah semester ini, dan 125 dari 144 SKS lulus",
        },
        alerts: {
          name: "Notifikasi",
          title: "Tahu selagi masih sempat.",
          body: "Tugas baru, tenggat 3 jam lagi, presensi dibuka, jadwal berubah. Yang tidak mendesak menunggu sampai pagi.",
          notes: [
            { title: "Presensi dibuka · II4091", body: "Kumpulkan Tugas 02 Bab II · ditutup 23:59", time: "sekarang" },
            { title: "Tenggat 3 jam lagi · PL3002", body: "Tugas 03 · masih draf, belum dikumpulkan", time: "12:00" },
            { title: "Tugas baru · DK4073", body: "Kuis Kilat Bab 5", time: "09:12" },
          ],
        },
      },
      more: [
        "Materi kuliah (Word, PowerPoint, PDF) terbuka di aplikasi dan bisa disimpan untuk offline",
        "KRS, tagihan UKT, dan kalender akademik ITB",
        "Widget di layar utama HP",
        "Terang dan gelap, Indonesia dan Inggris",
      ],
      never: "Edunex Plus tidak pernah mengisi presensi untukmu dan tidak pernah mengubah KRS-mu.",
    },

    everywhere: {
      label: "HP dan laptop",
      title: "Di saku saat ke kelas, di meja saat mengerjakan tugas.",
      body: "Aplikasi yang sama di Android, iPhone, Windows, Mac, dan Linux. Masuk di tiap perangkat, datanya dibaca langsung dari Edunex dan SIX.",
      phone: "HP",
      laptop: "Laptop",
      laptopAlt: "Tugas & Ujian di laptop: ujian di masa UTS dan tugas minggu depan, dengan mata kuliah dan tenggatnya",
    },

    privacy: {
      label: "Keamanan",
      title: "Kata sandimu tidak pernah sampai ke aplikasi.",
      body: "Wajar kalau ragu memasukkan akun ITB ke aplikasi buatan mahasiswa. Begini cara kerjanya.",
      points: [
        { title: "Kamu masuk di halaman Microsoft yang asli", body: "Halaman masuk ITB yang biasa kamu lihat. Hanya Microsoft yang menerima kata sandimu." },
        {
          title: "Datamu tinggal di perangkatmu",
          body: "Yang dibaca aplikasi disimpan di HP atau laptopmu saja, dan tanda masukmu dikunci oleh sistem perangkatmu. Tidak ada server Edunex Plus yang menampungnya.",
        },
        {
          title: "Tanpa iklan, tanpa pelacakan",
          body: "Tidak ada analitik. Aplikasi hanya menghubungi Edunex, SIX, halaman publik ITB, dan GitHub untuk pembaruan. Notifikasi ke HP dan laporan masalah hanya jalan kalau kamu menyalakan atau mengirimnya.",
        },
        {
          title: "Bisa dihapus kapan saja",
          body: "“Keluar & hapus data” di Pengaturan mengeluarkanmu dan menghapus mata kuliah, nilai, rencana, dan catatanmu dari perangkat.",
        },
      ],
      flow: [
        { who: "Kamu", what: "mengetik kata sandi" },
        { who: "Halaman Microsoft milik ITB", what: "memeriksa kata sandimu" },
        { who: "Edunex Plus", what: "hanya menerima tanda masuk" },
      ],
      flowAlt: "Kamu mengetik kata sandi di halaman Microsoft milik ITB. Edunex Plus hanya menerima tanda masuk, bukan kata sandimu.",
      link: "Baca rinciannya: apa saja yang dihubungi aplikasi",
    },

    install: {
      label: "Cara pasang",
      title: "Pilih perangkatmu, ikuti gambarnya.",
      body: "Tiap panduan menunjukkan layar yang akan kamu lihat dan tombol mana yang ditekan.",
      yours: "Perangkatmu",
      open: "Lihat langkahnya",
      cards: {
        android: { time: "± 2 menit", body: "Unduh satu berkas di HP-mu, ketuk, lalu pasang." },
        iphone: { time: "± 10 menit", body: "Lewat laptop dan kabel, karena belum ada di App Store." },
        windows: { time: "± 2 menit", body: "Unduh, buka, lalu klik “Tetap jalankan”." },
        mac: { time: "± 3 menit", body: "Seret ke Applications, lalu tempel satu baris di Terminal." },
        linux: { time: "± 2 menit", body: "Satu perintah untuk Ubuntu dan Debian, atau AppImage." },
      },
      warnTitle: "Kenapa HP atau laptopku memberi peringatan?",
      warnBody:
        "Karena Edunex Plus belum terdaftar di Play Store, App Store, atau Microsoft. Mendaftar butuh biaya, dan aplikasi ini masih alpha. Peringatan itu muncul untuk semua aplikasi yang belum terdaftar, bukan karena ada yang ditemukan. Panduannya menunjukkan cara melewatinya.",
    },

    faq: {
      label: "Tanya jawab",
      title: "Yang sering ditanyakan",
      items: [
        {
          q: "Apakah ini aplikasi resmi ITB?",
          a: "Bukan. Edunex Plus dibuat mahasiswa ITB. Aplikasi ini tidak dibuat, didukung, atau terhubung dengan ITB maupun Cognisia, perusahaan di balik Edunex. Aplikasi memakai akun Edunex dan SIX-mu sendiri, jadi akunmu tetap tanggung jawabmu.",
        },
        { q: "Apakah gratis?", a: "Gratis, tanpa iklan. Kodenya terbuka dengan lisensi MIT." },
        {
          q: "Apakah kata sandiku aman?",
          a: "Kamu masuk di halaman Microsoft milik ITB yang asli, jadi hanya Microsoft yang menerima kata sandimu. Aplikasi hanya menyimpan tanda masuk yang diberikan halaman itu, terkunci di perangkatmu.",
        },
        {
          q: "Apa bedanya dengan membuka Edunex dan SIX langsung?",
          a: "Datanya sama. Edunex Plus menggabungkannya, menghitung sisa jatah absenmu, dan mengingatkanmu sebelum tenggat. Edunex dan SIX tetap bisa kamu buka seperti biasa.",
        },
        {
          q: "Apakah aplikasi ini mengisi presensi otomatis?",
          a: "Tidak. Aplikasi memberi tahu saat presensi dibuka dan mengantarmu ke tombolnya. Yang menekan tetap kamu.",
        },
        {
          q: "Kenapa muncul peringatan saat memasang?",
          a: "Karena aplikasinya belum terdaftar di Play Store, App Store, atau Microsoft. Peringatan itu muncul untuk semua aplikasi yang belum terdaftar. Tiap panduan pasang menunjukkan tombol mana yang ditekan.",
        },
        {
          q: "Bisa dipasang di iPhone?",
          a: "Bisa, tapi lewat laptop karena belum ada di App Store, dan perlu diulang tiap 7 hari. Panduan iPhone menjelaskan langkahnya.",
        },
        {
          q: "“Masih alpha” itu maksudnya apa?",
          a: "Masih tahap uji awal, jadi bisa ada yang salah baca. Untuk hal penting seperti pengumpulan tugas dan jumlah kehadiran, cek juga di Edunex atau SIX. Kalau ada yang rusak, laporkan lewat “Laporkan masalah” di aplikasi atau di GitHub.",
        },
        {
          q: "Bagaimana cara memperbarui?",
          a: "Aplikasi mengecek versi baru sekali sehari. Di Windows dan Mac, pembaruan diunduh dan dipasang sendiri. Di Android, buka Pengaturan lalu Tentang. Di iPhone, pasang ulang berkas barunya lewat Sideloadly.",
        },
      ],
    },

    closing: {
      title: "Berhenti bolak-balik dua situs.",
      body: "Pasang, masuk sekali, lalu lihat apa yang perlu kamu urus hari ini.",
      backer: "Didukung oleh",
    },
  },

  install: {
    title: "Cara pasang Edunex Plus di HP dan laptop",
    description: "Panduan bergambar memasang Edunex Plus di Android, iPhone, Windows, Mac, dan Linux. Pilih perangkatmu dan ikuti langkahnya.",
    h1: "Cara pasang Edunex Plus",
    lead: "Pilih perangkatmu. Tiap panduan menunjukkan layar yang akan kamu lihat dan tombol mana yang ditekan.",
    crumb: "Cara pasang",
    before: {
      title: "Sebelum mulai",
      items: [
        "Kamu butuh akun ITB yang biasa dipakai masuk Edunex dan SIX.",
        "HP atau laptopmu akan memberi peringatan, karena aplikasinya belum terdaftar di toko aplikasi. Itu wajar, dan panduannya menunjukkan cara melewatinya.",
        "Aplikasi ini masih alpha. Untuk hal penting, cek juga di Edunex atau SIX.",
      ],
    },
    guide: {
      needs: "Yang kamu butuhkan",
      time: "Waktu",
      step: "Langkah {n}",
      download: "Unduh",
      notYet: "Berkas untuk {device} belum ada di rilis terbaru. Buka halaman rilis untuk melihat yang tersedia.",
      releasePage: "Halaman rilis",
      copy: "Salin",
      copied: "Tersalin",
      troubleTitle: "Kalau ada kendala",
      afterTitle: "Setelah terpasang",
      updateTitle: "Memperbarui",
      removeTitle: "Menghapus",
      othersTitle: "Perangkat lain",
      full: "Panduan lengkap di GitHub (bahasa Inggris)",
      report: "Masih tersangkut? Ceritakan di GitHub",
      picNote: "Gambar hanya ilustrasi. Tampilan di perangkatmu bisa sedikit berbeda.",
      signIn: {
        title: "Masuk dengan akun ITB",
        phone:
          "Buka <strong>Edunex Plus</strong>, lalu ketuk <strong>Masuk dengan akun ITB</strong>. Halaman Microsoft milik ITB terbuka, sama seperti saat kamu masuk ke Edunex.",
        computer:
          "Buka <strong>Edunex Plus</strong>, klik <strong>Mulai</strong>, lalu hubungkan Edunex. Halaman Microsoft milik ITB terbuka, sama seperti saat kamu masuk ke Edunex.",
        once: "Sekali saja. Edunex dan SIX terhubung dari satu kali masuk itu, dan kata sandimu tidak pernah sampai ke Edunex Plus.",
        phoneAlt: "Layar pertama Edunex Plus di HP dengan tombol Masuk dengan akun ITB",
        computerAlt: "Layar pertama Edunex Plus di laptop dengan tombol Mulai",
      },
    },
  },

  guides: {
    android: {
      title: "Cara pasang Edunex Plus di Android",
      description: "Pasang Edunex Plus di HP Android dalam 2 menit: unduh berkas APK, izinkan pemasangan, lalu masuk. Dengan gambar tiap langkah.",
      h1: "Pasang di Android",
      lead: "Edunex Plus belum ada di Play Store, jadi aplikasinya datang sebagai satu berkas APK. Kamu unduh, ketuk, lalu pasang.",
      time: "± 2 menit",
      needs: ["HP Android 8 atau lebih baru"],
      steps: [
        {
          title: "Unduh berkasnya di HP-mu",
          body: [
            "Buka halaman ini di HP, lalu ketuk tombol di bawah.",
            "Kalau browser bertanya apakah berkasnya mau disimpan, pilih <strong>Tetap download</strong> (Download anyway).",
          ],
          download: ["android"],
          pic: "androidDownload",
        },
        {
          title: "Buka berkas yang baru diunduh",
          body: [
            "Ketuk <strong>Buka</strong> (Open) di pemberitahuan unduhan. Kalau sudah hilang, buka aplikasi <strong>File</strong> (Files), lalu folder <strong>Download</strong>.",
          ],
          pic: "androidOpen",
        },
        {
          title: "Izinkan browser memasang aplikasi",
          body: [
            "Android bertanya dulu, karena berkasnya bukan dari Play Store. Ketuk <strong>Setelan</strong> (Settings), nyalakan <strong>Izinkan dari sumber ini</strong> (Allow from this source), lalu ketuk tombol kembali.",
            "Izin ini hanya untuk browser yang kamu pakai, dan bisa dimatikan lagi setelah selesai.",
          ],
          pic: "androidAllow",
        },
        {
          title: "Ketuk Instal",
          body: [
            "Ketuk <strong>Instal</strong> (Install).",
            "Kalau Play Protect bilang tidak mengenali aplikasinya, ketuk <strong>Detail selengkapnya</strong> (More details), lalu <strong>Tetap instal</strong> (Install anyway). Play Protect memperingatkan karena aplikasinya bukan dari Play Store, bukan karena menemukan sesuatu.",
          ],
          pic: "androidInstall",
        },
      ],
      trouble: [
        {
          q: "Muncul “Aplikasi tidak terinstal”",
          a: "Biasanya karena masih ada salinan uji coba lama di HP-mu. Hapus dulu Edunex Plus yang lama, lalu pasang lagi.",
        },
        {
          q: "Berkasnya tidak ketemu",
          a: "Buka aplikasi File (Files) atau File Saya (My Files), lalu folder Download. Namanya diawali Edunex-Plus dan berakhiran .apk.",
        },
        {
          q: "Tombol Instal tidak bisa ditekan",
          a: "Tutup aplikasi yang tampil di atas layar, seperti filter cahaya biru atau gelembung obrolan, lalu coba lagi.",
        },
      ],
      update:
        "Buka <strong>Pengaturan</strong>, lalu <strong>Tentang</strong>. Kalau ada versi baru, ketuk <strong>Unduh &amp; pasang</strong>. Data dan tanda masukmu tetap ada.",
      remove: "Tahan ikon Edunex Plus di layar utama, pilih <strong>Info aplikasi</strong> (App info), lalu <strong>Uninstal</strong> (Uninstall).",
    },

    iphone: {
      title: "Cara pasang Edunex Plus di iPhone",
      description: "Pasang Edunex Plus di iPhone lewat laptop dengan Sideloadly dan Apple ID-mu sendiri. Panduan bergambar, sekitar 10 menit.",
      h1: "Pasang di iPhone",
      lead: "Apple hanya mengizinkan aplikasi dari App Store, kecuali kamu menandatanganinya dengan Apple ID-mu sendiri. Edunex Plus belum ada di App Store, jadi kamu memasangnya lewat laptop dengan alat gratis bernama Sideloadly.",
      time: "± 10 menit pertama kali",
      needs: ["iPhone dengan iOS 16.4 atau lebih baru", "Laptop Mac atau Windows", "Kabel iPhone", "Apple ID (gratis, boleh akun cadangan)"],
      callout: {
        title: "Perlu diulang tiap 7 hari",
        body: "Aplikasi yang ditandatangani Apple ID gratis berhenti terbuka setelah seminggu. Sebelum itu, colokkan iPhone ke laptop dan klik Start lagi di Sideloadly. Data dan tanda masukmu tetap ada.",
      },
      steps: [
        {
          title: "Di laptop, unduh aplikasinya dan Sideloadly",
          body: [
            'Unduh berkas <strong>.ipa</strong> dengan tombol di bawah, lalu pasang <a href="https://sideloadly.io" target="_blank" rel="noopener noreferrer">Sideloadly</a>.',
            "Di Windows, pasang juga <strong>iTunes</strong> dan <strong>iCloud</strong> dari situs Apple, bukan versi Microsoft Store, supaya Sideloadly bisa melihat iPhone-mu.",
          ],
          download: ["iphone"],
          pic: "ipaAndSideloadly",
        },
        {
          title: "Sambungkan iPhone ke laptop",
          body: [
            "Colokkan iPhone dengan kabelnya, lalu buka kuncinya. Kalau muncul <strong>Percayai Komputer Ini?</strong> (Trust This Computer?), ketuk <strong>Percayai</strong> (Trust).",
          ],
          pic: "iosTrust",
        },
        {
          title: "Pasang lewat Sideloadly",
          body: [
            "Buka Sideloadly. Pilih iPhone-mu, ketik Apple ID-mu, seret berkas <strong>.ipa</strong> ke jendelanya, lalu klik <strong>Start</strong>.",
            "Ketik kata sandi Apple ID saat diminta, lalu kode yang dikirim Apple kalau ada. Kata sandimu hanya dikirim ke Apple.",
          ],
          pic: "sideloadly",
        },
        {
          title: "Nyalakan Mode Pengembang di iPhone",
          body: [
            "Buka <strong>Pengaturan</strong> (Settings) › <strong>Privasi &amp; Keamanan</strong> (Privacy &amp; Security) › <strong>Mode Pengembang</strong> (Developer Mode), lalu nyalakan.",
            "iPhone menyala ulang, lalu minta konfirmasi. Ketuk <strong>Nyalakan</strong> (Turn On).",
          ],
          pic: "iosDevMode",
        },
        {
          title: "Percayai Apple ID-mu",
          body: [
            "Buka <strong>Pengaturan</strong> › <strong>Umum</strong> (General) › <strong>VPN &amp; Manajemen Perangkat</strong> (VPN &amp; Device Management). Ketuk Apple ID-mu, lalu <strong>Percayai</strong> (Trust).",
          ],
          pic: "iosTrustDev",
        },
      ],
      trouble: [
        {
          q: "Sideloadly tidak melihat iPhone-ku",
          a: "Pastikan iPhone tidak terkunci dan kamu sudah mengetuk Percayai. Di Windows, pasang iTunes dan iCloud dari situs Apple, lalu buka Sideloadly lagi.",
        },
        {
          q: "Mode Pengembang tidak ada di Pengaturan",
          a: "Pilihannya baru muncul setelah Sideloadly selesai memasang aplikasinya. Ulangi langkah 3, lalu cek lagi.",
        },
        {
          q: "Aplikasinya tidak mau terbuka setelah seminggu",
          a: "Tanda tangan Apple ID gratis berlaku 7 hari. Colokkan iPhone, klik Start lagi di Sideloadly dengan berkas .ipa yang sama atau yang lebih baru.",
        },
      ],
      update:
        "<strong>Pengaturan</strong> › <strong>Tentang</strong> menunjukkan versi baru. Unduh berkas <strong>.ipa</strong> barunya di laptop, lalu klik <strong>Start</strong> lagi di Sideloadly. Data dan tanda masukmu tetap ada.",
      remove: "Tahan ikon Edunex Plus di layar utama, pilih <strong>Hapus App</strong> (Remove App), lalu <strong>Hapus App</strong> (Delete App).",
    },

    windows: {
      title: "Cara pasang Edunex Plus di Windows",
      description:
        "Pasang Edunex Plus di Windows 10 atau 11 dalam 2 menit, termasuk cara melewati peringatan “Windows melindungi PC Anda”. Dengan gambar tiap langkah.",
      h1: "Pasang di Windows",
      lead: "Unduh, buka, lalu lewati satu peringatan dari Windows. Tidak perlu kata sandi administrator.",
      time: "± 2 menit",
      needs: ["Windows 10 atau 11"],
      steps: [
        {
          title: "Unduh berkasnya",
          body: [
            "Hampir semua laptop memakai yang pertama. Pilih ARM hanya kalau laptopmu memakai Snapdragon.",
            "Browser bisa menahan unduhannya karena versi ini masih jarang diunduh. Di Edge, arahkan ke berkasnya, klik <strong>⋯</strong>, <strong>Simpan</strong> (Keep), <strong>Tampilkan lainnya</strong> (Show more), lalu <strong>Tetap simpan</strong> (Keep anyway).",
          ],
          download: ["win-x64", "win-arm"],
          pic: "edgeKeep",
        },
        {
          title: "Buka pemasang di dalam zip",
          body: [
            "Buka berkas zip yang diunduh, lalu klik dua kali pemasangnya (berkas <strong>.exe</strong>) di dalamnya.",
            "Pemasangnya dibungkus zip supaya browser tidak terlalu sering menahannya.",
          ],
          pic: "winZip",
        },
        {
          title: "Lewati peringatan Windows",
          body: [
            "Kalau muncul jendela biru <strong>Windows melindungi PC Anda</strong> (Windows protected your PC), klik <strong>Info selengkapnya</strong> (More info), lalu <strong>Tetap jalankan</strong> (Run anyway).",
            "Windows memperingatkan karena versi ini baru dan belum banyak yang memasangnya. Setelah itu aplikasi terpasang dan terbuka sendiri.",
          ],
          pic: "smartscreen",
        },
      ],
      trouble: [
        {
          q: "Muncul “Smart App Control memblokir aplikasi ini”",
          a: "Smart App Control hanya menjalankan aplikasi yang dikenalnya, dan tidak punya tombol “Tetap jalankan”. Mematikannya (Keamanan Windows › Kontrol aplikasi & browser) melepas perlindungan untuk semua aplikasi, jadi pilihan yang lebih aman adalah menunggu sampai pemasangnya ditandatangani.",
        },
        {
          q: "Chrome bilang “Download mencurigakan diblokir”",
          a: "Buka Download (panah di kanan atas), pilih berkasnya, lalu Download file mencurigakan (Download suspicious file).",
        },
        {
          q: "Notifikasi tidak muncul",
          a: "Pasang lewat pemasangnya, jangan menyalin foldernya. Windows baru menampilkan notifikasi setelah aplikasi punya pintasan di menu Start.",
        },
      ],
      update: "Otomatis. Aplikasi mengunduh versi baru sendiri dan memasangnya saat kamu menutup aplikasi.",
      remove:
        "<strong>Pengaturan</strong> (Settings) › <strong>Aplikasi</strong> (Apps) › <strong>Aplikasi terinstal</strong> (Installed apps) › Edunex Plus › <strong>Hapus instalan</strong> (Uninstall).",
    },

    mac: {
      title: "Cara pasang Edunex Plus di Mac",
      description:
        "Pasang Edunex Plus di Mac dalam 3 menit: seret ke Applications, lalu satu baris di Terminal supaya macOS mau membukanya. Dengan gambar tiap langkah.",
      h1: "Pasang di Mac",
      lead: "Seret aplikasinya ke Applications, lalu tempel satu baris di Terminal. Baris itu perlu karena aplikasinya belum ditandatangani Apple.",
      time: "± 3 menit",
      needs: ["macOS 12 Monterey atau lebih baru"],
      steps: [
        {
          title: "Unduh berkas untuk Mac-mu",
          body: [
            "Tidak tahu Mac-mu yang mana? Buka <strong>menu Apple</strong> › <strong>Tentang Mac Ini</strong> (About This Mac). “Chip Apple M…” berarti Apple silicon, “Prosesor … Intel” berarti Intel.",
          ],
          download: ["mac-arm", "mac-intel"],
          pic: "macAbout",
        },
        {
          title: "Seret Edunex Plus ke Applications",
          body: [
            "Buka berkas <strong>.dmg</strong> yang diunduh. Di jendela yang terbuka, seret <strong>Edunex Plus</strong> ke folder <strong>Applications</strong>.",
          ],
          pic: "dmg",
        },
        {
          title: "Tempel satu baris di Terminal",
          body: [
            "Di jendela yang sama, klik dua kali <strong>Terminal</strong>. Tempel baris ini, lalu tekan <strong>Return</strong>. Tidak ada yang tercetak kalau berhasil.",
            "Baris ini menghapus tanda “diunduh dari internet” yang membuat macOS memblokir aplikasinya, untuk Edunex Plus saja.",
          ],
          command: 'xattr -cr "/Applications/Edunex Plus.app"',
          pic: "terminal",
          alt: {
            title: "Tidak mau pakai Terminal?",
            body: "Buka Edunex Plus sekali, lalu klik <strong>Selesai</strong> (Done) saat macOS bilang tidak bisa memeriksanya. Buka <strong>Pengaturan Sistem</strong> (System Settings) › <strong>Privasi &amp; Keamanan</strong> (Privacy &amp; Security), gulir ke bawah, lalu klik <strong>Tetap Buka</strong> (Open Anyway). Tombolnya hanya muncul sebentar setelah kamu mencoba membuka aplikasinya.",
            pic: "macOpenAnyway",
          },
        },
      ],
      trouble: [
        {
          q: "macOS bilang aplikasinya “rusak” atau tidak bisa dibuka",
          a: "Baris Terminal di langkah 3 belum dijalankan, atau aplikasinya belum dipindahkan ke Applications. Pindahkan dulu, lalu jalankan barisnya lagi.",
        },
        {
          q: "Tombol “Tetap Buka” tidak ada",
          a: "Tombolnya hanya muncul sebentar setelah kamu mencoba membuka aplikasinya. Buka Edunex Plus sekali lagi, lalu cek Pengaturan Sistem.",
        },
      ],
      update: "Otomatis selama aplikasinya ada di Applications. Setelah pembaruan dari dalam aplikasi, baris Terminal tidak perlu diulang.",
      remove: "Seret Edunex Plus dari Applications ke Tong Sampah.",
    },

    linux: {
      title: "Cara pasang Edunex Plus di Linux",
      description: "Pasang Edunex Plus di Ubuntu, Debian, dan Linux Mint dengan satu perintah apt, atau pakai AppImage di distribusi lain.",
      h1: "Pasang di Linux",
      lead: "Untuk Ubuntu, Debian, dan Mint ada berkas .deb. Untuk distribusi lain ada AppImage.",
      time: "± 2 menit",
      needs: ["Ubuntu, Debian, Mint, atau distribusi lain", "Keyring (GNOME Keyring atau KWallet) supaya tanda masukmu tersimpan"],
      steps: [
        {
          title: "Unduh berkas untuk sistemmu",
          body: ["Pilih <strong>.deb</strong> untuk Ubuntu, Debian, dan Mint. Pilih <strong>AppImage</strong> untuk yang lain."],
          download: ["linux-deb", "linux-appimage"],
          pic: null,
        },
        {
          title: "Pasang berkas .deb",
          body: [
            "Buka Terminal di folder tempat berkasnya diunduh, lalu jalankan baris ini. Setelah itu buka <strong>Edunex Plus</strong> dari menu aplikasi.",
            "Tanda <strong>./</strong> di depan nama berkas penting, supaya apt memakai berkas itu.",
          ],
          command: "sudo apt install ./edunex-plus_<versi>_amd64.deb",
          commandKey: "deb",
          pic: null,
        },
        {
          title: "Atau jalankan AppImage",
          body: ["Beri izin jalan, lalu buka.", "Di Ubuntu 24.04 ke atas, AppImage berjalan tanpa sandbox Chromium. Pakai berkas .deb di sana kalau bisa."],
          command: "chmod +x Edunex-Plus-<versi>-x86_64.AppImage && ./Edunex-Plus-<versi>-x86_64.AppImage",
          commandKey: "appimage",
          pic: null,
        },
      ],
      trouble: [
        {
          q: "Aplikasi minta masuk lagi tiap dibuka",
          a: "Belum ada keyring di sistemmu. Pasang GNOME Keyring atau KWallet, lalu masuk sekali lagi.",
        },
        { q: "Laptopku ARM", a: "Berkas untuk ARM ada di halaman rilis: namanya berakhiran _arm64.deb dan -arm64.AppImage." },
      ],
      update: "AppImage memperbarui dirinya sendiri. Untuk .deb, aplikasi membuka halaman rilis, lalu pasang berkas barunya dengan perintah yang sama.",
      remove: "Jalankan <strong>sudo apt remove edunex-plus</strong>, atau hapus berkas AppImage-nya.",
    },
  },

  downloads: {
    android: "Unduh untuk Android (.apk)",
    iphone: "Unduh untuk iPhone (.ipa)",
    "win-x64": "Windows, Intel atau AMD",
    "win-arm": "Windows, ARM (Snapdragon)",
    "mac-arm": "Mac Apple silicon (M1 ke atas)",
    "mac-intel": "Mac Intel",
    "linux-deb": "Ubuntu, Debian, Mint (.deb)",
    "linux-appimage": "Linux lain (AppImage)",
  },

  // The words inside the drawn screens: what each system itself shows, in Indonesian.
  pic: {
    android: {
      file: "Edunex-Plus-android.apk",
      done: "Download selesai",
      open: "Buka",
      keep: "Tetap download",
      harmful: "File mungkin berbahaya",
      unknownTitle: "Chrome",
      unknownBody:
        "Demi keamanan, ponsel Anda saat ini tidak diizinkan menginstal aplikasi yang tidak dikenal dari sumber ini. Anda dapat mengubahnya di Setelan.",
      cancel: "Batal",
      settings: "Setelan",
      allowTitle: "Instal aplikasi tidak dikenal",
      allow: "Izinkan dari sumber ini",
      installAsk: "Ingin menginstal aplikasi ini?",
      install: "Instal",
      protectTitle: "Play Protect tidak mengenali aplikasi ini",
      more: "Detail selengkapnya",
      anyway: "Tetap instal",
      ok: "Oke",
    },
    ios: {
      trustTitle: "Percayai Komputer Ini?",
      trustBody: "Pengaturan dan data Anda akan dapat diakses dari komputer ini saat tersambung.",
      trust: "Percayai",
      dontTrust: "Jangan Percayai",
      settings: "Pengaturan",
      privacy: "Privasi & Keamanan",
      devMode: "Mode Pengembang",
      general: "Umum",
      vpn: "VPN & Manajemen Perangkat",
      devApp: "APP PENGEMBANG",
      appleId: "Apple ID-mu",
      trustApp: "Percayai “Apple ID-mu”",
    },
    sideloadly: {
      device: "iDevice",
      phone: "iPhone milikmu",
      appleId: "Apple ID",
      mail: "nama@icloud.com",
      drop: "Seret berkas .ipa ke sini",
      start: "Start",
    },
    windows: {
      edgeTitle: "Download",
      edgeWarn: "tidak biasa diunduh. Pastikan Anda memercayainya sebelum membukanya.",
      keep: "Simpan",
      more: "Tampilkan lainnya",
      keepAnyway: "Tetap simpan",
      remove: "Hapus",
      zip: "Edunex-Plus-Setup-windows-x64.zip",
      setup: "Edunex-Plus-Setup.exe",
      colName: "Nama",
      colType: "Jenis",
      type: "Aplikasi",
      ssTitle: "Windows melindungi PC Anda",
      ssBody: "Microsoft Defender SmartScreen mencegah aplikasi yang tidak dikenal dimulai. Menjalankan aplikasi ini bisa membahayakan PC Anda.",
      ssMore: "Info selengkapnya",
      ssApp: "Aplikasi: Edunex-Plus-Setup.exe",
      ssRun: "Tetap jalankan",
      ssDont: "Jangan jalankan",
    },
    mac: {
      about: "Tentang Mac Ini",
      chip: "Chip",
      chipValue: "Apple M2",
      macos: "macOS",
      silicon: "Apple silicon",
      applications: "Applications",
      terminal: "Terminal",
      settings: "Privasi & Keamanan",
      blocked: "“Edunex Plus” diblokir untuk melindungi Mac Anda.",
      openAnyway: "Tetap Buka",
    },
  },

  footer: {
    made: "Buatan mahasiswa ITB · didukung",
    links: {
      install: "Cara pasang",
      privacy: "Privasi",
      signing: "Kebijakan tanda tangan kode",
      report: "Laporkan masalah",
      github: "GitHub",
    },
    disclaimer:
      "Tidak resmi. Dibuat mahasiswa, tidak dibuat, didukung, atau terhubung dengan ITB maupun Cognisia (perusahaan di balik Edunex). Aplikasi memakai akun Edunex dan SIX-mu sendiri, jadi akunmu tetap tanggung jawabmu. Masih alpha: untuk hal penting, cek juga di Edunex atau SIX. Gambar menampilkan mahasiswa rekaan dari mode demo.",
  },

  notFound: {
    title: "Halaman tidak ditemukan · Edunex Plus",
    h1: "Halaman ini tidak ada.",
    body: "Tautannya mungkin sudah lama. Semua tentang Edunex Plus ada di beranda.",
    home: "Ke beranda",
  },
};
