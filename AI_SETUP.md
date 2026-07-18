# H4SX STORE AI Helper Setup

AI key jangan letak dalam `index.htm`, `app.js`, `styles.css`, atau Gist.

Tempat selamat:

1. Buka Vercel project H4SX STORE.
2. Pergi `Settings` -> `Environment Variables`.
3. Kalau guna Gemini, tambah:
   - `GEMINI_API_KEY` = API key Gemini dari Google AI Studio.
   - `GEMINI_MODEL` = model pilihan, contoh `gemini-2.5-flash`.
4. Kalau guna OpenAI sebagai fallback, tambah:
   - `OPENAI_API_KEY` = API key OpenAI anda.
   - `OPENAI_MODEL` = model pilihan, contoh `gpt-4.1-mini`.
5. Redeploy website.

Frontend akan panggil endpoint:

```txt
/api/ai-assistant
```

Endpoint ini berada di:

```txt
api/ai-assistant.js
```

Keutamaan endpoint:

1. Jika `GEMINI_API_KEY` ada, AI Helper guna Gemini.
2. Jika Gemini tiada tetapi `OPENAI_API_KEY` ada, AI Helper guna OpenAI.
3. Jika dua-dua tiada, website tidak rosak. Ia akan paparkan mesej fallback sahaja.
