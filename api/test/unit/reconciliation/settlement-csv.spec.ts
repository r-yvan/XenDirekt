import { AppError } from '../../../src/common/errors/app-error';
import {
  kigaliDayWindow,
  parseSettlementCsv,
  SETTLEMENT_CSV_HEADER,
} from '../../../src/modules/reconciliation/reconciliation.service';

describe('settlement CSV (provisional layout)', () => {
  it('parses valid rows into minor-unit bigints', () => {
    const rows = parseSettlementCsv(
      `﻿${SETTLEMENT_CSV_HEADER}\r\nXD-1-PO,P-1,12000,RWF,SUCCEEDED\n\nXD-1-CP,P-2,915,USD,REVERSED\n`,
    );
    expect(rows).toEqual([
      {
        clientReference: 'XD-1-PO',
        providerReference: 'P-1',
        amountMinor: 12000n,
        currency: 'RWF',
        status: 'SUCCEEDED',
      },
      {
        clientReference: 'XD-1-CP',
        providerReference: 'P-2',
        amountMinor: 915n,
        currency: 'USD',
        status: 'REVERSED',
      },
    ]);
  });

  it.each([
    ['wrong header', 'ref,amount\nA,1'],
    ['negative amount', `${SETTLEMENT_CSV_HEADER}\nA,P,-5,RWF,SUCCEEDED`],
    ['decimal amount', `${SETTLEMENT_CSV_HEADER}\nA,P,1.5,RWF,SUCCEEDED`],
    ['bad currency', `${SETTLEMENT_CSV_HEADER}\nA,P,5,rwf,SUCCEEDED`],
    ['unknown status', `${SETTLEMENT_CSV_HEADER}\nA,P,5,RWF,PENDING`],
    ['extra column', `${SETTLEMENT_CSV_HEADER}\nA,P,5,RWF,SUCCEEDED,x`],
  ])('rejects the whole file on %s', (_name, content) => {
    expect(() => parseSettlementCsv(content)).toThrow(AppError);
  });

  it('maps a Kigali business date to its UTC window (UTC+2, no DST)', () => {
    expect(kigaliDayWindow('2026-10-25')).toEqual({
      from: new Date('2026-10-24T22:00:00Z'),
      to: new Date('2026-10-25T22:00:00Z'),
    });
    expect(() => kigaliDayWindow('2026-13-40')).toThrow(AppError);
  });
});
