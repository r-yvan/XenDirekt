import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import {
  type AuthenticatedAdmin,
  CurrentAdmin,
  RequiresAdminPermission,
} from '../../common/decorators/auth.decorators';
import { ReconciliationService, SETTLEMENT_CSV_HEADER } from './reconciliation.service';

class RunDto {
  @ApiProperty({ example: '2026-10-25', description: 'Kigali business date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  businessDate: string;
}
class SettlementDto extends RunDto {
  @ApiProperty() @IsString() @Length(1, 200) fileName: string;
  @ApiProperty({
    description: `CSV text with header "${SETTLEMENT_CSV_HEADER}" (provisional layout)`,
  })
  @IsString()
  @MaxLength(5_000_000)
  content: string;
}
class ResolveDto {
  @ApiProperty({ enum: ['RESOLVED', 'NOT_APPLICABLE'] })
  @IsIn(['RESOLVED', 'NOT_APPLICABLE'])
  status: 'RESOLVED' | 'NOT_APPLICABLE';
  @ApiProperty() @IsString() @Length(5, 500) note: string;
}
class ItemsQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unresolved?: boolean;
}

@ApiTags('admin: reconciliation')
@ApiBearerAuth('admin')
@Controller('v1/admin/reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Get('runs')
  @RequiresAdminPermission('reconciliation:read')
  runs() {
    return this.reconciliation.runs();
  }

  @Post('runs')
  @RequiresAdminPermission('reconciliation:manage')
  run(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() body: RunDto) {
    return this.reconciliation.runStatusReconciliation(body.businessDate, admin.adminId);
  }

  @Post('settlement-files')
  @RequiresAdminPermission('reconciliation:manage')
  importFile(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() body: SettlementDto) {
    return this.reconciliation.importSettlementFile(
      admin,
      body.businessDate,
      body.fileName,
      body.content,
    );
  }

  @Get('runs/:id/items')
  @RequiresAdminPermission('reconciliation:read')
  items(@Param('id', new ParseUUIDPipe()) id: string, @Query() query: ItemsQuery) {
    return this.reconciliation.items(id, query.unresolved ?? false);
  }

  @Get('runs/:id/export.csv')
  @RequiresAdminPermission('reconciliation:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  export(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reconciliation.exportCsv(id);
  }

  @Patch('items/:id')
  @RequiresAdminPermission('reconciliation:manage')
  resolve(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ResolveDto,
  ) {
    return this.reconciliation.resolve(admin, id, body.status, body.note);
  }
}
