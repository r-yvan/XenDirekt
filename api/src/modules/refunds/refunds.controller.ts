import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import {
  type AuthenticatedAdmin,
  CurrentAdmin,
  RequiresAdminPermission,
} from '../../common/decorators/auth.decorators';
import { RefundsService } from './refunds.service';

class RequestRefundDto {
  @ApiProperty() @IsString() @Length(5, 500) reason: string;
  @ApiProperty({ description: '8–100 chars; the same key returns the same refund request' })
  @Matches(/^[A-Za-z0-9_-]{8,100}$/)
  idempotencyKey: string;
}
class NoteDto {
  @ApiProperty() @IsString() @Length(5, 500) note: string;
}
class ManualRefundDto extends NoteDto {
  @ApiProperty({ description: "Partner's refund reference (evidence)" })
  @IsString()
  @Length(3, 100)
  providerReference: string;
}
class ListRefundsQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    'REQUESTED',
    'APPROVED',
    'SUBMITTED',
    'SUCCEEDED',
    'FAILED',
    'REJECTED',
    'AWAITING_CAPABILITY',
    'RECORDED',
  ])
  status?: string;
}

@ApiTags('admin: refunds')
@ApiBearerAuth('admin')
@Controller('v1/admin')
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Post('payments/:id/refunds')
  @RequiresAdminPermission('refunds:request')
  request(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RequestRefundDto,
  ) {
    return this.refunds.request(admin, id, body.reason, body.idempotencyKey);
  }

  @Get('refunds')
  @RequiresAdminPermission('payments:read')
  list(@Query() query: ListRefundsQuery) {
    return this.refunds.list(query.status);
  }

  @Post('refunds/:id/approve')
  @RequiresAdminPermission('refunds:approve')
  approve(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.refunds.approve(admin, id);
  }

  @Post('refunds/:id/reject')
  @RequiresAdminPermission('refunds:approve')
  reject(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: NoteDto,
  ) {
    return this.refunds.reject(admin, id, body.note);
  }

  @Post('refunds/:id/record-manual')
  @RequiresAdminPermission('refunds:approve')
  recordManual(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ManualRefundDto,
  ) {
    return this.refunds.recordManual(admin, id, body.providerReference, body.note);
  }
}
