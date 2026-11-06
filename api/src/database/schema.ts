import type { ColumnType, Generated } from 'kysely';

/**
 * Kysely table types. Keep in sync with migrations; the schema drift integration test
 * (test/integration/schema-drift.spec.ts) compares these column lists with the migrated database.
 */

/** Selected as Date; written as Date or ISO string; database default when omitted. */
export type CreatedAt = ColumnType<Date, Date | string | undefined, never>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;
export type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;
/** int8 columns: parsed into bigint by the pg type parser configured in database.factory.ts. */
export type BigIntColumn = ColumnType<bigint, bigint | number, bigint | number>;
/** jsonb columns: read as parsed JSON, written as JSON text (see toJson). */
export type Json<T> = ColumnType<T, string, string>;
export type NullableJson<T> = ColumnType<T | null, string | null | undefined, string | null>;

export interface AuditLogsTable {
  id: Generated<string>;
  actor_type: 'USER' | 'ADMIN' | 'SYSTEM' | 'WORKER' | 'PROVIDER';
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: NullableJson<unknown>;
  after: NullableJson<unknown>;
  metadata: NullableJson<Record<string, unknown>>;
  correlation_id: string | null;
  created_at: CreatedAt;
}

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'DEAD';

export interface OutboxEventsTable {
  id: Generated<string>;
  type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Json<Record<string, unknown>>;
  status: Generated<OutboxStatus>;
  attempts: Generated<number>;
  max_attempts: Generated<number>;
  available_at: ColumnType<Date, Date | string | undefined, Date | string>;
  locked_until: NullableTimestamp;
  locked_by: string | null;
  last_error: string | null;
  dedupe_key: string | null;
  correlation_id: string | null;
  created_at: CreatedAt;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  processed_at: NullableTimestamp;
}

export type ConfigKey = 'FEES' | 'LIMITS' | 'FX_RATES' | 'CARD_RULES' | 'PAYEE_ROUTING';
export type ConfigStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'REJECTED';

export interface ConfigurationVersionsTable {
  id: Generated<string>;
  config_key: ConfigKey;
  version: number;
  value: Json<unknown>;
  status: ConfigStatus;
  approved: Generated<boolean>;
  approval_reference: string | null;
  change_reason: string;
  created_by: string;
  created_at: CreatedAt;
  activated_by: string | null;
  activated_at: NullableTimestamp;
}

export type UserStatus = 'PENDING_PROFILE' | 'ACTIVE' | 'BLOCKED' | 'DELETED';

export interface UsersTable {
  id: Generated<string>;
  full_name: string | null;
  email: string | null;
  email_verified_at: NullableTimestamp;
  phone_e164: string | null;
  phone_verified_at: NullableTimestamp;
  country_of_residence: string | null;
  date_of_birth: string | null;
  preferred_language: Generated<'en' | 'fr'>;
  pin_hash: string | null;
  pin_set_at: NullableTimestamp;
  pin_failed_attempts: Generated<number>;
  pin_locked_until: NullableTimestamp;
  kyc_level: Generated<'NONE' | 'BASIC' | 'VERIFIED'>;
  kyc_status: Generated<'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'>;
  status: Generated<UserStatus>;
  blocked_reason: string | null;
  blocked_at: NullableTimestamp;
  deleted_at: NullableTimestamp;
  created_at: CreatedAt;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface UserIdentitiesTable {
  id: Generated<string>;
  user_id: string;
  provider: 'GOOGLE' | 'APPLE';
  subject: string;
  created_at: CreatedAt;
}

export interface ConsentsTable {
  id: Generated<string>;
  user_id: string;
  document_type: 'TERMS' | 'PRIVACY';
  document_version: string;
  accepted_at: Timestamp;
  locale: string;
  app_version: string | null;
  ip_hash: string | null;
  created_at: CreatedAt;
}

export interface OtpChallengesTable {
  id: Generated<string>;
  channel: 'EMAIL' | 'SMS';
  destination_hash: string;
  destination_encrypted: string | null;
  destination_masked: string;
  code_hash: string;
  locale: Generated<string>;
  attempts: Generated<number>;
  max_attempts: Generated<number>;
  expires_at: Timestamp;
  consumed_at: NullableTimestamp;
  invalidated_at: NullableTimestamp;
  device_id_hash: string | null;
  created_at: CreatedAt;
}

export type SessionRevokedReason =
  | 'LOGOUT'
  | 'REFRESH_REUSE'
  | 'ADMIN'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_BLOCKED'
  | 'NEW_SIGN_IN_ON_DEVICE'
  | 'PIN_CHANGED';

export type ClientPlatform = 'ios' | 'android' | 'web';

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  device_id_hash: string;
  platform: ClientPlatform | null;
  app_version: string | null;
  refresh_token_hash: string;
  previous_refresh_token_hash: string | null;
  rotated_at: NullableTimestamp;
  expires_at: Timestamp;
  last_used_at: ColumnType<Date, Date | string | undefined, Date | string>;
  revoked_at: NullableTimestamp;
  revoked_reason: SessionRevokedReason | null;
  created_at: CreatedAt;
}

