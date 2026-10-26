/** Raised when a delivery channel has no configured transport. Never treated as success. */
export class ChannelNotConfiguredError extends Error {
  constructor(readonly channel: 'EMAIL' | 'SMS' | 'PUSH') {
    super(`${channel} channel is not configured`);
    this.name = 'ChannelNotConfiguredError';
  }
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface SmsMessage {
  /** E.164 */
  to: string;
  text: string;
}

export interface DeliveryReceipt {
  providerMessageId: string | null;
}

export abstract class EmailSender {
  abstract readonly configured: boolean;
  abstract send(message: EmailMessage): Promise<DeliveryReceipt>;
}

export abstract class SmsSender {
  abstract readonly configured: boolean;
  abstract send(message: SmsMessage): Promise<DeliveryReceipt>;
}
