import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { type AuthenticatedUser, CurrentUser } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { PaymentsService } from './application/payments.service';
import { CreatePaymentDto, ListPaymentsQuery } from './dto/payments.dto';

@ApiTags('payments')
@ApiBearerAuth('user')
@Controller('v1/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Pay a quote. Same Idempotency-Key + same body returns the original payment (200).',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'App-generated, 8–100 chars [A-Za-z0-9_-]',
  })
  @ApiHeader({
    name: 'X-Step-Up-Token',
    required: true,
    description: 'purpose PAYMENT (biometric or PIN)',
  })
  @RateLimit({ name: 'payment-create', key: 'user', limit: 20, windowSeconds: 600 })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-step-up-token') stepUpToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { payment, created } = await this.payments.create(
      user,
      body,
      idempotencyKey,
      stepUpToken,
    );
    res.status(created ? 201 : 200);
    return payment;
  }

  @Get()
  @ApiOperation({ summary: 'Payment history, newest first, cursor-paginated' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListPaymentsQuery) {
    return this.payments.list(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Live status (poll while not final); includes the receipt once completed',
  })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payments.get(user, id);
  }
}
