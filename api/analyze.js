export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Перевірка API ключа
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: true,
      message: 'ANTHROPIC_API_KEY не знайдено.'
    });
  }

  // Парсинг тіла запиту
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {
      return res.status(400).json({ error: true, message: 'Invalid JSON body' });
    }
  }

  if (!body || !body.messages) {
    return res.status(400).json({ error: true, message: 'Missing messages in request body' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: true,
        message: `Anthropic API error ${response.status}: ${data?.error?.message || JSON.stringify(data)}`
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({
      error: true,
      message: `Server error: ${err.message}`
    });
  }
}