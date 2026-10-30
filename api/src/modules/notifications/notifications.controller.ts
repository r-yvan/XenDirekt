import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, Length } from 'class-validator';
import { type AuthenticatedUser, CurrentUser } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { NotificationsService } from './notifications.service';

class InboxQuery {
  @ApiPropertyOptional({ description: 'ISO timestamp: notifications created before this' })
  @IsOptional()
  @IsISO8601()
  before?: string;
}

class PushTokenDto {
  @ApiProperty({ enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @ApiProperty()
  @IsString()
  @Length(10, 4096)
  token: string;
}

@ApiTags('notifications')
@ApiBearerAuth('user')
@Controller('v1')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  inbox(@CurrentUser() user: AuthenticatedUser, @Query() query: InboxQuery) {
    return this.notifications.inbox(user, query.before);
  }

  @Post('notifications/:id/read')
  @HttpCode(204)
  async read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.notifications.markRead(user, id);
  }

  @Post('push-tokens')
  @HttpCode(204)
  @RateLimit({ name: 'push-token', key: 'user', limit: 20, windowSeconds: 3600 })
  async pushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PushTokenDto,
  ): Promise<void> {
    await this.notifications.registerPushToken(user, body.platform, body.token);
  }
}
