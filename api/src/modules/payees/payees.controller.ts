import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { LookupPayeeDto } from './dto/payees.dto';
import { PayeesService } from './payees.service';

@ApiTags('payees')
@ApiBearerAuth('user')
@Controller('v1/payees')
export class PayeesController {
  constructor(private readonly payees: PayeesService) {}

  @Post('lookup')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Registered account name for an MTN MoMo number (or merchant code when enabled)',
  })
  @RateLimit(
    { name: 'payee-lookup-user', key: 'user', limit: 60, windowSeconds: 600 },
    { name: 'payee-lookup-user-daily', key: 'user', limit: 300, windowSeconds: 86_400 },
  )
  lookup(@CurrentUser() _user: AuthenticatedUser, @Body() body: LookupPayeeDto) {
    return this.payees.lookup(body.identifierType, body.identifier);
  }

  @Get('recent')
  recent(@CurrentUser() user: AuthenticatedUser) {
    return this.payees.recent(user);
  }
}
