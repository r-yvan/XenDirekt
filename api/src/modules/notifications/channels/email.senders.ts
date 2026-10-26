import nodemailer, { Transporter } from 'nodemailer';
import { AppConfig } from '../../../config/app-config';
import {
  ChannelNotConfiguredError,
  DeliveryReceipt,
  EmailMessage,
  EmailSender,
} from './channel.types';

export class SmtpEmailSender extends EmailSender {
  readonly configured = true;
  private readonly transporter: Transporter;

  constructor(private readonly config: AppConfig['notifications']['email']) {
    super();
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.password ?? '' } : undefined,
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  }

  async send(message: EmailMessage): Promise<DeliveryReceipt> {
    const info = (await this.transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    })) as { messageId?: string };
    return { providerMessageId: info.messageId ?? null };
  }
}

export class DisabledEmailSender extends EmailSender {
  readonly configured = false;

  send(): Promise<DeliveryReceipt> {
    return Promise.reject(new ChannelNotConfiguredError('EMAIL'));
  }
}

/**
 * Local/test only (startup guards forbid it elsewhere): keeps the last messages in memory so a
 * developer or the mobile live-integration test can read one-time codes via GET /dev/inbox
 * without an SMTP server. Nothing is logged.
 */
export class DevInboxEmailSender extends EmailSender {
  readonly configured = true;
  private readonly messages: (EmailMessage & { sentAt: string })[] = [];

  send(message: EmailMessage): Promise<DeliveryReceipt> {
    this.messages.unshift({ ...message, sentAt: new Date().toISOString() });
    this.messages.length = Math.min(this.messages.length, 50);
    return Promise.resolve({ providerMessageId: `dev-inbox-${Date.now()}` });
  }

  list(to?: string): (EmailMessage & { sentAt: string })[] {
    return to
      ? this.messages.filter((message) => message.to === to.toLowerCase())
      : [...this.messages];
  }
}