export interface DeviceKeysTable {
  id: Generated<string>;
  user_id: string;
  session_id: string;
  algorithm: 'ED25519' | 'ES256';
  public_key: string;
  created_at: CreatedAt;
  revoked_at: NullableTimestamp;
}

export type StepUpPurpose = 'PAYMENT' | 'CHANGE_PIN' | 'DELETE_ACCOUNT' | 'REGISTER_DEVICE_KEY';

export interface StepUpChallengesTable {
  id: Generated<string>;
  session_id: string;
  purpose: StepUpPurpose;
  nonce: string;
  expires_at: Timestamp;
  consumed_at: NullableTimestamp;
  created_at: CreatedAt;
}

export interface StepUpGrantsTable {
  id: Generated<string>;
  session_id: string;
  user_id: string;
  token_hash: string;
  purpose: StepUpPurpose;
  method: 'PIN' | 'DEVICE_KEY';
  expires_at: Timestamp;
  consumed_at: NullableTimestamp;
  created_at: CreatedAt;
}

export type AdminRole = 'VIEWER' | 'SUPPORT_AGENT' | 'RISK_ANALYST' | 'ADMIN';

export interface AdminUsersTable {
  id: Generated<string>;
  email: string;
  full_name: string;
  role: AdminRole;
  password_hash: string;
  totp_secret_encrypted: string;
  totp_last_used_step: BigIntColumn | null;
  status: Generated<'ACTIVE' | 'DISABLED'>;
  failed_login_attempts: Generated<number>;
  locked_until: NullableTimestamp;
  last_login_at: NullableTimestamp;
  created_by: string | null;
  created_at: CreatedAt;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface AdminLoginChallengesTable {
  id: Generated<string>;
  admin_id: string;
  token_hash: string;
  attempts: Generated<number>;
  expires_at: Timestamp;
  consumed_at: NullableTimestamp;
  created_at: CreatedAt;
}

export interface AdminSessionsTable {
  id: Generated<string>;
  admin_id: string;
  refresh_token_hash: string;
  expires_at: Timestamp;
  last_used_at: ColumnType<Date, Date | string | undefined, Date | string>;
  revoked_at: NullableTimestamp;
  revoked_reason: string | null;
  created_at: CreatedAt;
}

export type Mutable<T> = ColumnType<T, T | undefined, T>;
export type Updatable = ColumnType<Date, Date | string | undefined, Date | string>;
/** numeric columns stay text (FX rates are parsed into scaled bigints in shared/money/fx.ts). */
export type NumericText = ColumnType<string, string, string>;

export interface BlocklistEntriesTable {
  id: Generated<string>;
  entity_type: 'CARD_FINGERPRINT' | 'PAYEE' | 'DEVICE';
  entity_value: string;
  reason: string;
  created_by: string;
  created_at: CreatedAt;
  removed_by: string | null;
  removed_at: NullableTimestamp;
  removal_reason: string | null;
}

export interface CardSetupSessionsTable {
  id: Generated<string>;
  user_id: string;
  provider: string;
  provider_setup_id: string;
  status: Generated<'CREATED' | 'COMPLETED' | 'FAILED' | 'EXPIRED'>;
  expires_at: Timestamp;
  completed_at: NullableTimestamp;
  card_id: string | null;
  created_at: CreatedAt;
}

export type CardStatus = 'ACTIVE' | 'REJECTED' | 'REMOVED' | 'BLOCKED';
export type CardFunding = 'CREDIT' | 'DEBIT' | 'PREPAID' | 'UNKNOWN';

export interface CardsTable {
  id: Generated<string>;
  user_id: string;
  provider: string;
  provider_token_encrypted: string | null;
  brand: 'VISA' | 'MASTERCARD' | 'OTHER';
  last4: string;
  expiry_month: number;
  expiry_year: number;
  issuing_country: string | null;
  funding: Generated<CardFunding>;
  card_currency: string | null;
  fingerprint: string | null;
  bin_prefix: string | null;
  is_default: Generated<boolean>;
  status: CardStatus;
  rejection_reason: string | null;
  three_ds_verified_at: NullableTimestamp;
  first_payment_at: NullableTimestamp;
  is_simulated: Generated<boolean>;
  removed_at: NullableTimestamp;
  created_at: CreatedAt;
  updated_at: Updatable;
}

export interface PayeesTable {
  id: Generated<string>;
  network: 'MTN';
  identifier_type: 'PHONE' | 'MERCHANT_CODE';
  identifier: string;
  registered_name: string | null;
  lookup_status: 'VERIFIED' | 'NOT_FOUND' | 'INACTIVE';
  last_verified_at: NullableTimestamp;
  is_simulated: Generated<boolean>;
  first_paid_at: NullableTimestamp;
  created_at: CreatedAt;
  updated_at: Updatable;
}

export interface UserPayeesTable {
  user_id: string;
  payee_id: string;
  last_used_at: Timestamp;
  last_amount_rwf: BigIntColumn | null;
  payment_count: Generated<number>;
}

export interface QuotesTable {
  id: Generated<string>;
  user_id: string;
  payee_id: string;
  card_id: string;
  amount_rwf: BigIntColumn;
  fee_rwf: BigIntColumn;
  total_rwf: BigIntColumn;
  card_currency: string;
  fx_rate: NumericText;
  fx_source: string;
  total_card_minor: BigIntColumn;
  rounding_mode: 'CEILING' | 'HALF_UP';
  fee_config_version: number;
  limits_config_version: number;
  fx_config_version: number;
  config_approved: boolean;
  status: Generated<'ACTIVE' | 'USED' | 'EXPIRED'>;
  is_simulated: Generated<boolean>;
  expires_at: Timestamp;
  created_at: CreatedAt;
}

export type PaymentState =
  | 'QUOTED'
  | 'AUTH_PENDING'
  | 'AUTH_FAILED'
  | 'AUTHORISED'
  | 'PAYOUT_PENDING'
  | 'PAYOUT_FAILED'
  | 'VOID_PENDING'
  | 'VOIDED'
  | 'CAPTURE_PENDING'
  | 'CAPTURE_FAILED'
  | 'PENDING_REVIEW'
  | 'COMPLETED'
  | 'REFUNDED';

export type ReturnChannel = 'APP' | 'WEB';

export interface PaymentsTable {
  id: Generated<string>;
  reference: string;
  user_id: string;
  card_id: string;
  payee_id: string;
  quote_id: string;
  idempotency_key: string;
  request_hash: string;
  device_id_hash: string | null;
  state: PaymentState;
  review_reason: string | null;
  failure_code: string | null;
  amount_rwf: BigIntColumn;
  fee_rwf: BigIntColumn;
  total_rwf: BigIntColumn;
  card_currency: string;
  fx_rate: NumericText;
  total_card_minor: BigIntColumn;
  note: string | null;
  provider: string;
  is_simulated: boolean;
  three_ds_required: Generated<boolean>;
  next_action_url: string | null;
  /** Where 3-D Secure returns to: the app deep link or the web portal. */
  return_channel: Generated<ReturnChannel>;
  payee_name_snapshot: string;
  payee_identifier_masked: string;
  card_brand_snapshot: string;
  card_last4_snapshot: string;
  provider_auth_id: string | null;
  provider_payout_id: string | null;
  provider_capture_id: string | null;
  version: Generated<number>;
  quoted_at: Timestamp;
  auth_pending_at: NullableTimestamp;
  authorised_at: NullableTimestamp;
  payout_pending_at: NullableTimestamp;
  payout_confirmed_at: NullableTimestamp;
  completed_at: NullableTimestamp;
  failed_at: NullableTimestamp;
  voided_at: NullableTimestamp;
  review_at: NullableTimestamp;
  refunded_at: NullableTimestamp;
  state_changed_at: Timestamp;
  created_at: CreatedAt;
  updated_at: Updatable;
}

export type EventSource = 'APP' | 'PROVIDER' | 'OPS' | 'WORKER' | 'SYSTEM';

export interface PaymentEventsTable {
  id: Generated<string>;
  payment_id: string;
  from_state: string | null;
  to_state: string | null;
  event_type: string;
  source: EventSource;
  actor_id: string | null;
  reason: string | null;
  payload_redacted: NullableJson<unknown>;
  correlation_id: string | null;
  created_at: CreatedAt;
}

export type OperationType = 'AUTHORISATION' | 'PAYOUT' | 'CAPTURE' | 'VOID' | 'REFUND';
export type OperationStatus =
  'REQUESTED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'REVERSED';

export interface ProviderOperationsTable {
  id: Generated<string>;
  payment_id: string;
  type: OperationType;
  request_ref: string;
  provider_ref: string | null;
  status: OperationStatus;
  amount_minor: BigIntColumn;
  currency: string;
  provider_status_raw: string | null;
  failure_code: string | null;
  response_redacted: NullableJson<unknown>;
  requested_at: Timestamp;
  completed_at: NullableTimestamp;
  last_checked_at: NullableTimestamp;
  check_count: Generated<number>;
  created_at: CreatedAt;
  updated_at: Updatable;
}

export type AdjustmentType = 'VOID' | 'REFUND' | 'PAYOUT_REVERSAL';
export type AdjustmentStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'AWAITING_CAPABILITY'
  | 'RECORDED';

export interface PaymentAdjustmentsTable {
  id: Generated<string>;
  reference: string;
  payment_id: string;
  type: AdjustmentType;
  status: AdjustmentStatus;
  amount_minor: BigIntColumn;
  currency: string;
  reason: string;
  requested_by_type: 'ADMIN' | 'SYSTEM' | 'PROVIDER';
  requested_by: string | null;
  approved_by: string | null;
  approved_at: NullableTimestamp;
  operation_id: string | null;
  provider_ref: string | null;
  idempotency_key: string | null;
  response_redacted: NullableJson<unknown>;
  created_at: CreatedAt;
  updated_at: Updatable;
  completed_at: NullableTimestamp;
}

export interface InboundProviderEventsTable {
  id: Generated<string>;
  provider: string;
  external_event_id: string;
  event_type: string;
  signature_valid: boolean;
  payload_redacted: NullableJson<unknown>;
  received_at: CreatedAt;
  processed_at: NullableTimestamp;
  outcome: string | null;
}

export interface RiskFlagsTable {
  id: Generated<string>;
  payment_id: string | null;
  user_id: string | null;
  card_id: string | null;
  payee_id: string | null;
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  action: 'FLAG' | 'HOLD' | 'BLOCK';
  evidence: Json<Record<string, unknown>>;
  status: Generated<'OPEN' | 'CONFIRMED_FRAUD' | 'DISMISSED'>;
  reviewer_id: string | null;
  reviewed_at: NullableTimestamp;
  review_note: string | null;
  created_at: CreatedAt;
}

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string | null;
  payment_id: string | null;
  audience: 'TOURIST' | 'MERCHANT';
  channel: 'IN_APP' | 'PUSH' | 'SMS' | 'EMAIL';
  template: string;
  locale: Generated<string>;
  title: string | null;
  body: string | null;
  deep_link: string | null;
  dedupe_key: string;
  status: Generated<'PENDING' | 'SENT' | 'FAILED' | 'SUPPRESSED'>;
  status_reason: string | null;
  attempts: Generated<number>;
  provider_message_id: string | null;
  read_at: NullableTimestamp;
  sent_at: NullableTimestamp;
  created_at: CreatedAt;
  updated_at: Updatable;
}

