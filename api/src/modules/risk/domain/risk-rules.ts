/**
 * Velocity rules (NFR-RSK-03). Thresholds are conservative pilot defaults pending PM/Risk
 * approval (docs/open-questions.md OQ-03); every hit is recorded with evidence counts only.
 */
export const RISK_THRESHOLDS = {
  /** Distinct card fingerprints seen on one device within the window. */
  maxCardsPerDevice: 3,
  cardsPerDeviceWindowDays: 7,
  /** Distinct accounts that ever saved the same card fingerprint. */
  maxAccountsPerCard: 1,
  /** A payee is "new" until its first completed payment or for this long after. */
  newPayeeHours: 24,
  /** Distinct payers of a new payee within the window that triggers review. */
  maxPayersForNewPayee: 3,
  newPayeePayersWindowHours: 1,
} as const;

export type RiskRule = 'CARDS_PER_DEVICE' | 'CARD_ON_MULTIPLE_ACCOUNTS' | 'NEW_PAYEE_MANY_PAYERS';

export interface RiskSignals {
  distinctCardsOnDevice: number;
  accountsWithSameCard: number;
  payeeIsNew: boolean;
  distinctPayersOfPayeeRecently: number;
}

export interface RiskHit {
  rule: RiskRule;
  severity: 'MEDIUM' | 'HIGH';
  evidence: Record<string, number | boolean>;
}

/** Pure rule evaluation. Any hit holds the payment for review before payout (NFR-RSK-07). */
export function evaluateRiskRules(signals: RiskSignals): RiskHit[] {
  const hits: RiskHit[] = [];
  if (signals.distinctCardsOnDevice > RISK_THRESHOLDS.maxCardsPerDevice) {
    hits.push({
      rule: 'CARDS_PER_DEVICE',
      severity: 'MEDIUM',
      evidence: { distinctCardsOnDevice: signals.distinctCardsOnDevice },
    });
  }
  if (signals.accountsWithSameCard > RISK_THRESHOLDS.maxAccountsPerCard) {
    hits.push({
      rule: 'CARD_ON_MULTIPLE_ACCOUNTS',
      severity: 'HIGH',
      evidence: { accountsWithSameCard: signals.accountsWithSameCard },
    });
  }
  if (
    signals.payeeIsNew &&
    signals.distinctPayersOfPayeeRecently > RISK_THRESHOLDS.maxPayersForNewPayee
  ) {
    hits.push({
      rule: 'NEW_PAYEE_MANY_PAYERS',
      severity: 'HIGH',
      evidence: {
        distinctPayersOfPayeeRecently: signals.distinctPayersOfPayeeRecently,
        payeeIsNew: true,
      },
    });
  }
  return hits;
}
