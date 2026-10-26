import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBase64,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ enum: ['EMAIL', 'SMS'] })
  @IsIn(['EMAIL', 'SMS'])
  channel: 'EMAIL' | 'SMS';

  @ApiProperty({ description: 'Email address, or international phone number in E.164 (+...)' })
  @IsString()
  @Length(3, 254)
  destination: string;

  @ApiPropertyOptional({
    enum: ['en', 'fr'],
    description: 'Message language; defaults to Accept-Language',
  })
  @IsOptional()
  @IsIn(['en', 'fr'])
  locale?: 'en' | 'fr';
}

export class DeviceDto {
  @ApiProperty({ description: 'App-generated install ID (random UUID kept in secure storage)' })
  @IsString()
  @Length(16, 128)
  deviceId: string;

  @ApiPropertyOptional({ enum: ['ios', 'android'] })
  @IsOptional()
  @IsIn(['ios', 'android'])
  platform?: 'ios' | 'android';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

export class VerifyOtpDto extends DeviceDto {
  @ApiProperty()
  @IsUUID()
  challengeId: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'otp must be 6 digits' })
  otp: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  refreshToken: string;

  @ApiProperty()
  @IsString()
  @Length(16, 128)
  deviceId: string;
}

const STEP_UP_PURPOSES = [
  'PAYMENT',
  'CHANGE_PIN',
  'DELETE_ACCOUNT',
  'REGISTER_DEVICE_KEY',
] as const;

export class StepUpChallengeDto {
  @ApiProperty({ enum: STEP_UP_PURPOSES })
  @IsIn(STEP_UP_PURPOSES)
  purpose: (typeof STEP_UP_PURPOSES)[number];
}

export class StepUpDto {
  @ApiProperty({ enum: STEP_UP_PURPOSES })
  @IsIn(STEP_UP_PURPOSES)
  purpose: (typeof STEP_UP_PURPOSES)[number];

  @ApiProperty({ enum: ['PIN', 'DEVICE_KEY'] })
  @IsIn(['PIN', 'DEVICE_KEY'])
  method: 'PIN' | 'DEVICE_KEY';

  @ApiPropertyOptional({ description: 'Required when method = PIN' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'pin must be 6 digits' })
  pin?: string;

  @ApiPropertyOptional({ description: 'Required when method = DEVICE_KEY' })
  @IsOptional()
  @IsUUID()
  challengeId?: string;

  @ApiPropertyOptional({ description: 'base64 signature over the challenge signingMessage' })
  @IsOptional()
  @IsBase64()
  @MaxLength(256)
  signature?: string;
}

export class SetPinDto {
  @ApiProperty({ example: '482913' })
  @Matches(/^\d{6}$/, { message: 'pin must be 6 digits' })
  pin: string;
}

export class RegisterDeviceKeyDto {
  @ApiProperty({ enum: ['ED25519', 'ES256'] })
  @IsIn(['ED25519', 'ES256'])
  algorithm: 'ED25519' | 'ES256';

  @ApiProperty({ description: 'Ed25519: raw 32-byte key, base64. ES256: SPKI DER, base64.' })
  @IsBase64()
  @MaxLength(512)
  publicKey: string;
}
