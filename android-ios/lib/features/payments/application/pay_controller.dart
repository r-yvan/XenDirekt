import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/api_failure.dart';
import '../../payee_lookup/data/payee_models.dart';
import '../../payee_lookup/data/payees_api.dart';
import '../../quotes/data/quote_models.dart';

class PayState {
  const PayState({
    this.identifier = '',
    this.payee,
    this.lookingUp = false,
    this.lookupError,
    this.amountRwf,
    this.cardId,
    this.quote,
    this.quoting = false,
    this.quoteError,
    this.note,
  });

  final String identifier;
  final PayeeLookup? payee;
  final bool lookingUp;
  final ApiFailure? lookupError;
  final int? amountRwf;
  final String? cardId;
  final Quote? quote;
  final bool quoting;
  final ApiFailure? quoteError;
  final String? note;

  /// The quote shown matches exactly what the user selected (FR-QTE-03).
  bool get quoteMatches =>
      quote != null &&
      payee != null &&
      quote!.payeeId == payee!.payeeId &&
      quote!.cardId == cardId &&
      quote!.amountRwf == amountRwf;

  bool canPay(DateTime now) =>
      quoteMatches && !quoting && !quote!.isExpired(now);

  PayState copyWith({
    String? identifier,
    PayeeLookup? payee,
    bool clearPayee = false,
    bool? lookingUp,
    ApiFailure? lookupError,
    bool clearLookupError = false,
    int? amountRwf,
    bool clearAmount = false,
    String? cardId,
    Quote? quote,
    bool clearQuote = false,
    bool? quoting,
    ApiFailure? quoteError,
    bool clearQuoteError = false,
    String? note,
  }) => PayState(
    identifier: identifier ?? this.identifier,
    payee: clearPayee ? null : (payee ?? this.payee),
    lookingUp: lookingUp ?? this.lookingUp,
    lookupError: clearLookupError ? null : (lookupError ?? this.lookupError),
    amountRwf: clearAmount ? null : (amountRwf ?? this.amountRwf),
    cardId: cardId ?? this.cardId,
    quote: clearQuote ? null : (quote ?? this.quote),
    quoting: quoting ?? this.quoting,
    quoteError: clearQuoteError ? null : (quoteError ?? this.quoteError),
    note: note ?? this.note,
  );
}

/// Pay screen logic. Lookup starts by itself when the number is complete (FR-PAY-03);
/// a late response for an old number can never overwrite the current one.
/// The server computes every figure; this only asks for fresh quotes.
class PayController extends Notifier<PayState> {
  Timer? _lookupTimer;
  Timer? _quoteTimer;
  Timer? _expiryTimer;
  int _lookupSeq = 0;
  int _quoteSeq = 0;

  static const lookupDebounce = Duration(milliseconds: 350);
  static const quoteDebounce = Duration(milliseconds: 450);

  @override
  PayState build() {
    ref.onDispose(_cancelTimers);
    return const PayState();
  }

  void _cancelTimers() {
    _lookupTimer?.cancel();
    _quoteTimer?.cancel();
    _expiryTimer?.cancel();
  }

  void reset() {
    _cancelTimers();
    _lookupSeq++;
    _quoteSeq++;
    state = PayState(cardId: state.cardId);
  }

  void identifierChanged(String text) {
    final seq = ++_lookupSeq;
    _lookupTimer?.cancel();
    _quoteSeq++;
    state = state.copyWith(
      identifier: text,
      clearPayee: true,
      clearLookupError: true,
      clearQuote: true,
      lookingUp: false,
    );
    if (!isCompleteRwandanNumber(text)) {
      return;
    }
    state = state.copyWith(lookingUp: true);
    _lookupTimer = Timer(lookupDebounce, () => _lookup(text, seq));
  }

