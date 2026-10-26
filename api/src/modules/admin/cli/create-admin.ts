import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { loadLocalEnvFile } from '../../../config/load-env-file';
import { AdminAuthService } from '../admin-auth.service';

/**
 * Bootstraps an administrator (normally the first ADMIN):
 *   npm run admin:create -- --email ops@example.com --name "Ops Lead" --role ADMIN
 * Prints a one-time initial password and TOTP provisioning URI. Run it in a private terminal;
 * the output is a credential and must be handed over securely, never pasted into tickets or chat.
 */
async function main(): Promise<void> {
  loadLocalEnvFile();
  const args = new Map<string, string>();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) {
    args.set((argv[index] ?? '').replace(/^--/, ''), argv[index + 1] ?? '');
  }
  const email = args.get('email');
  const fullName = args.get('name');
  const role = (args.get('role') ?? 'ADMIN') as
    'VIEWER' | 'SUPPORT_AGENT' | 'RISK_ANALYST' | 'ADMIN';
  if (!email || !fullName || !['VIEWER', 'SUPPORT_AGENT', 'RISK_ANALYST', 'ADMIN'].includes(role)) {
    throw new Error(
      'Usage: --email <email> --name "<full name>" --role VIEWER|SUPPORT_AGENT|RISK_ANALYST|ADMIN',
    );
  }
  process.env.WORKER_MODE = 'disabled';
  const app = await NestFactory.createApplicationContext(AppModule.forRoot({ role: 'api' }), {
    logger: false,
  });
  try {
    const created = await app
      .get(AdminAuthService)
      .createAdmin({ email, fullName, role, createdBy: 'cli' });
    console.log(`Administrator created: ${created.email} (${created.role})`);
    console.log(`Initial password (shown once): ${created.initialPassword}`);
    console.log(`TOTP secret (shown once):      ${created.totpSecret}`);
    console.log(`TOTP provisioning URI:         ${created.totpProvisioningUri}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
