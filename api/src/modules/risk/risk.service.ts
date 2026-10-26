import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { Executor, toJson } from '../../database/database.factory';
import { Clock } from '../../shared/time/clock';
import { evaluateRiskRules, RISK_THRESHOLDS, RiskHit } from './domain/risk-rules';

export interface RiskSubject {
  paymentId: string;
  userId: string;
  cardId: string;
  payeeId: string;
  deviceIdHash: string | null;
}

/** Computes velocity signals from durable records and records flags for every hit. */
@Injectable()
export class RiskService {
  constructor(private readonly clock: Clock) {}

  async evaluatePayment(trx: Executor, subject: RiskSubject): Promise<RiskHit[]> {
    const now = this.clock.nowMs();
    const card = await trx
      .selectFrom('cards')
      .select('fingerprint')
      .where('id', '=', subject.cardId)
      .executeTakeFirstOrThrow();
    const payee = await trx
      .selectFrom('payees')
      .select('first_paid_at')
      .where('id', '=', subject.payeeId)
      .executeTakeFirstOrThrow();

    let distinctCardsOnDevice = 0;
    if (subject.deviceIdHash) {
      const since = new Date(now - RISK_THRESHOLDS.cardsPerDeviceWindowDays * 86_400_000);
      const row = await trx
        .selectFrom('cards')
        .select(
          sql<string>`count(DISTINCT coalesce(cards.fingerprint, cards.id::text))`.as('count'),
        )
        .where(
          'cards.user_id',
          'in',
          trx
            .selectFrom('sessions')
            .select('sessions.user_id')
            .where('sessions.device_id_hash', '=', subject.deviceIdHash)
            .where('sessions.created_at', '>=', since),
        )
        .where('cards.created_at', '>=', since)
        .executeTakeFirstOrThrow();
      distinctCardsOnDevice = Number(row.count);
    }

    let accountsWithSameCard = 1;
    if (card.fingerprint) {
      const row = await trx
        .selectFrom('cards')
        .select(sql<string>`count(DISTINCT user_id)`.as('count'))
        .where('fingerprint', '=', card.fingerprint)
        .executeTakeFirstOrThrow();
      accountsWithSameCard = Number(row.count);
    }

    const payeeIsNew =
      payee.first_paid_at === null ||
      now - payee.first_paid_at.getTime() < RISK_THRESHOLDS.newPayeeHours * 3_600_000;
    const payersSince = new Date(now - RISK_THRESHOLDS.newPayeePayersWindowHours * 3_600_000);
    const payers = await trx
      .selectFrom('payments')
      .select(sql<string>`count(DISTINCT user_id)`.as('count'))
      .where('payee_id', '=', subject.payeeId)
      .where('created_at', '>=', payersSince)
      .executeTakeFirstOrThrow();

    const hits = evaluateRiskRules({
      distinctCardsOnDevice,
      accountsWithSameCard,
      payeeIsNew,
      distinctPayersOfPayeeRecently: Number(payers.count),
    });
    for (const hit of hits) {
      await trx
        .insertInto('risk_flags')
        .values({
          payment_id: subject.paymentId,
          user_id: subject.userId,
          card_id: subject.cardId,
          payee_id: subject.payeeId,
          rule: hit.rule,
          severity: hit.severity,
          action: 'HOLD',
          evidence: toJson(hit.evidence),
        })
        .execute();
    }
    return hits;
  }
}
