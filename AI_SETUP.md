# H4SX STORE AI Helper Setup

AI key jangan letak dalam `index.htm`, `app.js`, `styles.css`, atau Gist.

Tempat selamat:

1. Buka Vercel project H4SX STORE.
2. Pergi `Settings` -> `Environment Variables`.
3. Untuk guna Gemini, tambah:
   - `AI_PROVIDER` = `gemini`
   - `GEMINI_API_KEY` = API key Gemini dari Google AI Studio.
   - `GEMINI_MODEL` = optional, contoh `gemini-2.5-flash`. Jika kosong, server akan cuba model Gemini biasa.
4. Redeploy website.

Penting di Vercel:

- Pastikan variable diletak untuk environment yang betul: `Production` untuk website live.
- Lepas tambah/edit variable, tekan `Redeploy`. Deployment lama tidak automatik baca variable baru.
- Nama variable mesti tepat: `AI_PROVIDER`, `GEMINI_API_KEY` atau `GOOGLE_API_KEY`.
- Kalau mahu pakai Gemini sahaja, jangan letak `OPENAI_API_KEY`, atau biarkan `AI_PROVIDER=gemini`.

Frontend akan panggil endpoint:

```txt
/api/ai-assistant
```

Endpoint ini berada di:

```txt
api/ai-assistant.js
```

Keutamaan endpoint:

1. Default ialah Gemini.
2. Jika `AI_PROVIDER=gemini`, AI Helper guna Gemini sahaja.
3. Jika Gemini gagal, website tidak rosak. Ia akan paparkan bantuan ringkas H4SX.
4. OpenAI hanya digunakan kalau `AI_PROVIDER=openai` atau Gemini tiada dan OpenAI key tersedia.
