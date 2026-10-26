import { currencyExponent, formatMoneyForDisplay } from '../../../shared/money/currency';
import {
  applySpread,
  convertRwfToCardMinor,
  formatRate,
  parseRate,
  RoundingMode,
} from '../../../shared/money/fx';
import type { FeeConfig, FxConfig } from '../../configuration/config-schemas';

export interface QuoteInputs {
  amountRwf: bigint;
  cardCurrency: string;
  fees: FeeConfig;
  fx: FxConfig;
}

export interface QuoteFigures {
  amountRwf: bigint;
  feeRwf: bigint;
  totalRwf: bigint;
  cardCurrency: string;
  /** RWF per one unit of card currency, after spread, as decimal text. */
  fxRate: string;
  totalCardMinor: bigint;
  roundingMode: RoundingMode;
}

/** XenDirekt fee in whole RWF: fixed + ceil(amount × bps / 10,000), clamped to [min, max]. */
export function calculateFee(amountRwf: bigint, fees: FeeConfig): bigint {
  if (amountRwf <= 0n) {
    throw new Error('Amount must be positive');
  }
  const bps = BigInt(fees.percentageBps);
  const percentage = (amountRwf * bps + 9_999n) / 10_000n; // ceiling division
  const raw = BigInt(fees.fixedRwf) + percentage;
  const min = BigInt(fees.minFeeRwf);
  const max = BigInt(fees.maxFeeRwf);
  return raw < min ? min : raw > max ? max : raw;
}

/** Pure quote maths (ADR 0006). Throws if the card currency has no configured rate. */
export function calculateQuote(inputs: QuoteInputs): QuoteFigures {
  const feeRwf = calculateFee(inputs.amountRwf, inputs.fees);
  const totalRwf = inputs.amountRwf + feeRwf;
  const mid = inputs.fx.rates[inputs.cardCurrency];
  if (inputs.cardCurrency !== 'RWF' && !mid) {
    throw new Error(`No FX rate configured for ${inputs.cardCurrency}`);
  }
  currencyExponent(inputs.cardCurrency);
  const rateScaled =
    inputs.cardCurrency === 'RWF'
      ? parseRate('1')
      : applySpread(parseRate(mid as string), inputs.fx.spreadBps);
  return {
    amountRwf: inputs.amountRwf,
    feeRwf,
    totalRwf,
    cardCurrency: inputs.cardCurrency,
    fxRate: formatRate(rateScaled),
    totalCardMinor: convertRwfToCardMinor(
      totalRwf,
      rateScaled,
      inputs.cardCurrency,
      inputs.fx.roundingMode,
    ),
    roundingMode: inputs.fx.roundingMode,
  };
}

export function displayRate(cardCurrency: string, fxRate: string): string {
  const [whole = '0', fraction] = fxRate.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `1 ${cardCurrency} = ${grouped}${fraction ? `.${fraction}` : ''} RWF`;
}

export { formatMoneyForDisplay };
