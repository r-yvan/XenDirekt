import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { sha256Hex } from '../../shared/crypto/tokens';
import { RATE_LIMIT_RULES, RateLimitRule } from '../decorators/rate-limit.decorator';
import { AppError } from '../errors/app-error';
import { RateLimitStore } from './rate-limit.store';

type AuthenticatedRequest = Request & {
  user?: { userId: string };
  admin?: { adminId: string };
};

/**
 * Applies @RateLimit rules. Runs after authentication so per-user rules see the principal.
 * If the counter store fails, the request is allowed and a warning logged: availability wins
 * for read paths. Money-moving paths also rely on idempotency and database constraints.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly store: RateLimitStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[] | undefined>(RATE_LIMIT_RULES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rules || rules.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    for (const rule of rules) {
      const subject = this.subjectFor(rule, request);
      let hit;
      try {
        hit = await this.store.hit(`${rule.name}:${subject}`, rule.windowSeconds * 1000);
      } catch (error) {
        this.logger.warn(
          { rule: rule.name, err: error },
          'Rate limit store unavailable; allowing request',
        );
        continue;
      }
      if (hit.count > rule.limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil(hit.resetMs / 1000));
        response.setHeader('Retry-After', String(retryAfterSeconds));
        throw new AppError('RATE_LIMITED', undefined, { retryAfterSeconds });
      }
    }
    return true;
  }

  private subjectFor(rule: RateLimitRule, request: AuthenticatedRequest): string {
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    switch (rule.key) {
      case 'ip':
        return `ip:${ip}`;
      case 'user':
        return request.user ? `user:${request.user.userId}` : `ip:${ip}`;
      case 'admin':
        return request.admin ? `admin:${request.admin.adminId}` : `ip:${ip}`;
      case 'device': {
        const device = request.headers['x-device-id'];
        return typeof device === 'string' && device.length > 0
          ? `device:${sha256Hex(device)}`
          : `ip:${ip}`;
      }
      default: {
        const field = rule.key.slice('body:'.length);
        const body = (request.body ?? {}) as Record<string, unknown>;
        const value = body[field];
        const normalised = typeof value === 'string' ? value.trim().toLowerCase() : '';
        return normalised ? `${field}:${sha256Hex(normalised)}` : `ip:${ip}`;
      }
    }
  }
}
