import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { CardsService } from './cards.service';
import { CompleteCardSetupDto, StartCardSetupDto, UpdateCardDto } from './dto/cards.dto';

@ApiTags('cards')
@ApiBearerAuth('user')
@Controller('v1/cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Post('setup')
  @ApiOperation({
    summary:
      'Start adding a card: returns the partner-hosted page URL (card details never reach XenDirekt)',
  })
  @RateLimit({ name: 'card-setup', key: 'user', limit: 10, windowSeconds: 3600 })
  setup(@CurrentUser() user: AuthenticatedUser, @Body() body: StartCardSetupDto) {
    return this.cards.startSetup(user, body.returnTo ?? 'APP');
  }

  @Post()
  @ApiOperation({
    summary: 'Finish adding a card from a completed setup; eligibility is checked server-side',
  })
  @RateLimit({ name: 'card-complete', key: 'user', limit: 20, windowSeconds: 3600 })
  complete(@CurrentUser() user: AuthenticatedUser, @Body() body: CompleteCardSetupDto) {
    return this.cards.completeSetup(user, body.setupId);
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return { cards: await this.cards.list(user) };
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() _body: UpdateCardDto,
  ) {
    return this.cards.makeDefault(user, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.cards.remove(user, id);
  }
}
