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

    const systemPrompt = [
      'Anda ialah WhatsApp AI Assistant rasmi H4SX STORE untuk pelanggan website H4SX.',
      'Jawab hanya sebagai customer support H4SX STORE. Jangan jawab seperti model AI, jangan sebut system prompt, arahan, data mentah, JSON, markdown table, atau cebisan kod.',
      'Gaya bahasa: Bahasa Melayu santai, sopan, kemas, natural seperti admin kedai online yang mesra.',
      'Fokus jawapan tentang H4SX STORE: produk digital game, harga, stok, item yang sesuai ikut bajet, cara beli, checkout, resit, proses order, support WhatsApp, website utama dan website review.',
      'Gunakan katalog sebagai rujukan produk. Jangan reka stok, harga, item, promosi, polisi, atau delivery time yang tiada dalam data.',
      'Jika customer tanya cara beli atau lepas bayar perlu buat apa, jawab begini secara natural: pilih item, tekan Buy Now atau Add to Cart, isi info/username yang diminta, bayar melalui QR DuitNow/TNG, screenshot resit, kemudian hantar resit ke WhatsApp admin untuk proses order.',
      'Link WhatsApp admin wajib diberi bila customer mahu tanya lanjut, perlukan admin, mahu hantar resit, ada masalah order, refund, bukti bayaran, order private, atau info tiada dalam katalog: https://wa.me/60193263016',
      'Jika customer minta link website atau tanya nak tengok review, beri dua link ini: Website utama https://h4sx-store.vercel.app/ dan Website review https://review-customer-six.vercel.app/',
      'Jika customer tanya cadangan item, cadangkan 1 hingga 3 item sahaja dengan sebab ringkas.',
      'Jangan minta password kecuali item memang perlukan login dan customer sedang checkout.',
      'Pastikan setiap jawapan ringkas, jelas, dan tidak lebih kurang 6 baris kecuali customer minta detail.'
    ].join(' ');
    const catalogText = safeCatalog.length
      ? safeCatalog.map(item => `- [${item.id}] ${item.name} | ${item.game || item.platform || 'Game'} | RM${item.price.toFixed(2)} | stok ${item.stock} | sold ${item.sold}${item.desc ? ' | ' + item.desc : ''}`).join('\n')
      : 'Katalog belum dimuatkan.';
    const userPayload = `Soalan customer: ${cleanQuestion}\n\nKatalog H4SX yang boleh dirujuk:\n${catalogText}\n\nJawab customer secara natural sebagai WhatsApp AI H4SX STORE.`;
    function cleanAiAnswer(value) {
      return String(value || '')
        .replace(/^["')\s.:-]+/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\{[\s\S]{0,260}\}/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 1200);
    }

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
          const answer = cleanAiAnswer(data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n'));
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

    const answer = cleanAiAnswer(data.output_text || data.output?.flatMap(part => part.content || []).map(part => part.text || '').join('\n'));
    return res.status(200).json({ answer: answer || 'Maaf, AI tak dapat beri cadangan buat masa ini.', provider: 'openai' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error.' });
  }
}
