import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsUUID } from 'class-validator';

export class CompleteCardSetupDto {
  @ApiProperty({ description: 'setupId returned by POST /v1/cards/setup' })
  @IsUUID()
  setupId: string;
}

export class UpdateCardDto {
  @ApiProperty({ enum: [true] })
  @Equals(true)
  isDefault: true;
}
