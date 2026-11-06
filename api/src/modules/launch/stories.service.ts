import { Injectable } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { type AuthenticatedAdmin } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { scrubCardNumbers } from '../../common/logging/redaction';
import { InjectDatabase } from '../../database/database.module';
import type { DB, LaunchPersona, StoryStatus, WallStoriesTable } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';

const MIN_LENGTH = 20;
const MAX_LENGTH = 600;

function isPrintable(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return char === '\n' || (code >= 0x20 && code !== 0x7f);
}

/** Removes control characters, collapses runs of spaces and blank lines, scrubs card numbers. */
export function normaliseStory(raw: string): string {
  const printable = Array.from(raw.replace(/\r\n?/g, '\n')).filter(isPrintable).join('');
  return scrubCardNumbers(
    printable
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

/**
 * "The Wall of Hustle": anonymous stories from visitors. Nothing is public until a person
 * approves it, and card numbers are scrubbed before storage.
 */
@Injectable()
export class StoriesService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  async submit(input: {
    body: string;
    countryCode?: string;
    persona?: LaunchPersona;
  }): Promise<{ status: 'PENDING' }> {
    const body = normaliseStory(input.body);
    if (body.length < MIN_LENGTH || body.length > MAX_LENGTH) {
      throw new AppError('VALIDATION_FAILED', undefined, {
        fields: [`body: must be ${MIN_LENGTH}–${MAX_LENGTH} characters`],
      });
    }
    await this.db
      .insertInto('wall_stories')
      .values({
        body,
        country_code: input.countryCode?.toUpperCase() ?? null,
        persona: input.persona ?? null,
      })
      .execute();
    return { status: 'PENDING' };
  }

  async listPublished(limit = 12) {
    const rows = await this.db
      .selectFrom('wall_stories')
      .select(['id', 'body', 'country_code', 'persona', 'created_at'])
      .where('status', '=', 'APPROVED')
      .orderBy('moderated_at', 'desc')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();
    return {
      stories: rows.map((row) => ({
        id: row.id,
        body: row.body,
        countryCode: row.country_code,
        persona: row.persona,
        createdAt: row.created_at.toISOString(),
      })),
    };
  }

  async countPublished(): Promise<number> {
    const row = await this.db
      .selectFrom('wall_stories')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('status', '=', 'APPROVED')
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async listForAdmin(query: { status?: StoryStatus; limit?: number }) {
    let builder = this.db.selectFrom('wall_stories').selectAll();
    if (query.status) {
      builder = builder.where('status', '=', query.status);
    }
    const rows = await builder
      .orderBy('created_at', 'desc')
      .limit(query.limit ?? 50)
      .execute();
    return { stories: rows.map((row) => this.adminView(row)) };
  }

  async moderate(
    admin: AuthenticatedAdmin,
    id: string,
    decision: { status: 'APPROVED' | 'REJECTED'; note?: string },
  ) {
    return this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('wall_stories')
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!current) {
        throw new AppError('NOT_FOUND');
      }
      const updated = await trx
        .updateTable('wall_stories')
        .set({
          status: decision.status,
          moderated_by: admin.adminId,
          moderated_at: this.clock.now(),
          moderation_note: decision.note?.trim() || null,
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit.record(
        {
          action: 'launch.story_moderated',
          entityType: 'wall_story',
          entityId: id,
          before: { status: current.status },
          after: { status: updated.status },
        },
        trx,
      );
      return this.adminView(updated);
    });
  }

  private adminView(row: Selectable<WallStoriesTable>) {
    return {
      id: row.id,
      body: row.body,
      countryCode: row.country_code,
      persona: row.persona,
      status: row.status,
      moderatedAt: row.moderated_at?.toISOString() ?? null,
      moderationNote: row.moderation_note,
      createdAt: row.created_at.toISOString(),
    };
  }
}
