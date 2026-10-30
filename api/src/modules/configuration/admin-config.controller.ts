import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDefined, IsIn, IsOptional, IsString, Length } from 'class-validator';
import {
  type AuthenticatedAdmin,
  CurrentAdmin,
  RequiresAdminPermission,
} from '../../common/decorators/auth.decorators';
import type { ConfigKey } from '../../database/schema';
import { ConfigurationService } from './configuration.service';

const KEYS = ['FEES', 'LIMITS', 'FX_RATES', 'CARD_RULES', 'PAYEE_ROUTING'] as const;

class KeyParam {
  @IsIn(KEYS) key: ConfigKey;
  @IsOptional() @IsString() version?: string;
}
class DraftDto {
  @ApiProperty({ description: 'Validated against the schema for this key' })
  @IsDefined()
  value: unknown;
  @ApiProperty() @IsString() @Length(5, 500) changeReason: string;
}
class ActivateDto {
  @ApiPropertyOptional({
    description:
      'Business approval evidence (e.g. PM sign-off). Without it the version is unapproved and production will not price with it.',
  })
  @IsOptional()
  @IsString()
  @Length(3, 200)
  approvalReference?: string;
}

/** FR-ADM-05: fees, limits, FX, card rules and payee routing without a release. */
@ApiTags('admin: configuration')
@ApiBearerAuth('admin')
@Controller('v1/admin/config')
export class AdminConfigController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get(':key')
  @RequiresAdminPermission('config:read')
  async list(@Param() params: KeyParam) {
    return {
      active: await this.configuration.get(params.key),
      versions: await this.configuration.list(params.key),
    };
  }

  @Post(':key')
  @RequiresAdminPermission('config:manage')
  draft(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param() params: KeyParam,
    @Body() body: DraftDto,
  ) {
    return this.configuration.createDraft(params.key, body.value, body.changeReason, admin.adminId);
  }

  @Post(':key/versions/:version/activate')
  @RequiresAdminPermission('config:manage')
  activate(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param() params: KeyParam,
    @Param('version', ParseIntPipe) version: number,
    @Body() body: ActivateDto,
  ) {
    return this.configuration.activate(params.key, version, admin.adminId, body.approvalReference);
  }
}
