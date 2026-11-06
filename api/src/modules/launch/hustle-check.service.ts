import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { InjectDatabase } from '../../database/database.module';
import type { DB, LaunchPersona } from '../../database/schema';
import {
  HustleAnswers,
  hustlePercentile,
  hustleScore,
  HustleTier,
  hustleTier,
  MIN_RESPONSES_FOR_INSIGHTS,
} from './domain/hustle-check';

export interface HustleCheckResult {
  id: string;
  score: number;
  tier: HustleTier;
  /** Share of other people with a lower score; null for the very first response. */
  percentile: number | null;
  /** Responses so far, including this one. */
  responses: number;
  /** Percentages across everyone; null until there are enough responses to be meaningful. */
  insights: {
    hitAWallPct: number;
    unknownFeesPct: number;
    alwaysCheckingPct: number;
    waitDaysOrMorePct: number;
  } | null;
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part * 100) / whole);
}

/**
 * The anonymous Hustle Check: five taps, scored on the server, compared with everyone else.
 * Answers are stored as codes only and never linked to a person or a waitlist entry.
 */
@Injectable()
export class HustleCheckService {
  constructor(@InjectDatabase() private readonly db: Kysely<DB>) {}

  async submit(answers: HustleAnswers & { persona: LaunchPersona }): Promise<HustleCheckResult> {
    const score = hustleScore(answers);
    const inserted = await this.db
      .insertInto('hustle_check_responses')
      .values({
        persona: answers.persona,
        last_time: answers.lastTime,
        speed: answers.speed,
        fees: answers.fees,
        checking: answers.checking,
        score,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const stats = await sql<{
      total: number;
      below: number;
      equal: number;
      hit_a_wall: number;
      unknown_fees: number;
      always_checking: number;
      wait_days: number;
    }>`
      SELECT
        count(*)::int AS total,
        (count(*) FILTER (WHERE id <> ${inserted.id} AND score < ${score}))::int AS below,
        (count(*) FILTER (WHERE id <> ${inserted.id} AND score = ${score}))::int AS equal,
        (count(*) FILTER (WHERE last_time IN ('DECLINED', 'STUCK')))::int AS hit_a_wall,
        (count(*) FILTER (WHERE fees = 'UNKNOWN'))::int AS unknown_fees,
        (count(*) FILTER (WHERE checking IN ('OFTEN', 'ALWAYS')))::int AS always_checking,
        (count(*) FILTER (WHERE speed IN ('DAYS', 'UNKNOWN')))::int AS wait_days
      FROM hustle_check_responses
    `.execute(this.db);
    const row = stats.rows[0];
    if (!row) {
      throw new Error('Aggregate query returned no row');
    }
    return {
      id: inserted.id,
      score,
      tier: hustleTier(score),
      percentile: hustlePercentile(row.below, row.equal, row.total - 1),
      responses: row.total,
      insights:
        row.total >= MIN_RESPONSES_FOR_INSIGHTS
          ? {
              hitAWallPct: pct(row.hit_a_wall, row.total),
              unknownFeesPct: pct(row.unknown_fees, row.total),
              alwaysCheckingPct: pct(row.always_checking, row.total),
              waitDaysOrMorePct: pct(row.wait_days, row.total),
            }
          : null,
    };
  }

  async totals(): Promise<{ responses: number; averageScore: number | null }> {
    const row = await sql<{ responses: number; average: string | null }>`
      SELECT count(*)::int AS responses, round(avg(score))::text AS average
      FROM hustle_check_responses
    `.execute(this.db);
    const totals = row.rows[0];
    if (!totals) {
      throw new Error('Aggregate query returned no row');
    }
    return {
      responses: totals.responses,
      averageScore: totals.average === null ? null : Number(totals.average),
    };
  }

  /** Operations view: how often each answer was given, per question. */
  async summary() {
    const counts = await sql<{ question: string; answer: string; count: number }>`
      SELECT 'persona' AS question, persona AS answer, count(*)::int AS count
        FROM hustle_check_responses GROUP BY persona
      UNION ALL
      SELECT 'lastTime', last_time, count(*)::int FROM hustle_check_responses GROUP BY last_time
      UNION ALL
      SELECT 'speed', speed, count(*)::int FROM hustle_check_responses GROUP BY speed
      UNION ALL
      SELECT 'fees', fees, count(*)::int FROM hustle_check_responses GROUP BY fees
      UNION ALL
      SELECT 'checking', checking, count(*)::int FROM hustle_check_responses GROUP BY checking
    `.execute(this.db);
    const answers: Record<string, Record<string, number>> = {};
    for (const row of counts.rows) {
      answers[row.question] = { ...answers[row.question], [row.answer]: row.count };
    }
    return { ...(await this.totals()), answers };
  }
}
