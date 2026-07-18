export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI helper belum aktif. Set OPENAI_API_KEY di Vercel Environment Variables.' });
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

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: 'Anda ialah pembantu jualan H4SX STORE. Jawab dalam Bahasa Melayu santai, ringkas, jujur, dan fokus kepada produk digital game. Jangan reka stok atau harga luar katalog. Cadangkan 1-3 item sahaja dan suruh pelanggan checkout/WhatsApp jika sesuai.'
          },
          {
            role: 'user',
            content: JSON.stringify({ question: cleanQuestion, catalog: safeCatalog })
          }
        ],
        max_output_tokens: 420
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI request failed.' });
    }

    const answer = data.output_text || data.output?.flatMap(part => part.content || []).map(part => part.text || '').join('\n').trim();
    return res.status(200).json({ answer: answer || 'Maaf, AI tak dapat beri cadangan buat masa ini.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error.' });
  }
}
