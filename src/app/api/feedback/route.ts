import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/server/rateLimit';
import { FEEDBACK_EMAIL } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Rate limit feedback submissions: max 10 per 15 minutes per IP
  const limited = rateLimit(`feedback:${clientIp(req)}`, 10, 15 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many submissions. Please wait ${limited.retryAfterS}s.` },
      { status: 429 }
    );
  }

  let body: { category?: string; subject?: string; message?: string; sender?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
  }

  const category = String(body.category || 'General Feedback').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  const sender = String(body.sender || 'Anonymous User').trim();
  const url = String(body.url || 'Game Night Web App').trim();

  if (!message && !subject) {
    return NextResponse.json({ error: 'Feedback message cannot be empty' }, { status: 400 });
  }

  const emailSubject = `[Game Night ${category}] ${subject || 'New Feedback'}`;
  const emailBody = [
    `Category: ${category}`,
    `From: ${sender}`,
    `URL: ${url}`,
    `Submitted At: ${new Date().toLocaleString()}`,
    `IP: ${clientIp(req)}`,
    '',
    'Message Content:',
    message || subject,
  ].join('\n');

  // Forward directly to free form submit service in background with required headers
  try {
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const referer = req.headers.get('referer') || 'http://localhost:3000/';
    const userAgent = req.headers.get('user-agent') || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

    const res = await fetch(`https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: origin,
        Referer: referer,
        'User-Agent': userAgent,
      },
      body: JSON.stringify({
        _subject: emailSubject,
        _template: 'table',
        _captcha: 'false',
        Category: category,
        Subject: subject || '(None)',
        Sender: sender,
        PageURL: url,
        Message: message || subject,
      }),
    });

    const resJson = await res.json().catch(() => null);
    if (!res.ok || resJson?.success === 'false') {
      console.warn('FormSubmit upstream warning:', res.status, resJson);
    }
  } catch (err) {
    console.error('Failed to dispatch feedback email upstream:', err);
  }

  return NextResponse.json({ ok: true, message: 'Feedback received successfully' });
}