export interface PushTokensTable {
  id: Generated<string>;
  user_id: string;
  session_id: string;
  platform: 'ios' | 'android';
  token_encrypted: string;
  token_hash: string;
  created_at: CreatedAt;
  revoked_at: NullableTimestamp;
}

export type TicketCategory =
  | 'SELLER_NOT_PAID'
  | 'WRONG_AMOUNT'
  | 'CHARGED_BUT_FAILED'
  | 'CHARGED_TWICE'
  | 'WRONG_SELLER'
  | 'REFUND_REQUEST'
  | 'APP_PROBLEM'
  | 'OTHER';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface TicketsTable {
  id: Generated<string>;
  reference: string;
  user_id: string;
  payment_id: string | null;
  category: TicketCategory;
  message: string | null;
  payment_state_snapshot: string | null;
  status: Generated<TicketStatus>;
  assignee_id: string | null;
  resolution_note: string | null;
  created_at: CreatedAt;
  updated_at: Updatable;
  resolved_at: NullableTimestamp;
}

export interface ReconciliationRunsTable {
  id: Generated<string>;
  business_date: string;
  provider: string;
  source: 'STATUS_API' | 'SETTLEMENT_FILE';
  file_name: string | null;
  file_sha256: string | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  totals: ColumnType<Record<string, number>, string | undefined, string>;
  error: string | null;
  triggered_by: string;
  started_at: CreatedAt;
  completed_at: NullableTimestamp;
}

