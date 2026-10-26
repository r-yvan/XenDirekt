import {
  DeliveryReceipt,
  EmailMessage,
  EmailSender,
  SmsMessage,
  SmsSender,
} from '../../src/modules/notifications/channels/channel.types';

export class InMemoryEmailSender extends EmailSender {
  readonly configured = true;
  readonly sent: EmailMessage[] = [];
  failNext = false;

  send(message: EmailMessage): Promise<DeliveryReceipt> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('SMTP unavailable'));
    }
    this.sent.push(message);
    return Promise.resolve({ providerMessageId: `email-${this.sent.length}` });
  }

  /** Extracts the 6-digit code from the latest message to `to`. */
  lastCodeFor(to: string): string {
    const message = [...this.sent].reverse().find((item) => item.to === to);
    const code = message?.text.match(/\b(\d{6})\b/)?.[1];
    if (!code) {
      throw new Error(`No code sent to ${to}`);
    }
    return code;
  }
}

export class InMemorySmsSender extends SmsSender {
  readonly configured = true;
  readonly sent: SmsMessage[] = [];

  send(message: SmsMessage): Promise<DeliveryReceipt> {
    this.sent.push(message);
    return Promise.resolve({ providerMessageId: `sms-${this.sent.length}` });
  }

  lastCodeFor(to: string): string {
    const message = [...this.sent].reverse().find((item) => item.to === to);
    const code = message?.text.match(/\b(\d{6})\b/)?.[1];
    if (!code) {
      throw new Error(`No SMS code sent to ${to}`);
    }
    return code;
  }
}
