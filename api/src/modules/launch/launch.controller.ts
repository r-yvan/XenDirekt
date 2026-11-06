import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  type AuthenticatedAdmin,
  CurrentAdmin,
  RequiresAdminPermission,
} from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { roleHasPermission } from '../admin/permissions';
import { normaliseLocale } from '../notifications/templates/otp.template';
import {
  AdminStoriesQuery,
  AdminWaitlistQuery,
  HustleCheckDto,
  JoinWaitlistDto,
  LeaveWaitlistDto,
  ListStoriesQuery,
  ModerateStoryDto,
  SubmitStoryDto,
} from './dto/launch.dto';
import { HustleCheckService } from './hustle-check.service';
import { StoriesService } from './stories.service';
import { WaitlistService } from './waitlist.service';

/**
 * The public pre-launch website (/web): waitlist, Hustle Check and the Wall of Hustle.
 * Everything here is anonymous or self-service and rate limited per client IP.
 */
@ApiTags('launch')
@Public()
@Controller('v1/launch')
export class LaunchController {
  constructor(
    private readonly waitlist: WaitlistService,
    private readonly hustleCheck: HustleCheckService,
    private readonly stories: StoriesService,
  ) {}

  @Post('waitlist')
  @ApiOperation({
    summary: 'Join the waitlist (201), or get the existing spot for this email (200)',
  })
  @RateLimit(
    { name: 'waitlist-join-ip', key: 'ip', limit: 30, windowSeconds: 3600 },
    { name: 'waitlist-join-email', key: 'body:email', limit: 5, windowSeconds: 3600 },
  )
  async join(
    @Body() body: JoinWaitlistDto,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { view, created } = await this.waitlist.join({
      email: body.email,
      fullName: body.fullName,
      persona: body.persona,
      countryCode: body.countryCode,
      referralCode: body.referralCode,
      source: body.source,
      locale: body.locale ?? normaliseLocale(acceptLanguage),
    });
    res.status(created ? 201 : 200);
    return view;
  }

  @Get('waitlist/:referralCode')
  @ApiOperation({ summary: 'Public spot on the list for a referral code (no personal data)' })
  @RateLimit({ name: 'waitlist-status-ip', key: 'ip', limit: 120, windowSeconds: 600 })
  status(@Param('referralCode') referralCode: string) {
    return this.waitlist.statusByReferralCode(referralCode.toUpperCase());
  }

  @Post('waitlist/leave')
  @HttpCode(204)
  @ApiOperation({ summary: 'Leave the waitlist and delete the entry (token from the email)' })
  @RateLimit({ name: 'waitlist-leave-ip', key: 'ip', limit: 20, windowSeconds: 3600 })
  async leave(@Body() body: LeaveWaitlistDto): Promise<void> {
    await this.waitlist.leave(body.token);
  }

  @Post('hustle-check')
  @HttpCode(201)
  @ApiOperation({ summary: 'Score an anonymous Hustle Check and compare it with everyone else' })
  @RateLimit({ name: 'hustle-check-ip', key: 'ip', limit: 20, windowSeconds: 3600 })
  check(@Body() body: HustleCheckDto) {
    return this.hustleCheck.submit(body);
  }

  @Get('stories')
  @ApiOperation({ summary: 'Approved Wall of Hustle stories, newest first' })
  @RateLimit({ name: 'stories-list-ip', key: 'ip', limit: 120, windowSeconds: 600 })
  listStories(@Query() query: ListStoriesQuery) {
    return this.stories.listPublished(query.limit);
  }

  @Post('stories')
  @HttpCode(202)
  @ApiOperation({ summary: 'Submit an anonymous story; it appears only after review' })
  @RateLimit({ name: 'stories-submit-ip', key: 'ip', limit: 5, windowSeconds: 3600 })
  submitStory(@Body() body: SubmitStoryDto) {
    return this.stories.submit(body);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Live counters for the website' })
  @RateLimit({ name: 'launch-stats-ip', key: 'ip', limit: 120, windowSeconds: 600 })
  async stats() {
    const [waitlist, hustleCheck, published] = await Promise.all([
      this.waitlist.total(),
      this.hustleCheck.totals(),
      this.stories.countPublished(),
    ]);
    return {
      waitlist: { total: waitlist },
      hustleCheck,
      stories: { published },
    };
  }
}

@ApiTags('admin: launch')
@ApiBearerAuth('admin')
@Controller('v1/admin/launch')
export class AdminLaunchController {
  constructor(
    private readonly waitlist: WaitlistService,
    private readonly hustleCheck: HustleCheckService,
    private readonly stories: StoriesService,
  ) {}

  @Get('waitlist')
  @RequiresAdminPermission('launch:read')
  @ApiOperation({
    summary: 'Waitlist entries, newest first (masked without personal-data:unmasked)',
  })
  listWaitlist(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() query: AdminWaitlistQuery) {
    return this.waitlist.listForAdmin(
      query,
      roleHasPermission(admin.role, 'personal-data:unmasked'),
    );
  }

  @Get('hustle-check')
  @RequiresAdminPermission('launch:read')
  @ApiOperation({ summary: 'How often each Hustle Check answer was given' })
  hustleCheckSummary() {
    return this.hustleCheck.summary();
  }

  @Get('stories')
  @RequiresAdminPermission('launch:read')
  @ApiOperation({ summary: 'Wall of Hustle stories for review' })
  listStories(@Query() query: AdminStoriesQuery) {
    return this.stories.listForAdmin(query);
  }

  @Patch('stories/:id')
  @RequiresAdminPermission('launch:moderate')
  @ApiOperation({ summary: 'Approve (publish) or reject a story; audited' })
  moderate(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ModerateStoryDto,
  ) {
    return this.stories.moderate(admin, id, body);
  }
}
