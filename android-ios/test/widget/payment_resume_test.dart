import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:xendirekt/app/localization/generated/app_localizations.dart';
import 'package:xendirekt/app/providers.dart';
import 'package:xendirekt/app/theme/app_theme.dart';
import 'package:xendirekt/core/errors/api_failure.dart';
import 'package:xendirekt/core/storage/preferences.dart';
import 'package:xendirekt/features/payments/data/payment_models.dart';
import 'package:xendirekt/features/payments/data/payments_api.dart';
import 'package:xendirekt/features/payments/presentation/payment_progress_screen.dart';
import 'package:xendirekt/features/quotes/data/quote_models.dart';

import '../support/fixtures.dart';

class MockPaymentsApi extends Mock implements PaymentsApi {}

/// Scenario 11: the connection drops while paying. The app retries with the
/// SAME idempotency key, then follows the same payment until it settles.
void main() {
  testWidgets(
    'a lost connection resumes the same payment and never creates another',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final preferences = Preferences(await SharedPreferences.getInstance());
      final api = MockPaymentsApi();
      final quote = Quote.fromJson(contractFixture('quote_created'));
      final created = Payment.fromJson(contractFixture('payment_created'));
      final completed = Payment.fromJson(contractFixture('payment_completed'));
      const key = 'attempt-key-0001';

      var createCalls = 0;
      when(
        () => api.create(
          quoteId: any(named: 'quoteId'),
          idempotencyKey: any(named: 'idempotencyKey'),
          stepUpToken: any(named: 'stepUpToken'),
          note: any(named: 'note'),
        ),
      ).thenAnswer((_) async {
        createCalls++;
        if (createCalls == 1) {
          throw const ApiFailure.network(); // the response was lost
        }
        return created;
      });
      var polls = 0;
      when(() => api.get(any())).thenAnswer((_) async {
        polls++;
        if (polls == 1) {
          throw const ApiFailure.timeout(); // offline again while following it
        }
        return completed;
      });

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            preferencesProvider.overrideWithValue(preferences),
            paymentsApiProvider.overrideWithValue(api),
          ],
          child: MaterialApp(
            theme: AppTheme.dark(),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: PaymentProgressScreen(
              attempt: PaymentAttempt(
                quote: quote,
                idempotencyKey: key,
                stepUpToken: 'step-up',
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(createCalls, 1);

      // Backoff, retry with the same key, then poll (offline once), then settle.
      for (var i = 0; i < 12 && polls < 2; i++) {
        await tester.pump(const Duration(seconds: 1));
      }
      await tester.pump(const Duration(seconds: 5));
      await tester.pump(const Duration(seconds: 2));

      expect(createCalls, 2);
      final keys = verify(
        () => api.create(
          quoteId: quote.quoteId,
          idempotencyKey: captureAny(named: 'idempotencyKey'),
          stepUpToken: any(named: 'stepUpToken'),
          note: any(named: 'note'),
        ),
      ).captured;
      expect(keys, [key, key]);
      verify(() => api.get(created.id)).called(greaterThanOrEqualTo(2));
      verifyNever(() => api.get(any(that: isNot(created.id))));

      // Unmount so pending timers and animations are cancelled.
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
