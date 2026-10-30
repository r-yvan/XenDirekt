import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AllowPendingProfile,
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth('user')
@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  @HttpCode(202)
  @AllowPendingProfile()
  @RateLimit({ name: 'analytics', key: 'user', limit: 120, windowSeconds: 600 })
  ingest(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.analytics.ingest(user, body);
  }
}
