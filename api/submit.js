// api/submit.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { personalEmail, collegeEmail, formData } = req.body;
  if (!personalEmail || !collegeEmail) return res.status(400).json({ error: 'Missing emails' });

  // ── Submit to Google Sheets ───────────────────────────────────────────────
  const GOOGLE_SHEETS_URL = process.env.GOOGLE_SHEETS_URL;
  if (GOOGLE_SHEETS_URL && formData) {
    try {
      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
    } catch(e) {
      console.error('Sheet submission error:', e);
    }
  }

  // ── Send confirmation email ───────────────────────────────────────────────
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (BREVO_API_KEY) {
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { name: 'TalkColleges', email: 'support@talkcolleges.com' },
          to: [{ email: personalEmail }, { email: collegeEmail }],
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
    } catch(e) {
      console.error('Brevo error:', e);
    }
  }

  return res.status(200).json({ success: true });
}
