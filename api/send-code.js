// api/send-code.js
// Generates code SERVER-SIDE, stores in Upstash with 10min expiry, sends via Brevo.
// Code is never sent to the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, group } = req.body;
  if (!email || !group) return res.status(400).json({ error: 'Missing email or group' });

 const BREVO_API_KEY            = process.env.BREVO_API_KEY;
const UPSTASH_REDIS_REST_URL   = process.env.KV_REST_API_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!BREVO_API_KEY || !UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  // Generate code server-side — never exposed to browser
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // Store in Upstash with 10 minute expiry (600 seconds)
  // Key is scoped to email+group so personal and college codes don't collide
  const key = `tc_verify_${group}_${email}`;
  try {
    const upstashRes = await fetch(`${UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}/${code}/EX/600`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    });
    if (!upstashRes.ok) throw new Error('Upstash write failed');
  } catch (err) {
    console.error('Upstash error:', err);
    return res.status(500).json({ error: 'Failed to store code' });
  }

  // Send email via Brevo
  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'TalkColleges', email: 'support@talkcolleges.com' },
        to: [{ email }],
        subject: 'Your TalkColleges Verification Code',
        htmlContent: `
          <div style="font-family:'DM Sans',sans-serif;max-width:480px;margin:0 auto;padding:2rem;">
            <h2 style="font-family:Georgia,serif;color:#4D107A;margin-bottom:0.5rem;">TalkColleges</h2>
            <p style="color:#444;font-size:1rem;margin-bottom:1.5rem;">
              Here is your verification code to complete your advisor application:
            </p>
            <div style="letter-spacing:0.25em;font-size:2rem;font-weight:700;color:#4D107A;
                        background:#f9f5ff;border:1px solid #e2d5f0;border-radius:8px;
                        padding:1rem 1.5rem;text-align:center;margin-bottom:1.5rem;">
              ${code}
            </div>
            <p style="color:#7a6b8d;font-size:0.88rem;">
              This code expires in 10 minutes. If you did not apply to be a TalkColleges advisor,
              you can safely ignore this email.
            </p>
            <hr style="border:none;border-top:1px solid #e2d5f0;margin:1.5rem 0;"/>
            <p style="color:#aaa;font-size:0.78rem;">© 2026 TalkColleges. All rights reserved.</p>
          </div>
        `,
      }),
    });

    if (!brevoRes.ok) {
      const err = await brevoRes.json();
      console.error('Brevo error:', err);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