  Future<void> _lookup(String text, int seq) async {
    final watch = Stopwatch()..start();
    final analytics = ref.read(analyticsProvider);
    try {
      final payee = await ref.read(payeesApiProvider).lookupPhone(text);
      analytics.track('payee_lookup_succeeded', {
        'latencyMs': watch.elapsedMilliseconds,
      });
      if (seq != _lookupSeq) {
        return; // stale
      }
      state = state.copyWith(payee: payee, lookingUp: false);
      _scheduleQuote(Duration.zero);
    } on ApiFailure catch (failure) {
      analytics.track('payee_lookup_failed', {
        'reason': failure.code,
        'latencyMs': watch.elapsedMilliseconds,
      });
      if (seq == _lookupSeq) {
        state = state.copyWith(lookupError: failure, lookingUp: false);
      }
    }
  }

  /// One tap on a recent payee chip (FR-PAY-05). The server re-verifies stale names.
  void selectRecent(RecentPayee payee) {
    _lookupSeq++;
    _lookupTimer?.cancel();
    state = state.copyWith(
      identifier: payee.maskedIdentifier,
      payee: payee.asLookup(),
      clearLookupError: true,
      lookingUp: false,
      amountRwf: payee.lastAmountRwf,
      clearQuote: true,
    );
    _scheduleQuote(Duration.zero);
  }

  void amountChanged(String text) {
    final digits = text.replaceAll(RegExp(r'\D'), '');
    final amount = digits.isEmpty ? null : int.tryParse(digits);
    state = amount == null
        ? state.copyWith(
            clearAmount: true,
            clearQuote: true,
            clearQuoteError: true,
          )
        : state.copyWith(
            amountRwf: amount,
            clearQuote: true,
            clearQuoteError: true,
          );
    _scheduleQuote(quoteDebounce);
  }

  void selectCard(String cardId) {
    if (cardId == state.cardId) {
      return;
    }
    state = state.copyWith(cardId: cardId, clearQuote: true);
    _scheduleQuote(Duration.zero);
  }

  /// Default card when none is chosen yet (FR-CRD-04 smart default).
  void ensureCard(String? defaultCardId) {
    if (state.cardId == null && defaultCardId != null) {
      selectCard(defaultCardId);
    }
  }

  void noteChanged(String note) => state = state.copyWith(note: note);

  void _scheduleQuote(Duration delay) {
    final seq = ++_quoteSeq;
    _quoteTimer?.cancel();
    _expiryTimer?.cancel();
    if (state.payee == null ||
        state.cardId == null ||
        state.amountRwf == null ||
        state.amountRwf! <= 0) {
      state = state.copyWith(quoting: false);
      return;
    }
    state = state.copyWith(quoting: true, clearQuoteError: true);
    _quoteTimer = Timer(delay, () => _requestQuote(seq));
  }

  /// Forces a fresh quote (expired quote, PRD §6: "The price was updated").
  Future<void> refreshQuote() async => _scheduleQuote(Duration.zero);

  Future<void> _requestQuote(int seq) async {
    final payee = state.payee;
    final cardId = state.cardId;
    final amount = state.amountRwf;
    if (payee == null || cardId == null || amount == null) {
      return;
    }
    try {
      final quote = await ref
          .read(quotesApiProvider)
          .create(payeeId: payee.payeeId, cardId: cardId, amountRwf: amount);
      if (seq != _quoteSeq) {
        return;
      }
      state = state.copyWith(quote: quote, quoting: false);
      final untilExpiry = quote.expiresAt.difference(DateTime.now());
      // Refresh shortly before expiry so the summary is never stale.
      _expiryTimer = Timer(untilExpiry - const Duration(seconds: 5), () {
        if (seq == _quoteSeq) {
          _scheduleQuote(Duration.zero);
        }
      });
    } on ApiFailure catch (failure) {
      if (seq == _quoteSeq) {
        state = state.copyWith(
          quoteError: failure,
          quoting: false,
          clearQuote: true,
        );
      }
    }
  }
}

final payControllerProvider = NotifierProvider<PayController, PayState>(
  PayController.new,
);

final recentPayeesProvider = FutureProvider.autoDispose<List<RecentPayee>>(
  (ref) => ref.watch(payeesApiProvider).recent(),
);
