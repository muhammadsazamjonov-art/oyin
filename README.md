# 🎣 Oltin Qarmoq — Zamonaviy Baliq Ovlash O'yini

Ushbu loyiha brauzerda ishlovchi, yuqori sifatli (60 FPS), to'liq moslashuvchan (desktop va mobil) baliq ovlash o'yinidir. Loyiha Node.js Express serveri bilan ta'minlangan bo'lib, **GitHub** va **Render.com** orqali to'g'ridan-to'g'ri ishga tushirishga to'liq tayyorlangan.

---

## 🌟 O'yin Xususiyatlari

1. **300 Darajagacha Qarmoq Kuchaytirish (Level 1–300):**
   - 10 ta maxsus toifa (Yog'och, Bambuk, Po'lat, Kumush, Oltin, Platina, Olmos, Plazma, Kosmik, Afsonaviy).
   - Har bir yangilanishda:
     - Maksimal chuqurlik oshadi (14m dan 312m gacha — eng chuqur tubdagi baliqlarga yetish imkoni).
     - Qarmoq tezligi va manyovr qilish imkoniyati kuchayadi.
     - Tutish (magnit) radiusi kengayadi.
     - Omad (noyob va qimmat baliqlar chiqish ehtimoli) 100% gacha oshadi.
     - Kombo taymeri vaqti uzayadi.
   - Do'konda tezkor yangilash tugmalari: `+1`, `+5`, `+10`, va `MAX` (mavjud tangalarga qarab maksimal ko'tarish).

2. **5 Bosqichli Qayiqlar Yangilanishi:**
   - **0-qayiq:** Eski yog'och sol (Boshlang'ich, 60s, 1.0x daromad)
   - **1-qayiq (50 lvl talab):** Yelkanli qayiq (+30% daromad, +10s vaqt, +8 profil lvl)
   - **2-qayiq (100 lvl talab):** Motorli kater (+70% daromad, +20s vaqt, +12 profil lvl)
   - **3-qayiq (150 lvl talab):** Baliqchi kemasi (+120% daromad, +30s vaqt, +16 profil lvl)
   - **4-qayiq (200 lvl talab):** Oq lyuks yaxta (+200% daromad, +40s vaqt, +22 profil lvl)
   - **5-qayiq (300 lvl talab):** Afsonaviy kema (+350% daromad, +60s vaqt, +30 profil lvl)

3. **Dinamik Profil Darajasi (XP Tizimi):**
   - Har bir harakat profil darajasini oshiradi:
     - Qarmoq 1-darajadan 2-darajaga ko'tarilganda profil **1.5 lvl** bo'ladi (+0.5 lvl).
     - Har bir baliq tutilganda uning narxi, chuqurligi va noyobligiga ko'ra dinamik, har safar har xil XP hisoblanadi.
     - Yangi turdagi baliq ochilganda bonus XP (+0.35 lvl).
     - Uzluksiz kombo seriyalari (x1.5, x2.0...) uchun qo'shimcha bonus XP.
     - Qayiq sotib olinganda katta miqdorda profil XP beriladi (+8 dan +30 gacha).

4. **330+ Baliq Turlari va Narxlari (Baliqnoma):**
   - 30 ta o'zbekcha baliq turlari (Laqqa, Sazan, Zog'ora, Sudak, Gulmohi, Xon baliq, Ilonbosh, Bakra, Tunets, Akula va b.)
   - 11 ta noyoblik toifalari (Oddiy, Daryo, Ko'l, Qum, Tosh, Kumush, Oltin, Marvarid, Yoqut, Qirol, Afsonaviy).
   - Har bir baliqning o'z narxi (4 tangadan 2.5 mln tangagacha), o'lchami, chuqurlik doirasi va ranglari mavjud.
   - O'rnatilgan qidiruv va filtrlash tizimi.

5. **Juicy Feedback va Qulay Boshqaruv:**
   - 60 FPS silliq fizika va animatsiyalar.
   - Screen shake (ekran silkinishi), yorug'lik chaqnashi, suv sachrashi va oltin tanga zarrachalari.
   - Suzuvchi matnlar va kombo ko'rsatkichlari.
   - Web Audio API orqali generatsiya qilinadigan ovoz effektlari va ovozni yoqish/o'chirish (🔊/🔇) tugmasi.
   - Desktop boshqaruvi: `WASD` / Strelkalar / Sichqoncha, `Bo'sh joy (Space)` — Tezlanish (Turbo Boost), `P` / `Esc` — Pauza.
   - Mobil boshqaruv: Ekranga tegib boshqarish + maxsus on-screen **⚡ TEZLANISH** tugmasi.

6. **Server va Onlayn Reyting:**
   - Express serveri orqali global rekordlar ro'yxati (`/api/leaderboard`).
   - Server salomatligi tekshiruvi (`/api/health`).
   - Butun dunyo bo'yicha ovlangan jami baliqlar statistikasi.

---

## 🚀 Render.com Ga Joylash (Deployment)

Loyiha Render platformasiga 100% moslashtirilgan. Renderda sayt yaratish uchun quyidagi qadamlarni bajaring:

### 1-usul: Render Dashboard orqali (Tavsiya etiladi)

1. [Render.com](https://render.com) ga kiring va o'z GitHub hisobingiz bilan avtorizatsiyadan o'ting.
2. Yuqori o'ng burchakdagi **"New +"** tugmasini bosing va **"Web Service"** ni tanlang.
3. GitHub repozitoriyangizni (`muhammadsazamjonov-art/oyin`) tanlang.
4. Quyidagi sozlamalarni kiriting:
   - **Name:** `oltin-qarmoq` (yoki ixtiyoriy nom)
   - **Region:** Frankfurt (yoki o'zingizga yaqin region)
   - **Branch:** `arena/d2616045-oyin` yoki `main`
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     npm install && npm run build
     ```
   - **Start Command:**
     ```bash
     npm start
     ```
   - **Instance Type:** `Free` (bepul)
5. **"Deploy Web Service"** tugmasini bosing.
6. 1-2 daqiqada Render saytingizni quradi va sizga bepul HTTPS domen beradi (masalan: `https://oltin-qarmoq.onrender.com`).

### 2-usul: `render.yaml` (Blueprint) orqali

Loyihada allaqachon `render.yaml` fayli sozlangan. Render panelida **"Blueprints"** bo'limiga kirib repozitoriyani ulasangiz, barcha sozlamalar avtomatik ravishda qo'llanadi.

---

## 💻 Kompyuterda Lokal Ishga Tushirish

```bash
# 1. Bog'liqliklarni o'rnatish
npm install

# 2. Frontendni yig'ish (Production Build)
npm run build

# 3. Serverni ishga tushirish (Express backend + frontend)
npm start
```

Brauzerda `http://localhost:3000` manzilini oching.

Agar frontendni ishlab chiqish (Dev mode) rejimida ochmoqchi bo'lsangiz:
```bash
npm run dev
```

---

## 🛠 Texnologiyalar

- **Frontend:** React 19, TypeScript, HTML5 Canvas 2D API, Tailwind CSS, Vite.
- **Audio:** Web Audio API (protsedural audio sintezi, tashqi og'ir mp3 fayllarsiz).
- **Backend:** Node.js, Express 5, CORS.
- **Deployment:** Render (`render.yaml`), GitHub.
