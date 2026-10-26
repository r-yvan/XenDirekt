import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { EmailSender, SmsSender } from './channels/channel.types';
import {
  DevInboxEmailSender,
  DisabledEmailSender,
  SmtpEmailSender,
} from './channels/email.senders';
import { DevEmailBridgeSmsSender, DisabledSmsSender } from './channels/sms.senders';

/** Delivery channel ports chosen from configuration; tests override them with in-memory fakes. */
@Global()
@Module({
  providers: [
    {
      provide: EmailSender,
      inject: [AppConfig],
      useFactory: (config: AppConfig): EmailSender => {
        switch (config.notifications.email.transport) {
          case 'smtp':
            return new SmtpEmailSender(config.notifications.email);
          case 'dev-inbox':
            return new DevInboxEmailSender();
          default:
            return new DisabledEmailSender();
        }
      },
    },
    {
      provide: SmsSender,
      inject: [AppConfig, EmailSender],
      useFactory: (config: AppConfig, email: EmailSender): SmsSender =>
        config.notifications.smsTransport === 'dev-email-bridge'
          ? new DevEmailBridgeSmsSender(email)
          : new DisabledSmsSender(),
    },
  ],
  exports: [EmailSender, SmsSender],
})
export class NotificationChannelsModule {}
