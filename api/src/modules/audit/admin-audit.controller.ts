import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RequiresAdminPermission } from '../../common/decorators/auth.decorators';
import { AuditService } from './audit.service';

class AuditQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() actorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() to?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() before?: Date;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

/** FR-ADM-08: who did what, when, before/after (already redacted at write time). */
@ApiTags('admin: audit')
@ApiBearerAuth('admin')
@Controller('v1/admin/audit-logs')
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequiresAdminPermission('audit:read')
  async list(@Query() query: AuditQuery) {
    const { entityType, entityId, actorId, action, from, to, before, limit } = query;
    return {
      entries: await this.audit.search({
        entityType,
        entityId,
        actorId,
        action,
        from,
        to,
        before,
        limit: limit ?? 100,
      }),
    };
  }
}
