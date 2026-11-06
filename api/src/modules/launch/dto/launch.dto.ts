import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsIn,
  IsInt,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { LaunchPersona, StoryStatus } from '../../../database/schema';
import { ANSWER_CODES, HustleAnswers, PERSONAS } from '../domain/hustle-check';
import { MANAGE_TOKEN_PATTERN, REFERRAL_CODE_PATTERN } from '../domain/waitlist';

export class JoinWaitlistDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ example: 'Ana Silva', maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  fullName?: string;

  @ApiPropertyOptional({ enum: PERSONAS })
  @IsOptional()
  @IsIn(PERSONAS)
  persona?: LaunchPersona;

  @ApiPropertyOptional({ example: 'CA', description: 'ISO 3166-1 alpha-2' })
  @IsOptional()
  @IsISO31661Alpha2()
  countryCode?: string;

  @ApiPropertyOptional({ example: 'K7M2QX9A', description: 'From a friend’s ?ref= link' })
  @IsOptional()
  @Matches(REFERRAL_CODE_PATTERN, { message: 'referralCode is not a valid code' })
  referralCode?: string;

  @ApiPropertyOptional({ example: 'hero', description: 'Where on the site the person joined' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9_.-]{1,40}$/, { message: 'source must be a short label' })
  source?: string;

  @ApiPropertyOptional({ enum: ['en', 'fr'] })
  @IsOptional()
  @IsIn(['en', 'fr'])
  locale?: 'en' | 'fr';

  @ApiProperty({ enum: [true], description: 'The person accepted the privacy notice' })
  @Equals(true, { message: 'acceptPrivacy must be true' })
  acceptPrivacy: true;
}

export class LeaveWaitlistDto {
  @ApiProperty({ description: 'The token from the "leave the list" email link' })
  @Matches(MANAGE_TOKEN_PATTERN, { message: 'token is not valid' })
  token: string;
}

export class HustleCheckDto implements HustleAnswers {
  @ApiProperty({ enum: PERSONAS })
  @IsIn(PERSONAS)
  persona: LaunchPersona;

  @ApiProperty({ enum: ANSWER_CODES.lastTime })
  @IsIn(ANSWER_CODES.lastTime)
  lastTime: HustleAnswers['lastTime'];

  @ApiProperty({ enum: ANSWER_CODES.speed })
  @IsIn(ANSWER_CODES.speed)
  speed: HustleAnswers['speed'];

  @ApiProperty({ enum: ANSWER_CODES.fees })
  @IsIn(ANSWER_CODES.fees)
  fees: HustleAnswers['fees'];

  @ApiProperty({ enum: ANSWER_CODES.checking })
  @IsIn(ANSWER_CODES.checking)
  checking: HustleAnswers['checking'];
}

export class SubmitStoryDto {
  @ApiProperty({ minLength: 20, maxLength: 600 })
  @IsString()
  @Length(20, 600)
  body: string;

  @ApiPropertyOptional({ example: 'BE', description: 'ISO 3166-1 alpha-2' })
  @IsOptional()
  @IsISO31661Alpha2()
  countryCode?: string;

  @ApiPropertyOptional({ enum: PERSONAS })
  @IsOptional()
  @IsIn(PERSONAS)
  persona?: LaunchPersona;
}

export class ListStoriesQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}

const STORY_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const satisfies StoryStatus[];

export class AdminStoriesQuery {
  @ApiPropertyOptional({ enum: STORY_STATUSES })
  @IsOptional()
  @IsIn(STORY_STATUSES)
  status?: StoryStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ModerateStoryDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AdminWaitlistQuery {
  @ApiPropertyOptional({ description: 'nextCursor from the previous page' })
  @IsOptional()
  @Matches(/^\d{1,18}$/, { message: 'cursor is not valid' })
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: PERSONAS })
  @IsOptional()
  @IsIn(PERSONAS)
  persona?: LaunchPersona;
}
