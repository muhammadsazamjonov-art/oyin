# Oltin Qarmoq

Brauzerda ishlaydigan, klaviatura va sensorli ekranda boshqariladigan baliq ovlash o'yini. O'yin profili qurilmada saqlanadi va API orqali server bilan sinxronlanadi; global reyting ham serverda saqlanadi.

## O'yinni ishga tushirish

```bash
npm ci
```

Ikki terminalda ishga tushiring:

```bash
npm run api:dev
```

```bash
npm run dev
```

Vite `5173` portida ochiladi va `/api` so'rovlarini `8787` portidagi lokal serverga yo'naltiradi. Lokal server profillarni `.data/game-state.json` faylida saqlaydi.

Production build va bitta serverda ishga tushirish:

```bash
npm run build
npm start
```

`npm start` veb-sahifa va API'ni bir portda xizmat qiladi. `DATABASE_URL` bo'lmasa, server `.data` faylidan foydalanadi; PostgreSQL manzili berilsa, profillar va global reyting PostgreSQL'da saqlanadi.

## Render'ga chiqarish

Loyihada `render.yaml` Blueprint mavjud. Repozitoriyani GitHub'ga joylang, Render Dashboard'da **New → Blueprint** ni tanlab shu repozitoriyani ulang va deploy qiling. Blueprint quyidagilarni yaratadi:

- `npm ci --include=dev && npm run build` build'iga ega Node web service;
- `/api/health` health-check;
- profil va global reyting uchun PostgreSQL ma'lumotlar bazasi;
- GitHub'dagi keyingi push'lar uchun auto-deploy.

Render web service build vaqtida `dist/` ni yaratadi, `npm start` esa statik o'yin va `/api` endpointlarini bir origin'dan beradi. Shu sabab brauzer tomondan alohida `localhost` yoki backend URL kerak bo'lmaydi. Blueprint hozircha sinab ko'rish uchun bepul PostgreSQL tanlaydi; Render bepul PostgreSQL bazalari 30 kundan keyin tugaydi. Doimiy production ma'lumotlari uchun deploydan keyin Render Dashboard'da ma'lumotlar bazasini pullik rejaga yangilang ([Render free-plan qoidalari](https://render.com/docs/free)).

## O'yin boshqaruvi

- Ilgakni sichqoncha yoki barmoq bilan sudrang.
- `WASD` yoki strelkalar bilan harakat qiling.
- `P` yoki `Esc` bilan pauza qiling.
- Baliqqa tegib ovlang, kombo yig'ing, tangalarni qarmoq va qayiq yangilashga ishlating.

Qarmoq 300 darajagacha o'sadi; darajalar chuqurlik, tezlik, tutish radiusi va noyob baliq chiqish imkonini oshiradi. Baliqnoma deterministik yaratilgan 330 ta baliq turini va har birining narxini ko'rsatadi. Qayiqlar profilning 50, 100, 150, 200 va 300-darajalarida ochiladi. Har ov, yangi tur, raund yakuni, qarmoq va qayiq yangilashi profil XP beradi; 1-darajali qarmoqni 2-darajaga ko'tarish profilni 1.0 dan 1.5 ga olib chiqadi.

## API

- `GET /api/health` — server holati va saqlash turi.
- `GET /api/profile/:playerId` / `PUT /api/profile/:playerId` — o'yinchi profilini olish va saqlash.
- `GET /api/leaderboard?limit=5` — global reyting.
- `POST /api/leaderboard` — o'yinchining shaxsiy eng yuqori raund natijasini yangilash.