export type MatchState =
  | 'MATCHED'
  | 'MISSING_AT_PROVIDER'
  | 'MISSING_INTERNAL'
  | 'AMOUNT_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'REVERSAL';

export interface ReconciliationItemsTable {
  id: Generated<string>;
  run_id: string;
  payment_id: string | null;
  operation_type: string | null;
  internal_reference: string | null;
  provider_reference: string | null;
  match_state: MatchState;
  internal_amount: BigIntColumn | null;
  provider_amount: BigIntColumn | null;
  currency: string | null;
  internal_status: string | null;
  provider_status: string | null;
  details: ColumnType<Record<string, unknown>, string | undefined, string>;
  resolution_status: Generated<'UNRESOLVED' | 'RESOLVED' | 'NOT_APPLICABLE'>;
  resolved_by: string | null;
  resolved_at: NullableTimestamp;
  resolution_note: string | null;
  created_at: CreatedAt;
}

export interface AnalyticsEventsTable {
  id: Generated<string>;
  event_name: string;
  user_id: string | null;
  properties: ColumnType<Record<string, unknown>, string | undefined, string>;
  occurred_at: Timestamp;
  received_at: CreatedAt;
  source: 'APP' | 'SERVER';
}

export type LaunchPersona = 'VISITOR' | 'SENDER' | 'DIASPORA' | 'RECEIVER';

