# H4SX STORE AI Helper Setup

AI key jangan letak dalam `index.htm`, `app.js`, `styles.css`, atau Gist.

Tempat selamat:

1. Buka Vercel project H4SX STORE.
2. Pergi `Settings` -> `Environment Variables`.
3. Tambah:
   - `OPENAI_API_KEY` = API key OpenAI anda.
   - `OPENAI_MODEL` = model pilihan, contoh `gpt-4.1-mini` atau model baru yang anda pilih.
4. Redeploy website.

Frontend akan panggil endpoint:

```txt
/api/ai-assistant
```

Endpoint ini berada di:

```txt
api/ai-assistant.js
```

Kalau `OPENAI_API_KEY` belum diset, AI Helper tidak akan rosakkan website. Ia akan paparkan mesej fallback sahaja.
