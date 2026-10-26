import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { CreateQuoteDto } from './dto/quotes.dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth('user')
@Controller('v1/quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Post()
  @ApiOperation({ summary: 'Fee, FX rate and card-currency total, valid for 5 minutes' })
  @RateLimit({ name: 'quote-user', key: 'user', limit: 120, windowSeconds: 600 })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateQuoteDto) {
    return this.quotes.create(user, body);
  }
}
