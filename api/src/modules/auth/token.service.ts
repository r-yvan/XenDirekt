import { Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { AppError } from '../../common/errors/app-error';
import { AppConfig } from '../../config/app-config';
import { Clock } from '../../shared/time/clock';

const ISSUER = 'xendirekt-api';
const USER_AUDIENCE = 'xendirekt-app';
const ADMIN_AUDIENCE = 'xendirekt-admin';

export interface UserTokenClaims {
  userId: string;
  sessionId: string;
}

export interface AdminTokenClaims {
  adminId: string;
  sessionId: string;
}

/**
 * Short-lived HS256 access tokens. User and admin tokens use different secrets AND audiences,
 * so one can never be accepted as the other. Revocation is enforced by checking the session on
 * every request (auth.guard.ts), not by token expiry alone.
 */
@Injectable()
export class TokenService {
  private readonly userKey: Uint8Array;
  private readonly adminKey: Uint8Array;

  constructor(
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {
    this.userKey = new TextEncoder().encode(config.auth.accessSecret);
    this.adminKey = new TextEncoder().encode(config.auth.adminSecret);
  }

  async issueUserToken(claims: UserTokenClaims): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = this.config.auth.accessTokenTtlSeconds;
    const token = await this.sign(
      claims.userId,
      claims.sessionId,
      USER_AUDIENCE,
      this.userKey,
      expiresIn,
    );
    return { token, expiresIn };
  }

  async issueAdminToken(claims: AdminTokenClaims): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = this.config.auth.adminAccessTokenTtlSeconds;
    const token = await this.sign(
      claims.adminId,
      claims.sessionId,
      ADMIN_AUDIENCE,
      this.adminKey,
      expiresIn,
    );
    return { token, expiresIn };
  }

  async verifyUserToken(token: string): Promise<UserTokenClaims> {
    const { subject, sessionId } = await this.verify(token, USER_AUDIENCE, this.userKey);
    return { userId: subject, sessionId };
  }

  async verifyAdminToken(token: string): Promise<AdminTokenClaims> {
    const { subject, sessionId } = await this.verify(token, ADMIN_AUDIENCE, this.adminKey);
    return { adminId: subject, sessionId };
  }

  private async sign(
    subject: string,
    sessionId: string,
    audience: string,
    key: Uint8Array,
    ttl: number,
  ): Promise<string> {
    const issuedAt = Math.floor(this.clock.nowMs() / 1000);
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(subject)
      .setIssuer(ISSUER)
      .setAudience(audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ttl)
      .sign(key);
  }

  private async verify(
    token: string,
    audience: string,
    key: Uint8Array,
  ): Promise<{ subject: string; sessionId: string }> {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience,
        currentDate: this.clock.now(),
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new Error('missing claims');
      }
      return { subject: payload.sub, sessionId: payload.sid };
    } catch {
      throw new AppError('UNAUTHENTICATED');
    }
  }
}
