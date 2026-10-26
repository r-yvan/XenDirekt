import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';

export class LookupPayeeDto {
  @ApiProperty({ enum: ['PHONE', 'MERCHANT_CODE'] })
  @IsIn(['PHONE', 'MERCHANT_CODE'])
  identifierType: 'PHONE' | 'MERCHANT_CODE';

  @ApiProperty({
    example: '0788 123 456',
    description: 'As typed or pasted; normalised server-side',
  })
  @IsString()
  @Length(3, 32)
  identifier: string;
}
