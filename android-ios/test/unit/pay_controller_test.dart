import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:xendirekt/app/providers.dart';
import 'package:xendirekt/features/payee_lookup/data/payee_models.dart';

import 'package:xendirekt/features/payee_lookup/data/payees_api.dart';
import 'package:xendirekt/features/payments/application/pay_controller.dart';
import 'package:xendirekt/features/quotes/data/quote_models.dart';
import 'package:xendirekt/features/quotes/data/quotes_api.dart';

import '../support/fixtures.dart';
import '../support/recording_analytics.dart';

class MockPayeesApi extends Mock implements PayeesApi {}

class MockQuotesApi extends Mock implements QuotesApi {}

PayeeLookup payee(String id, String name) => PayeeLookup(
  payeeId: id,
  registeredName: name,
  maskedIdentifier: '078* *** 456',
  displayIdentifier: '078 812 3456',
  simulated: true,
);

void main() {
  late MockPayeesApi payees;
  late MockQuotesApi quotes;
  late ProviderContainer container;
  late RecordingAnalytics analytics;

  setUp(() {
    payees = MockPayeesApi();
    quotes = MockQuotesApi();
    analytics = RecordingAnalytics();
    container = ProviderContainer(
      overrides: [
        analyticsProvider.overrideWithValue(analytics),
        payeesApiProvider.overrideWithValue(payees),
        quotesApiProvider.overrideWithValue(quotes),
      ],
    );
  });

  tearDown(() => container.dispose());

  test(
    'a late lookup response for an old number never overwrites the current one',
    () async {
      final slow = Completer<PayeeLookup>();
      final fast = Completer<PayeeLookup>();
      when(() => payees.lookupPhone('0788111111'))
          .thenAnswer((_) => slow.future);
      when(() => payees.lookupPhone('0788222222'))
          .thenAnswer((_) => fast.future);
      final controller = container.read(payControllerProvider.notifier);

      controller.identifierChanged('0788111111');
      await Future<void>.delayed(
        PayController.lookupDebounce + const Duration(milliseconds: 20),
      );
      controller.identifierChanged('0788222222');
      await Future<void>.delayed(
        PayController.lookupDebounce + const Duration(milliseconds: 20),
      );

      fast.complete(payee('p2', 'Second Seller'));
      await Future<void>.delayed(Duration.zero);
      slow.complete(payee('p1', 'First Seller'));
      await Future<void>.delayed(Duration.zero);

      expect(
        container.read(payControllerProvider).payee?.registeredName,
        'Second Seller',
      );
      // Both lookups are measured, including the stale one (PRD §10.1).
      expect(
        analytics.names.where((name) => name == 'payee_lookup_succeeded'),
        hasLength(2),
      );
      expect(analytics.events.first.$2['latencyMs'], isA<int>());
    },
  );

  test('incomplete numbers do not trigger a lookup', () async {
    container.read(payControllerProvider.notifier).identifierChanged('07881');
    await Future<void>.delayed(PayController.lookupDebounce * 2);
    verifyNever(() => payees.lookupPhone(any()));
    expect(container.read(payControllerProvider).lookingUp, isFalse);
  });

  test('the summary only matches a quote for exactly the selected payee, card and amount', () async {
    final quote = Quote.fromJson(contractFixture('quote_created'));
    when(() => payees.lookupPhone(any()))
        .thenAnswer((_) async => payee(quote.payeeId, quote.payeeName));
    when(
      () => quotes.create(
        payeeId: any(named: 'payeeId'),
        cardId: any(named: 'cardId'),
        amountRwf: any(named: 'amountRwf'),
      ),
    ).thenAnswer((_) async => quote);
    final controller = container.read(payControllerProvider.notifier);
    controller.selectCard(quote.cardId);
    controller.identifierChanged('0788123456');
    controller.amountChanged('${quote.amountRwf}');
    await Future<void>.delayed(const Duration(milliseconds: 900));
    expect(container.read(payControllerProvider).quoteMatches, isTrue);

    controller.amountChanged('${quote.amountRwf + 1}');
    expect(
      container.read(payControllerProvider).quoteMatches,
      isFalse,
      reason: 'stale total must never be payable',
    );
  });
}
