import type { Locale } from '../../notifications/templates/otp.template';
import { REFERRAL_BOOST } from '../domain/waitlist';

export interface WaitlistWelcomeData {
  firstName: string | null;
  position: number;
  shareUrl: string;
  statusUrl: string;
  leaveUrl: string;
}

/**
 * Sent once after someone joins the waitlist. Plain text, no tracking. It promises nothing the
 * product does not do yet: XenDirekt is in development and moves no money.
 */
export function waitlistWelcomeMessage(
  locale: Locale,
  data: WaitlistWelcomeData,
): { subject: string; text: string } {
  const place = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(data.position);
  if (locale === 'fr') {
    return {
      subject: `Vous êtes n° ${place} sur la liste d'attente XenDirekt`,
      text: [
        `Bonjour ${data.firstName ?? ''}`.trimEnd() + ',',
        '',
        `Vous êtes sur la liste. Votre place : n° ${place}.`,
        '',
        "Nous construisons à Kigali une façon plus simple de payer au Rwanda : votre carte Visa ou Mastercard d'un côté, n'importe quel portefeuille MTN MoMo de l'autre, avec le montant exact affiché avant de payer. Nous vous écrirons dès que votre accès sera prêt.",
        '',
        `Montez dans la liste : chaque ami qui s'inscrit avec votre lien vous fait gagner ${REFERRAL_BOOST} places.`,
        data.shareUrl,
        '',
        `Votre place à tout moment : ${data.statusUrl}`,
        '',
        'Murakoze,',
        "L'équipe XenDirekt, Kigali",
        '',
        `Vous recevez ce message car cette adresse s'est inscrite sur la liste d'attente XenDirekt. Quitter la liste et supprimer vos données : ${data.leaveUrl}`,
      ].join('\n'),
    };
  }
  return {
    subject: `You're #${place} on the XenDirekt waitlist`,
    text: [
      `Hi ${data.firstName ?? 'there'},`,
      '',
      `You're on the list. Your spot: #${place}.`,
      '',
      "We're building a simpler way to pay into Rwanda in Kigali: your Visa or Mastercard on one side, any MTN MoMo wallet on the other, with the exact amount shown before you pay. We'll email you when your access is ready.",
      '',
      `Want to move up? Every friend who joins with your link moves you up ${REFERRAL_BOOST} places.`,
      data.shareUrl,
      '',
      `Check your spot any time: ${data.statusUrl}`,
      '',
      'Murakoze,',
      'The XenDirekt team, Kigali',
      '',
      `You're getting this because this address joined the XenDirekt waitlist. Leave the list and delete your details: ${data.leaveUrl}`,
    ].join('\n'),
  };
}
