import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const TICKET_CATEGORIES = [
  'SELLER_NOT_PAID',
  'WRONG_AMOUNT',
  'CHARGED_BUT_FAILED',
  'CHARGED_TWICE',
  'WRONG_SELLER',
  'REFUND_REQUEST',
  'APP_PROBLEM',
  'OTHER',
] as const;
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export class CreateTicketDto {
  @ApiProperty({ enum: TICKET_CATEGORIES })
  @IsIn(TICKET_CATEGORIES)
  category: (typeof TICKET_CATEGORIES)[number];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class AdminTicketsQuery {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  mine?: boolean;
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}
