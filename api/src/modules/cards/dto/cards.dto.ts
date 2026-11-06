import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsIn, IsOptional, IsUUID } from 'class-validator';

export class StartCardSetupDto {
  @ApiPropertyOptional({
    enum: ['APP', 'WEB'],
    description:
      'Where the hosted card page returns to: the app deep link (default) or the web portal',
  })
  @IsOptional()
  @IsIn(['APP', 'WEB'])
  returnTo?: 'APP' | 'WEB';
}

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
