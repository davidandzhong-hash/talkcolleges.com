// api/verify-code.js
// Checks the entered code against what's stored in Upstash.
// Deletes the code after successful verification so it can't be reused.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, group, entered } = req.body;
  if (!email || !group || !entered) return res.status(400).json({ error: 'Missing fields' });

const UPSTASH_REDIS_REST_URL   = process.env.KV_REST_API_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const key = `tc_verify_${group}_${email}`;

  try {
    // Get stored code from Upstash
    const getRes = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    });
    const data = await getRes.json();
    const storedCode = data.result;

    if (!storedCode) {
      return res.status(400).json({ error: 'Code expired or not found' });
    }

    if (entered !== storedCode) {
      return res.status(400).json({ error: 'Incorrect code' });
    }

    // Code is correct — delete it so it can't be reused
    await fetch(`${UPSTASH_REDIS_REST_URL}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Upstash error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
