import { scrubCardNumbers } from '../../common/logging/redaction';
import { Injectable } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import {
  type AuthenticatedAdmin,
  type AuthenticatedUser,
} from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { maskEmail, maskName } from '../../common/logging/masking';
import { InjectDatabase } from '../../database/database.module';
import type { DB, TicketCategory, TicketsTable, TicketStatus } from '../../database/schema';
import { generatePublicReference } from '../../shared/references/public-reference';
import { Clock } from '../../shared/time/clock';
import { roleHasPermission } from '../admin/permissions';
import { AuditService } from '../audit/audit.service';

/** Support tickets (FR-HIS-02): "Report a problem" attaches the payment reference automatically. */
@Injectable()
export class TicketsService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  async create(
    user: AuthenticatedUser,
    input: { paymentId?: string; category: TicketCategory; message?: string },
  ) {
    let payment: { id: string; reference: string; state: string } | undefined;
    if (input.paymentId) {
      payment = await this.db
        .selectFrom('payments')
        .select(['id', 'reference', 'state'])
        .where('id', '=', input.paymentId)
        .where('user_id', '=', user.userId)
        .executeTakeFirst();
      if (!payment) {
        throw new AppError('NOT_FOUND');
      }
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const row = await this.db
          .insertInto('tickets')
          .values({
            reference: generatePublicReference('TK'),
            user_id: user.userId,
            payment_id: payment?.id ?? null,
            category: input.category,
            // Tourists sometimes paste their card number into support messages.
            message: input.message ? scrubCardNumbers(input.message.trim()) || null : null,
            payment_state_snapshot: payment?.state ?? null,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await this.audit.record({
          actor: { type: 'USER', id: user.userId },
          action: 'ticket.created',
          entityType: 'ticket',
          entityId: row.id,
          metadata: { category: row.category, paymentId: row.payment_id },
        });
        return this.view(row, payment?.reference ?? null);
      } catch (error) {
        if ((error as { constraint?: string }).constraint !== 'tickets_reference_key') {
          throw error;
        }
      }
    }
    throw new AppError('INTERNAL_ERROR');
  }

  async listForUser(user: AuthenticatedUser) {
    const rows = await this.db
      .selectFrom('tickets')
      .leftJoin('payments', 'payments.id', 'tickets.payment_id')
      .selectAll('tickets')
      .select('payments.reference as payment_reference')
      .where('tickets.user_id', '=', user.userId)
      .orderBy('tickets.created_at', 'desc')
      .limit(50)
      .execute();
    return { tickets: rows.map((row) => this.view(row, row.payment_reference)) };
  }

  async listForAdmin(admin: AuthenticatedAdmin, filter: { status?: TicketStatus; mine?: boolean }) {
    let query = this.db
      .selectFrom('tickets')
      .innerJoin('users', 'users.id', 'tickets.user_id')
      .leftJoin('payments', 'payments.id', 'tickets.payment_id')
      .selectAll('tickets')
      .select(['payments.reference as payment_reference', 'users.full_name', 'users.email'])
      .orderBy('tickets.created_at', 'asc')
      .limit(200);
    if (filter.status) {
      query = query.where('tickets.status', '=', filter.status);
    }
    if (filter.mine) {
      query = query.where('tickets.assignee_id', '=', admin.adminId);
    }
    const unmasked = roleHasPermission(admin.role, 'personal-data:unmasked');
    const rows = await query.execute();
    return {
      tickets: rows.map((row) => ({
        ...this.view(row, row.payment_reference),
        assigneeId: row.assignee_id,
        resolutionNote: row.resolution_note,
        customer: {
          name: unmasked ? row.full_name : maskName(row.full_name),
          email: unmasked ? row.email : maskEmail(row.email),
        },
      })),
    };
  }

  async update(
    admin: AuthenticatedAdmin,
    id: string,
    input: { status?: TicketStatus; assigneeId?: string | null; resolutionNote?: string },
  ) {
    return this.db.transaction().execute(async (trx) => {
      const before = await trx
        .selectFrom('tickets')
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!before) {
        throw new AppError('NOT_FOUND');
      }
      if (
        (input.status === 'RESOLVED' || input.status === 'CLOSED') &&
        !(input.resolutionNote ?? before.resolution_note)
      ) {
        throw new AppError('VALIDATION_FAILED', undefined, {
          fields: ['resolutionNote: required to resolve or close a ticket'],
        });
      }
      const after = await trx
        .updateTable('tickets')
        .set({
          ...(input.status ? { status: input.status } : {}),
          ...(input.assigneeId !== undefined ? { assignee_id: input.assigneeId } : {}),
          ...(input.resolutionNote ? { resolution_note: input.resolutionNote } : {}),
          ...(input.status === 'RESOLVED' ? { resolved_at: this.clock.now() } : {}),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit.record(
        {
          action: 'ticket.updated',
          entityType: 'ticket',
          entityId: id,
          before: { status: before.status, assigneeId: before.assignee_id },
          after: {
            status: after.status,
            assigneeId: after.assignee_id,
            resolutionNote: after.resolution_note,
          },
        },
        trx,
      );
      return this.view(after, null);
    });
  }

  private view(row: Selectable<TicketsTable>, paymentReference: string | null) {
    return {
      id: row.id,
      reference: row.reference,
      category: row.category,
      message: row.message,
      status: row.status,
      paymentId: row.payment_id,
      paymentReference,
      paymentStateAtReport: row.payment_state_snapshot,
      createdAt: row.created_at.toISOString(),
      resolvedAt: row.resolved_at?.toISOString() ?? null,
    };
  }
}
