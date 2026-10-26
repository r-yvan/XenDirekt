export type Locale = 'en' | 'fr';

export function normaliseLocale(value: string | null | undefined): Locale {
  return value?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/**
 * One-time code message. The code appears only in the message body sent to the user; it is never
 * logged or stored. SMS includes the iOS/Android autofill-friendly code line.
 */
export function otpMessage(
  locale: Locale,
  code: string,
  minutes: number,
): { subject: string; text: string } {
  if (locale === 'fr') {
    return {
      subject: `Votre code XenDirekt : ${code}`,
      text: `${code} est votre code XenDirekt. Il expire dans ${minutes} minutes. Ne le partagez avec personne.`,
    };
  }
  return {
    subject: `Your XenDirekt code: ${code}`,
    text: `${code} is your XenDirekt code. It expires in ${minutes} minutes. Never share it with anyone.`,
  };
}
