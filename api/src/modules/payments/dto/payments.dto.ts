import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty()
  @IsUUID()
  quoteId: string;

  @ApiPropertyOptional({
    maxLength: 60,
    description: 'Optional note for the merchant SMS, e.g. "2 baskets"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  note?: string;

  @ApiPropertyOptional({
    enum: ['APP', 'WEB'],
    description: 'Where 3-D Secure returns to: the app deep link (default) or the web portal',
  })
  @IsOptional()
  @IsIn(['APP', 'WEB'])
  returnTo?: 'APP' | 'WEB';
}

export const HISTORY_FILTERS = [
  'ALL',
  'COMPLETED',
  'IN_PROGRESS',
  'FAILED',
  'IN_REVIEW',
  'REFUNDED',
] as const;

export class ListPaymentsQuery {
  @ApiPropertyOptional({ enum: HISTORY_FILTERS })
  @IsOptional()
  @IsIn(HISTORY_FILTERS)
  status?: (typeof HISTORY_FILTERS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
