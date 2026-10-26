import {
  ChannelNotConfiguredError,
  DeliveryReceipt,
  EmailSender,
  SmsMessage,
  SmsSender,
} from './channel.types';

/** No SMS gateway contracted yet (docs/open-questions.md OQ-06, OQ-31). */
export class DisabledSmsSender extends SmsSender {
  readonly configured = false;

  send(): Promise<DeliveryReceipt> {
    return Promise.reject(new ChannelNotConfiguredError('SMS'));
  }
}

/**
 * Local/test only (startup guards forbid it elsewhere): delivers SMS text to the SMTP sink
 * (Mailpit) as an email to sms+<number>@dev.xendirekt.local, so developers can read codes
 * without a gateway and without anything being logged.
 */
export class DevEmailBridgeSmsSender extends SmsSender {
  readonly configured: boolean;

  constructor(private readonly email: EmailSender) {
    super();
    this.configured = email.configured;
  }

  send(message: SmsMessage): Promise<DeliveryReceipt> {
    return this.email.send({
      to: `sms+${message.to.replace(/[^\d]/g, '')}@dev.xendirekt.local`,
      subject: `SMS to ${message.to}`,
      text: message.text,
    });
  }
}
