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

 // Send confirmation email
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    if (BREVO_API_KEY) {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { name: 'TalkColleges', email: 'support@talkcolleges.com' },
          to: [{ email }],
          subject: 'Your TalkColleges Advisor Application — Received!',
          htmlContent: `
            <div style="font-family:'DM Sans',sans-serif;max-width:520px;margin:0 auto;padding:2rem;">
             <h2 style="font-family:Georgia,serif;color:#4D107A;">Talk<span style="color:#D1B365;">Colleges</span></h2>
              <h3 style="font-family:Georgia,serif;color:#4D107A;">Welcome — your application is in! 🎉</h3>
              <p style="color:#444;">Thank you for applying to become a TalkColleges advisor. We'll be in touch within <strong>2–3 business days</strong>.</p>
              <p style="color:#7a6b8d;font-size:0.88rem;">Questions? Reply to this email or reach us at <a href="mailto:support@talkcolleges.com" style="color:#4D107A;">support@talkcolleges.com</a></p>
            </div>
          `,
        }),
      });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Upstash error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
