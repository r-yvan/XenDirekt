import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from '@prometheus-io/client';

/**
 * Prometheus metrics. Labels are low-cardinality by design: route templates (never raw URLs),
 * provider operation names, payment states. No identifiers or personal data in labels.
 * Alert rules built on these live in api/docs/alerts.md.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpDuration = new Histogram({
    name: 'xd_http_request_duration_seconds',
    help: 'HTTP request duration by route template and status class',
    labelNames: ['method', 'route', 'status_class'] as const,
    buckets: [0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 3, 5, 10],
    registers: [this.registry],
  });

  readonly providerDuration = new Histogram({
    name: 'xd_provider_request_duration_seconds',
    help: 'Payment provider call duration',
    labelNames: ['provider', 'operation', 'outcome'] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 20],
    registers: [this.registry],
  });

  readonly providerErrors = new Counter({
    name: 'xd_provider_errors_total',
    help: 'Provider calls that failed, by failure class',
    labelNames: ['provider', 'operation', 'kind'] as const,
    registers: [this.registry],
  });

  readonly outboxJobs = new Counter({
    name: 'xd_outbox_jobs_total',
    help: 'Outbox job executions by type and outcome',
    labelNames: ['type', 'outcome'] as const,
    registers: [this.registry],
  });

  readonly outboxDepth = new Gauge({
    name: 'xd_outbox_jobs',
    help: 'Outbox jobs by status (PENDING, PROCESSING, DEAD)',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });

  readonly paymentsByState = new Gauge({
    name: 'xd_payments_non_final',
    help: 'Non-final payments by state',
    labelNames: ['state'] as const,
    registers: [this.registry],
  });

  readonly oldestPaymentAge = new Gauge({
    name: 'xd_payment_oldest_state_age_seconds',
    help: 'Age of the oldest payment in each non-final state (stuck payout detection)',
    labelNames: ['state'] as const,
    registers: [this.registry],
  });

  readonly paymentTransitions = new Counter({
    name: 'xd_payment_transitions_total',
    help: 'Payment state transitions',
    labelNames: ['from', 'to'] as const,
    registers: [this.registry],
  });

  readonly notificationsFailed = new Counter({
    name: 'xd_notifications_failed_total',
    help: 'Notification deliveries that failed',
    labelNames: ['channel', 'template'] as const,
    registers: [this.registry],
  });

  readonly reconciliationOpenItems = new Gauge({
    name: 'xd_reconciliation_unresolved_items',
    help: 'Unresolved reconciliation discrepancies',
    registers: [this.registry],
  });

  readonly payeeLookupDuration = new Histogram({
    name: 'xd_payee_lookup_duration_seconds',
    help: 'End-to-end payee lookup duration (NFR-PER-01 target p95 <= 3s)',
    labelNames: ['outcome'] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2, 3, 5, 10],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'xd_' });
  }
}
