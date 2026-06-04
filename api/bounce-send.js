// Vercel Serverless Function — Bounce Test Email Sender
// POST /api/bounce-send
// Body : { email, code, domain }
// Envoie un email formaté NDR/Mailer-Daemon à benoit@lecourtier.net

const EMAILJS_ENDPOINT   = 'https://api.emailjs.com/api/v1.0/email/send';
const EMAILJS_SERVICE_ID = 'service_12wtkng';
const EMAILJS_TEMPLATE_ID = 'template_tib1gk7';
const EMAILJS_USER_ID    = 'nf_vsJRJn_ucqKgbR';
const NOTIFY_EMAIL       = 'benoit@lecourtier.net';

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
    'This is an automatically generated Delivery Status Notification (DSN).',
    'Delivery to the following recipient FAILED PERMANENTLY:',
    '',
    '    ' + email,
    '',
    'Technical details of permanent failure:',
    'The mail server tried to deliver your message, but it was rejected',
    'by the server for the recipient domain via ' + domain + '.',
    '',
    'The error that the other server returned was:',
    code + ' ' + desc,
    '',
    '────────────────────────────────────────────────',
    'Final-Recipient: rfc822; ' + email,
    'Action: failed',
    'Status: ' + code.charAt(0) + '.1.1',
    'Remote-MTA: dns; ' + domain,
    'Diagnostic-Code: smtp; ' + code + ' ' + desc,
    'Last-Attempt-Date: ' + date,
    'Message-ID: <' + msgId + '>',
    '────────────────────────────────────────────────',
    '[TEST BOUNCE — Alti-Web Config Test Tool]',
  ].join('\n');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const email  = (body.email  || '').trim();
  const code   = (body.code   || '550').trim();
  const domain = (body.domain || 'mail.google.com').trim();

  if (!email || !email.includes('@')) {
    return res.status(400).json({ ok: false, error: 'Email invalide' });
  }

  const subject  = 'Mail delivery failed: returning message to sender — ' + email;
  const bodyText = buildBounceBody(email, code, domain);

  try {
    const resp = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'https://alti-board.fr',
      },
      body: JSON.stringify({
        service_id:  EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id:     EMAILJS_USER_ID,
        accessToken: process.env.EMAILJS_PRIVATE_KEY || undefined,
        template_params: {
          name:    subject,
          email:   NOTIFY_EMAIL,
          message: bodyText,
        },
      }),
    });

    const text = await resp.text().catch(() => '');
    if (!resp.ok) {
      return res.status(502).json({ ok: false, error: 'EmailJS error ' + resp.status + ': ' + text });
    }
    return res.status(200).json({ ok: true, subject, to: NOTIFY_EMAIL });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
