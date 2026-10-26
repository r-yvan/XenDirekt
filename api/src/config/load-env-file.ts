import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Developer convenience: loads api/.env when present, unless NODE_ENV=production.
 * Variables already set in the real environment win. Deployed environments inject variables
 * from their secret manager and never ship a .env file.
 */
export function loadLocalEnvFile(path = resolve(process.cwd(), '.env')): void {
  if (process.env.NODE_ENV === 'production' || !existsSync(path)) {
    return;
  }
  process.loadEnvFile(path);
}
