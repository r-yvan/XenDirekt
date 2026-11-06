import type { LaunchPersona } from '../../../database/schema';

/** Who is taking the Hustle Check (question 1). Also used by the waitlist and the wall. */
export const PERSONAS = [
  'VISITOR',
  'SENDER',
  'DIASPORA',
  'RECEIVER',
] as const satisfies readonly LaunchPersona[];

/**
 * Points per answer for questions 2–5: how much of a hustle each answer signals. The website
 * shows the questions; only these codes reach the API, and the server computes the score.
 */
export const HUSTLE_POINTS = {
  lastTime: { SMOOTH: 0, DETOUR: 12, DECLINED: 22, STUCK: 25 },
  speed: { SECONDS: 0, SAME_DAY: 8, DAYS: 18, UNKNOWN: 25 },
  fees: { LOW: 0, SOME: 8, LOTS: 18, UNKNOWN: 22 },
  checking: { NEVER: 0, SOMETIMES: 8, OFTEN: 18, ALWAYS: 25 },
} as const satisfies Record<string, Record<string, number>>;

type Question = keyof typeof HUSTLE_POINTS;

export type HustleAnswers = {
  [Q in Question]: keyof (typeof HUSTLE_POINTS)[Q];
};

export const ANSWER_CODES = {
  lastTime: Object.keys(HUSTLE_POINTS.lastTime) as HustleAnswers['lastTime'][],
  speed: Object.keys(HUSTLE_POINTS.speed) as HustleAnswers['speed'][],
  fees: Object.keys(HUSTLE_POINTS.fees) as HustleAnswers['fees'][],
  checking: Object.keys(HUSTLE_POINTS.checking) as HustleAnswers['checking'][],
};

const MAX_POINTS = Object.values(HUSTLE_POINTS).reduce(
  (sum, answers) => sum + Math.max(...Object.values(answers)),
  0,
);

/** 0 (no hustle at all) to 100 (every answer is the worst case). */
export function hustleScore(answers: HustleAnswers): number {
  const points =
    HUSTLE_POINTS.lastTime[answers.lastTime] +
    HUSTLE_POINTS.speed[answers.speed] +
    HUSTLE_POINTS.fees[answers.fees] +
    HUSTLE_POINTS.checking[answers.checking];
  return Math.round((points * 100) / MAX_POINTS);
}

export type HustleTier = 'SMOOTH' | 'PART_TIME' | 'CERTIFIED' | 'LEGEND';

export function hustleTier(score: number): HustleTier {
  if (score >= 75) {
    return 'LEGEND';
  }
  if (score >= 50) {
    return 'CERTIFIED';
  }
  if (score >= 25) {
    return 'PART_TIME';
  }
  return 'SMOOTH';
}

/**
 * Mid-rank percentile against the other responses: the share with a lower score, ties counted
 * as half. Null when nobody else has taken the check yet.
 */
export function hustlePercentile(below: number, equal: number, others: number): number | null {
  if (others <= 0) {
    return null;
  }
  return Math.round(((below + equal / 2) * 100) / others);
}

/** Aggregate insights are only shown once enough people answered for them to mean something. */
export const MIN_RESPONSES_FOR_INSIGHTS = 10;
