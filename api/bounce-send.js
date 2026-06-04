// Vercel Serverless Function — Bounce Test Email Sender
// POST /api/bounce-send
// Body : { email, code, domain }
// Envoie un email formaté NDR/Mailer-Daemon À l'adresse saisie
// Requiert : RESEND_API_KEY dans les variables d'environnement Vercel

const BOUNCE_CODES = {
  '550': 'Requested action not taken: mailbox unavailable — User unknown in virtual mailbox table',
  '551': 'User not local; please try forwarding — The email account that you tried to reach does not exist',
  '552': 'Requested mail action aborted: exceeded storage allocation — Mailbox full',
  '554': 'Transaction failed — This message was blocked because its content presents a potential security issue',
  '421': 'Service temporarily unavailable — The server was unable to process your request due to a temporary overload',
};

function buildBounceBody(email, code, domain) {
  const desc = BOUNCE_CODES[code] || 'Unknown error';
  const date = new Date().toUTCString();
  const msgId = Math.random().toString(36).slice(2) + '.' + Date.now() + '@' + domain;
  return [
    'Delivery Status Notification (Failure)',
    '────────────────────────────────────────────────',
    '',
    'This is an automatically generated Delivery Status Notification.',
    '',
    'Delivery to the following recipient failed permanently:',
    '',
    '        ' + email,
    '',
    'Technical details of permanent failure:',
    'The mail server attempted to deliver your message, but it was rejected',
    'by the destination server ' + domain + '.',
    '',
    'The error that the other server returned was:',
    '>>> ' + code + ' ' + desc,
    '',
    '────────────────────────────────────────────────',
    'Final-Recipient: rfc822; ' + email,
    'Action: failed',
    'Status: ' + code.charAt(0) + '.1.1',
    'Remote-MTA: dns; ' + domain,
    'Diagnostic-Code: smtp; ' + code + ' ' + desc,
    'Last-Attempt-Date: ' + date,
    'Message-ID: <' + msgId + '>',
    '',
    '────────────────────────────────────────────────',
    '** This is an automatically generated message. Do not reply. **',
    'Mail Delivery Subsystem — ' + domain,
  ].join('\n');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  // Vérification clé Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ ok: false, error: 'RESEND_API_KEY non configurée dans Vercel' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const email  = (body.email  || '').trim();
  const code   = (body.code   || '550').trim();
  const domain = (body.domain || 'mail.google.com').trim();

  if (!email || !email.includes('@')) {
    return res.status(400).json({ ok: false, error: 'Email invalide' });
  }

  const subject  = 'Delivery Status Notification (Failure)';
  const bodyText = buildBounceBody(email, code, domain);

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + resendKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mail Delivery Subsystem <mailer-daemon@alti-board.fr>',
        to:      [email],
        subject: subject,
        text:    bodyText,
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(502).json({ ok: false, error: 'Resend error ' + resp.status + ': ' + JSON.stringify(data) });
    }
    return res.status(200).json({ ok: true, subject, to: email, id: data.id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