export interface WaitlistEntriesTable {
  id: Generated<string>;
  seq: ColumnType<bigint, never, never>;
  email: string;
  full_name: string | null;
  persona: LaunchPersona | null;
  country_code: string | null;
  locale: Generated<'en' | 'fr'>;
  referral_code: string;
  referred_by: string | null;
  source: string | null;
  privacy_version: string;
  welcome_sent_at: NullableTimestamp;
  created_at: CreatedAt;
  updated_at: Updatable;
}

export interface HustleCheckResponsesTable {
  id: Generated<string>;
  persona: LaunchPersona;
  last_time: 'SMOOTH' | 'DETOUR' | 'DECLINED' | 'STUCK';
  speed: 'SECONDS' | 'SAME_DAY' | 'DAYS' | 'UNKNOWN';
  fees: 'LOW' | 'SOME' | 'LOTS' | 'UNKNOWN';
  checking: 'NEVER' | 'SOMETIMES' | 'OFTEN' | 'ALWAYS';
  score: number;
  created_at: CreatedAt;
}

export type StoryStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WallStoriesTable {
  id: Generated<string>;
  body: string;
  country_code: string | null;
  persona: LaunchPersona | null;
  status: Generated<StoryStatus>;
  moderated_by: string | null;
  moderated_at: NullableTimestamp;
  moderation_note: string | null;
  created_at: CreatedAt;
  updated_at: Updatable;
}

export interface DB {
  audit_logs: AuditLogsTable;
  outbox_events: OutboxEventsTable;
  configuration_versions: ConfigurationVersionsTable;
  users: UsersTable;
  user_identities: UserIdentitiesTable;
  consents: ConsentsTable;
  otp_challenges: OtpChallengesTable;
  sessions: SessionsTable;
  device_keys: DeviceKeysTable;
  step_up_challenges: StepUpChallengesTable;
  step_up_grants: StepUpGrantsTable;
  admin_users: AdminUsersTable;
  admin_login_challenges: AdminLoginChallengesTable;
  admin_sessions: AdminSessionsTable;
  blocklist_entries: BlocklistEntriesTable;
  card_setup_sessions: CardSetupSessionsTable;
  cards: CardsTable;
  payees: PayeesTable;
  user_payees: UserPayeesTable;
  quotes: QuotesTable;
  payments: PaymentsTable;
  payment_events: PaymentEventsTable;
  provider_operations: ProviderOperationsTable;
  payment_adjustments: PaymentAdjustmentsTable;
  inbound_provider_events: InboundProviderEventsTable;
  risk_flags: RiskFlagsTable;
  notifications: NotificationsTable;
  push_tokens: PushTokensTable;
  tickets: TicketsTable;
  reconciliation_runs: ReconciliationRunsTable;
  reconciliation_items: ReconciliationItemsTable;
  analytics_events: AnalyticsEventsTable;
  waitlist_entries: WaitlistEntriesTable;
  hustle_check_responses: HustleCheckResponsesTable;
  wall_stories: WallStoriesTable;
}
