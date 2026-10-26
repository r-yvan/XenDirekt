import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Oliver Martin' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @ApiPropertyOptional({ example: 'CA', description: 'ISO 3166-1 alpha-2' })
  @IsOptional()
  @IsISO31661Alpha2()
  countryOfResidence?: string;

  @ApiPropertyOptional({ example: '1990-04-12' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ['en', 'fr'] })
  @IsOptional()
  @IsIn(['en', 'fr'])
  preferredLanguage?: 'en' | 'fr';

  @ApiPropertyOptional({
    description:
      'true = the user tapped Continue under the Terms/Privacy notice (current versions are recorded)',
  })
  @IsOptional()
  @IsBoolean()
  acceptLegalTerms?: boolean;
}
