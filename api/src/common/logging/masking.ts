/**
 * Human-facing masks for personal data (admin Viewer role, receipts, logs).
 * Masks keep enough to recognise a record without exposing the full value.
 */

/** +250788123456 → +250 78* *** 456 ; other E.164 numbers keep country code and last 3. */
export function maskPhone(e164: string | null | undefined): string | null {
  if (!e164) {
    return null;
  }
  const digits = e164.replace(/[^\d]/g, '');
  if (digits.startsWith('250') && digits.length === 12) {
    return `+250 ${digits.slice(3, 5)}* *** ${digits.slice(-3)}`;
  }
  if (digits.length < 7) {
    return '***';
  }
  return `+${digits.slice(0, digits.length - 7)}****${digits.slice(-3)}`;
}

/** 0788123456 style local display: 078* *** 456 */
export function maskLocalMsisdn(local: string): string {
  if (local.length !== 10) {
    return '***';
  }
  return `${local.slice(0, 3)}* *** ${local.slice(-3)}`;
}

/** jean.doe@example.com → j***@e***.com */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return '***';
  }
  const dot = domain.lastIndexOf('.');
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${local.charAt(0)}***@${domainName.charAt(0)}***${tld}`;
}

/** "Jean Bosco Uwimana" → "J*** B*** U***" */
export function maskName(name: string | null | undefined): string | null {
  if (!name) {
    return null;
  }
  return name
    .trim()
    .split(/\s+/)
    .map((part) => `${part.charAt(0)}***`)
    .join(' ');
}

/** Generic identifier mask: keeps the last 3 characters. */
export function maskIdentifier(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= 3) {
    return '***';
  }
  return `${'*'.repeat(Math.min(value.length - 3, 6))}${value.slice(-3)}`;
}

/** First name only, used where the PRD shares the payer's first name with the merchant. */
export function firstName(fullName: string | null | undefined): string | null {
  if (!fullName) {
    return null;
  }
  const first = fullName.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}
