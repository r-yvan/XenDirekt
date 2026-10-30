import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  type AuthenticatedAdmin,
  CurrentAdmin,
  RequiresAdminPermission,
} from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Clock } from '../../shared/time/clock';
import {
  AdminPaymentsService,
  REVIEW_ACTIONS,
  type ReviewAction,
} from './application/admin-payments.service';
import { ALL_STATES } from './domain/payment-state-machine';

class SearchPaymentsQuery {
  @ApiPropertyOptional({ description: 'XD- reference or provider reference' })
  @IsOptional()
  @IsString()
  @Length(3, 64)
  reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 254) email?: string;
  @ApiPropertyOptional({ description: 'Tourist phone (E.164)' })
  @IsOptional()
  @IsString()
  @Length(6, 20)
  phone?: string;
  @ApiPropertyOptional({ description: 'Seller MoMo number' })
  @IsOptional()
  @IsString()
  @Length(6, 20)
  momo?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}$/) last4?: string;
  @ApiPropertyOptional({ enum: ALL_STATES })
  @IsOptional()
  @IsIn(ALL_STATES)
  state?: (typeof ALL_STATES)[number];
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() to?: Date;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

class ReviewActionDto {
  @ApiProperty({ enum: REVIEW_ACTIONS }) @IsIn(REVIEW_ACTIONS) action: ReviewAction;
  @ApiProperty({ description: 'Why (kept in the audit log)' })
  @IsString()
  @Length(5, 500)
  reason: string;
}

class MetricsQuery {
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}

@ApiTags('admin: payments')
@ApiBearerAuth('admin')
@Controller('v1/admin')
export class AdminPaymentsController {
  constructor(
    private readonly payments: AdminPaymentsService,
    private readonly clock: Clock,
  ) {}

  @Get('payments')
  @RequiresAdminPermission('payments:read')
  @RateLimit({ name: 'admin-search', key: 'admin', limit: 120, windowSeconds: 60 })
  search(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() query: SearchPaymentsQuery) {
    return this.payments.search(admin, query);
  }

  @Get('payments/:id')
  @RequiresAdminPermission('payments:read')
  detail(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payments.detail(admin, id);
  }

  @Get('review-queue')
  @RequiresAdminPermission('payments:read')
  queue() {
    return this.payments.reviewQueue();
  }

  @Post('payments/:id/actions')
  @RequiresAdminPermission('payments:review')
  @RateLimit({ name: 'admin-review', key: 'admin', limit: 60, windowSeconds: 60 })
  act(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReviewActionDto,
  ) {
    return this.payments.act(admin, id, body.action, body.reason);
  }

  @Get('metrics/summary')
  @RequiresAdminPermission('metrics:read')
  metrics(@Query() query: MetricsQuery) {
    const to = query.to ?? this.clock.now();
    const from = query.from ?? new Date(to.getTime() - 7 * 86_400_000);
    return this.payments.metrics(from, to);
  }
}
