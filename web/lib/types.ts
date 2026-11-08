/** Response shapes of the XenDirekt API, matching contracts/fixtures/*.json. */
export type Persona = 'VISITOR' | 'SENDER' | 'DIASPORA' | 'RECEIVER';

export interface AppConfig {
  environment: string;
  providerMode: 'SANDBOX' | 'LIVE';
  features: { smsSignIn: boolean; emailSignIn: boolean; merchantCodes: boolean };
  auth: { otpLength: number; otpResendSeconds: number; pinLength: number };
  legal: { termsVersion: string; privacyVersion: string; termsUrl: string; privacyUrl: string };
  banner: { kind: 'PAYMENTS_PAUSED' } | null;
}

export interface OtpChallenge {
  challengeId: string;
  destinationMasked: string;
  expiresAt: string;
  resendAvailableAt: string;
  codeLength: number;
}

export interface Profile {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  countryOfResidence: string | null;
  dateOfBirth: string | null;
  preferredLanguage: 'en' | 'fr';
  status: 'PENDING_PROFILE' | 'ACTIVE';
  profileComplete: boolean;
  pinSet: boolean;
  createdAt: string;
}

export interface Card {
  id: string;
  brand: 'VISA' | 'MASTERCARD' | string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  issuingCountry: string | null;
  cardCurrency: string | null;
  isDefault: boolean;
  status: string;
  simulated: boolean;
}

export interface CardSetup {
  setupId: string;
  hostedUrl: string;
  returnUrlPrefix: string;
  expiresAt: string;
  simulated: boolean;
}

export interface Payee {
  payeeId: string;
  network: string;
  displayIdentifier: string;
  maskedIdentifier: string;
  registeredName: string;
  verifiedAt: string;
  simulated: boolean;
}

export interface Quote {
  quoteId: string;
  expiresAt: string;
  amountRwf: number;
  feeRwf: number;
  totalRwf: number;
  cardCurrency: string;
  totalCardDisplay: string;
  fxRateDisplay: string;
  payee: { payeeId: string; registeredName: string; maskedIdentifier: string };
  card: { id: string; brand: string; last4: string };
  simulated: boolean;
}

export type PaymentStatus =
  'PROCESSING' | 'ACTION_REQUIRED' | 'COMPLETED' | 'FAILED' | 'IN_REVIEW' | 'REFUNDED' | string;

export interface Payment {
  id: string;
  reference: string;
  state: string;
  status: PaymentStatus;
  chargeStatus: string;
  failureReason: string | null;
  steps: { processing: boolean; sent: boolean; received: boolean };
  nextAction: { type: 'THREE_DS'; url: string; returnUrlPrefix: string } | null;
  amountRwf: number;
  feeRwf: number;
  totalRwf: number;
  cardCurrency: string;
  totalCardDisplay: string;
  fxRateDisplay: string;
  payee: { registeredName: string; maskedIdentifier: string };
  card: { brand: string; last4: string };
  note: string | null;
  simulated: boolean;
  createdAt: string;
  completedAt: string | null;
  receipt: {
    reference: string;
    kigaliDateTime: string;
    merchantName: string;
    merchantIdentifier: string;
    amountRwf: number;
    feeRwf: number;
    fxRateDisplay: string;
    totalCardDisplay: string;
    card: string;
    status: string;
    simulated: boolean;
  } | null;
}

export interface Notification {
  id: string;
  paymentId: string | null;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface Ticket {
  id: string;
  reference: string;
  category: string;
  message: string | null;
  status: string;
  paymentReference: string | null;
  createdAt: string;
}

export interface WaitlistStatus {
  referralCode: string;
  position: number;
  total: number;
  referrals: number;
  referralBoost: number;
  shareUrl: string;
  alreadyJoined?: boolean;
}

export interface HustleResult {
  id: string;
  score: number;
  tier: 'SMOOTH' | 'PART_TIME' | 'CERTIFIED' | 'LEGEND';
  percentile: number | null;
  responses: number;
  insights: {
    hitAWallPct: number;
    unknownFeesPct: number;
    alwaysCheckingPct: number;
    waitDaysOrMorePct: number;
  } | null;
}

export interface Story {
  id: string;
  body: string;
  countryCode: string | null;
  persona: Persona | null;
  createdAt: string;
}

export interface LaunchStats {
  waitlist: { total: number };
  hustleCheck: { responses: number; averageScore: number | null };
  stories: { published: number };
}
