export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !openaiKey) {
    return res.status(503).json({ error: 'AI helper belum aktif. Set GEMINI_API_KEY atau OPENAI_API_KEY di Vercel Environment Variables.' });
  }

  try {
    const { question = '', catalog = [] } = req.body || {};
    const cleanQuestion = String(question).trim().slice(0, 500);
    const safeCatalog = Array.isArray(catalog) ? catalog.slice(0, 40).map(item => ({
      id: item.id,
      name: String(item.name || '').slice(0, 80),
      game: String(item.game || '').slice(0, 60),
      platform: String(item.platform || '').slice(0, 30),
      price: Number(item.price || 0),
      stock: Number(item.stock || 0),
      sold: Number(item.sold || 0),
      desc: String(item.desc || '').slice(0, 140)
    })) : [];

    if (!cleanQuestion) return res.status(400).json({ error: 'Soalan kosong.' });

    const systemPrompt = 'Anda ialah AI Assistant rasmi H4SX STORE untuk pelanggan. Jawab dalam Bahasa Melayu santai, kemas dan meyakinkan. Bantu customer tentang produk digital game, cadangan item ikut bajet, stok, harga, cara checkout, cara hantar resit, waktu proses, support WhatsApp, dan soalan biasa kedai. Gunakan katalog yang diberi sebagai sumber produk; jangan reka stok, harga, item, promosi, atau polisi yang tiada dalam data. Jika soalan perlukan admin, refund, masalah akaun, bukti bayaran, order private, atau maklumat tiada dalam katalog, jawab ringkas dan arahkan customer WhatsApp admin H4SX STORE. Jangan minta password kecuali item memang perlukan login dan customer sedang checkout. Cadangkan 1-3 item sahaja bila relevan.';
    const userPayload = JSON.stringify({ question: cleanQuestion, catalog: safeCatalog });

    if (geminiKey) {
      const models = Array.from(new Set([
        process.env.GEMINI_MODEL,
        'gemini-2.5-flash',
        'gemini-3.5-flash',
        'gemini-1.5-flash'
      ].filter(Boolean)));
      let lastError = 'Gemini request failed.';

      for (const model of models) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: {
            'x-goog-api-key': geminiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userPayload }]
              }
            ],
            generationConfig: {
              maxOutputTokens: 420,
              temperature: 0.45
            }
          })
        });

        const data = await response.json();
        if (response.ok) {
          const answer = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n').trim();
          return res.status(200).json({ answer: answer || 'Maaf, AI tak dapat beri cadangan buat masa ini.', provider: 'gemini', model });
        }

        lastError = data.error?.message || `${model} failed with status ${response.status}.`;
      }

      return res.status(502).json({ error: lastError });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPayload }
        ],
        max_output_tokens: 420
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI request failed.' });
    }

    const answer = data.output_text || data.output?.flatMap(part => part.content || []).map(part => part.text || '').join('\n').trim();
    return res.status(200).json({ answer: answer || 'Maaf, AI tak dapat beri cadangan buat masa ini.', provider: 'openai' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error.' });
  }
}
