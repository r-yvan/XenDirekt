import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:xendirekt/core/errors/api_failure.dart';
import 'package:xendirekt/core/widgets/primary_button.dart';
import 'package:xendirekt/features/authentication/data/auth_models.dart';

import '../support/fake_auth_api.dart';
import '../support/pump_app.dart';

void main() {
  late MockAuthApi api;

  setUp(() {
    api = MockAuthApi();
    when(() => api.appConfig()).thenAnswer((_) async => fixtureAppConfig());
  });

  testWidgets(
    'signed-out user lands on the welcome screen with the sandbox-aware config',
    (tester) async {
      await pumpXenDirekt(tester, api);
      expect(find.text('Continue with email'), findsOneWidget);
      // Sign-in methods follow the server's feature flags.
      expect(
        find.text('Continue with phone'),
        fixtureAppConfig().smsSignIn ? findsOneWidget : findsNothing,
      );
    },
  );

  testWidgets(
    'email → code auto-submits → profile with consent → PIN twice → biometric offer → Pay',
    (tester) async {
      when(
        () => api.requestOtp(
          channel: 'EMAIL',
          destination: 'oliver@example.com',
          locale: any(named: 'locale'),
        ),
      ).thenAnswer((_) async => fixtureOtpChallenge());
      when(
        () => api.verifyOtp(
          challengeId: any(named: 'challengeId'),
          otp: '123456',
        ),
      ).thenAnswer((_) async => fixtureNewUserSignIn());
      when(
        () => api.updateProfile(
          fullName: 'Oliver Martin',
          countryOfResidence: any(named: 'countryOfResidence'),
          dateOfBirth: any(named: 'dateOfBirth'),
          preferredLanguage: any(named: 'preferredLanguage'),
          acceptLegalTerms: true,
        ),
      ).thenAnswer((_) async => fixtureActiveProfile());
      when(() => api.setPin('482913')).thenAnswer((_) async {});
      when(() => api.me())
          .thenAnswer((_) async => fixtureActiveProfile(pinSet: true));

      final harness = await pumpXenDirekt(tester, api);

      await tester.tap(find.text('Continue with email'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'oliver@example.com');
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(find.text('Enter the 6-digit code'), findsOneWidget);
      await tester.enterText(
        find.byType(TextField),
        '123456',
      ); // no Submit tap: auto-advance
      await tester.pumpAndSettle();

      expect(find.text('About you'), findsOneWidget);
      expect(await harness.secure.read('xd.refresh_token'), '<refreshToken>');
      final continueButton = find.widgetWithText(PrimaryButton, 'Continue');
      expect(
        tester.widget<PrimaryButton>(continueButton).onPressed,
        isNull,
        reason: 'disabled until complete',
      );

      await tester.enterText(find.byType(TextField), 'Oliver Martin');
      await tester.tap(find.text('Country of residence'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).last, 'Canada');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ListTile, 'Canada'));
      await tester.pumpAndSettle();
      // Wheel date picker: spin day, month and year, then confirm.
      await tester.tap(find.text('Date of birth'));
      await tester.pumpAndSettle();
      const item = 46.0;
      final defaultYear = DateTime.now().year - 30;
      await tester.drag(
        find.byKey(const Key('dob-day')),
        const Offset(0, -11 * item),
      );
      await tester.pumpAndSettle();
      await tester.drag(
        find.byKey(const Key('dob-month')),
        const Offset(0, -3 * item),
      );
      await tester.pumpAndSettle();
      await tester.drag(
        find.byKey(const Key('dob-year')),
        Offset(0, (defaultYear - 1990) * item),
      );
      await tester.pumpAndSettle();
      expect(find.text('April 12, 1990'), findsWidgets);
      await tester.tap(find.text('Done'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(continueButton);
      await tester.tap(continueButton);
      await tester.pumpAndSettle();
      verify(
        () => api.updateProfile(
          fullName: 'Oliver Martin',
          countryOfResidence: 'CA',
          dateOfBirth: '1990-04-12',
          preferredLanguage: any(named: 'preferredLanguage'),
          acceptLegalTerms: true,
        ),
      ).called(1);

      expect(find.text('Create a 6-digit PIN'), findsOneWidget);
      await tester.enterText(find.byType(TextField), '482913');
      await tester.pumpAndSettle();
      expect(find.text('Enter the same PIN again'), findsOneWidget);
      await tester.enterText(find.byType(TextField), '482913');
      await tester.pumpAndSettle();
      verify(() => api.setPin('482913')).called(1);

      expect(find.text('Approve with Face ID or fingerprint?'), findsOneWidget);
      await tester.tap(find.text('Not now'));
      await tester.pumpAndSettle();
      expect(find.text('Pay'), findsWidgets);
      expect(find.text('Sandbox: no real money moves'), findsOneWidget);
      expect(
        harness.analytics.events.map((event) => event.$1),
        containsAllInOrder(['signup_started', 'signup_completed']),
      );
      expect(
        harness.analytics.events
            .firstWhere((e) => e.$1 == 'signup_completed')
            .$2,
        {'country': 'CA'},
      );
    },
  );

  testWidgets(
    'a mismatched PIN confirmation starts over without calling the server',
    (tester) async {
      when(
        () => api.requestOtp(
          channel: 'EMAIL',
          destination: any(named: 'destination'),
          locale: any(named: 'locale'),
        ),
      ).thenAnswer((_) async => fixtureOtpChallenge());
      final signIn = fixtureNewUserSignIn();
      when(
        () => api.verifyOtp(
          challengeId: any(named: 'challengeId'),
          otp: any(named: 'otp'),
        ),
      ).thenAnswer(
        (_) async => SignInResult(
          tokens: signIn.tokens,
          user: fixtureActiveProfile(),
          isNewUser: false,
        ),
      );
      await pumpXenDirekt(tester, api);
      await tester.tap(find.text('Continue with email'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'a@example.com');
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '123456');
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), '482913');
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '482914');
      await tester.pumpAndSettle();
      expect(find.text("The PINs don't match. Try again."), findsOneWidget);
      expect(find.text('Create a 6-digit PIN'), findsOneWidget);
      verifyNever(() => api.setPin(any()));
    },
  );

  testWidgets(
    'a wrong code shows the server error and keeps the user on the code screen',
    (tester) async {
      when(
        () => api.requestOtp(
          channel: 'EMAIL',
          destination: any(named: 'destination'),
          locale: any(named: 'locale'),
        ),
      ).thenAnswer((_) async => fixtureOtpChallenge());
      when(
        () => api.verifyOtp(
          challengeId: any(named: 'challengeId'),
          otp: any(named: 'otp'),
        ),
      ).thenThrow(
        const ApiFailure(
          code: 'OTP_INVALID',
          details: {'attemptsRemaining': 4},
        ),
      );
      await pumpXenDirekt(tester, api);
      await tester.tap(find.text('Continue with email'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'b@example.com');
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '000000');
      await tester.pumpAndSettle();
      expect(find.text('That code is not correct.'), findsOneWidget);
      expect(find.text('Enter the 6-digit code'), findsOneWidget);
    },
  );
}
