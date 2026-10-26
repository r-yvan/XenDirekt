import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AppConfig } from '../../config/app-config';
import { EmailSender } from '../notifications/channels/channel.types';
import { DevInboxEmailSender } from '../notifications/channels/email.senders';

/** Local/test only. Returns 404 unless EMAIL_TRANSPORT=dev-inbox in a development-like environment. */
@ApiExcludeController()
@Public()
@Controller('dev/inbox')
export class DevInboxController {
  constructor(
    private readonly config: AppConfig,
    private readonly email: EmailSender,
  ) {}

  @Get()
  list(@Query('to') to?: string) {
    if (!this.config.isDevelopmentLike || !(this.email instanceof DevInboxEmailSender)) {
      throw new NotFoundException();
    }
    return { messages: this.email.list(to) };
  }
}
