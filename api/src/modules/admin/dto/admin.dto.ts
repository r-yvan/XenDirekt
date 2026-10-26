import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

const ROLES = ['VIEWER', 'SUPPORT_AGENT', 'RISK_ANALYST', 'ADMIN'] as const;

export class AdminLoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @Length(8, 200)
  password: string;
}

export class AdminTotpDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  challengeToken: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  totp: string;
}

export class AdminRefreshDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  refreshToken: string;
}

export class CreateAdminDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @Length(2, 120)
  fullName: string;

  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role: (typeof ROLES)[number];
}

export class UpdateAdminDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: (typeof ROLES)[number];

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}
