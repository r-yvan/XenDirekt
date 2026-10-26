import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateQuoteDto {
  @ApiProperty()
  @IsUUID()
  payeeId: string;

  @ApiProperty()
  @IsUUID()
  cardId: string;

  @ApiProperty({ description: 'Whole Rwandan francs the merchant receives', example: 12000 })
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountRwf: number;
}
