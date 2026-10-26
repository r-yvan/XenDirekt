@Tags(['live'])
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:uuid/uuid.dart';
import 'package:xendirekt/core/config/app_config.dart';
import 'package:xendirekt/core/errors/api_failure.dart';
import 'package:xendirekt/core/network/api_client.dart';
import 'package:xendirekt/core/security/device_key.dart';
import 'package:xendirekt/core/storage/secure_store.dart';
import 'package:xendirekt/features/authentication/data/auth_api.dart';
import 'package:xendirekt/features/authentication/data/auth_models.dart';
import 'package:xendirekt/features/authentication/data/token_store.dart';
import 'package:xendirekt/features/cards/data/cards_api.dart';
import 'package:xendirekt/features/payee_lookup/data/payees_api.dart';
import 'package:xendirekt/features/quotes/data/quotes_api.dart';

/// Mobile ↔ API integration against a running backend (no mocks):
///   XD_LIVE_API=http://localhost:3100 flutter test test/integration/live_api_test.dart
/// The API must run with APP_ENV=local|test and EMAIL_TRANSPORT=dev-inbox so the
/// emailed code can be read from /dev/inbox. Skipped when XD_LIVE_API is unset.
final liveApi = Platform.environment['XD_LIVE_API'];

class LiveSession {
  LiveSession(this.baseUrl) {
    final installId = const Uuid().v4();
    api = ApiClient(
      config: AppConfig(apiBaseUrl: baseUrl, environment: 'test'),
      installId: installId,
    );
    auth = AuthApi(api, installId: installId);
    tokens = TokenStore(secureStore: secure, authApi: () => auth);
    api.attachTokenSource(tokens);
    deviceKey = DeviceKeyService(secure);
  }

  final String baseUrl;
  final MemorySecureStore secure = MemorySecureStore();
  late final ApiClient api;
  late final AuthApi auth;
  late final TokenStore tokens;
  late final DeviceKeyService deviceKey;

  /// What the WebView does: post the chosen test card on the hosted mock page.
  Future<Uri> chooseTestCard(Uri hostedUrl, String cardKey) async {
    final client = HttpClient();
    try {
      final request = await client.postUrl(hostedUrl);
      request.followRedirects = false;
      request.headers.contentType = ContentType(
        'application',
        'x-www-form-urlencoded',
      );
      request.write('cardKey=$cardKey');
      final response = await request.close();
      await response.drain<void>();
      return Uri.parse(response.headers.value('location')!);
    } finally {
      client.close();
    }
  }

  Future<String> codeFromDevInbox(String email) async {
    final client = HttpClient();
    try {
      final request = await client.getUrl(
        Uri.parse('$baseUrl/dev/inbox?to=${Uri.encodeQueryComponent(email)}'),
      );
      final response = await request.close();
      final body = jsonDecode(
        await response.transform(utf8.decoder).join(),
      ) as Map<String, Object?>;
      final messages = (body['messages']! as List).cast<Map<String, Object?>>();
      return RegExp(r'\b(\d{6})\b')
          .firstMatch(messages.first['text']! as String)!
          .group(1)!;
    } finally {
      client.close();
    }
  }
}

void main() {
  test(
    'sign-up, profile, PIN, biometric step-up, refresh and logout against the live API',
    () async {
      final session = LiveSession(liveApi!);
      final email = 'live-${const Uuid().v4().substring(0, 8)}@example.com';

      final config = await session.auth.appConfig();
      expect(config.isSandbox, isTrue);

      final challenge = await session.auth.requestOtp(
        channel: 'EMAIL',
        destination: email,
        locale: 'en',
      );
      final signedIn = await session.auth.verifyOtp(
        challengeId: challenge.challengeId,
        otp: await session.codeFromDevInbox(email),
      );
      expect(signedIn.isNewUser, isTrue);
      await session.tokens.save(signedIn.tokens);

      final profile = await session.auth.updateProfile(
        fullName: 'Live Tester',
        countryOfResidence: 'GB',
        dateOfBirth: '1991-07-01',
        acceptLegalTerms: true,
      );
      expect(profile.profileComplete, isTrue);

      await session.auth.setPin('482913');
      final registerToken = await session.auth.stepUpWithPin(
        StepUpPurpose.registerDeviceKey,
        '482913',
      );
      await session.auth.registerDeviceKey(
        publicKeyBase64: await session.deviceKey.createKey(),
        stepUpToken: registerToken,
      );

      final stepUp = await session.auth.stepUpChallenge(StepUpPurpose.payment);
      final paymentToken = await session.auth.stepUpWithDeviceKey(
        StepUpPurpose.payment,
        challengeId: stepUp.challengeId,
        signature: await session.deviceKey.sign(stepUp.signingMessage),
      );
      expect(paymentToken, isNotEmpty);
      expect((await session.auth.me()).biometricKeyRegistered, isTrue);

      // Phase 3: card via hosted page, payee lookup, server-side quote.
      final cardsApi = CardsApi(session.api);
      final setup = await cardsApi.startSetup();
      final redirect = await session.chooseTestCard(
        setup.hostedUrl,
        'visa-home',
      );
      expect(redirect.toString(), startsWith(setup.returnUrlPrefix));
      final card = await cardsApi.completeSetup(setup.setupId);
      expect(card.isDefault, isTrue);
      expect(card.issuingCountry, 'GB');

      final payee = await PayeesApi(session.api).lookupPhone('078 812 3456');
      expect(payee.registeredName, startsWith('SANDBOX'));
      final quote = await QuotesApi(session.api)
          .create(payeeId: payee.payeeId, cardId: card.id, amountRwf: 12000);
      expect(quote.totalRwf, quote.amountRwf + quote.feeRwf);
      expect(quote.cardCurrency, 'GBP');

      final wrongPin = session.auth.verifyPin('905173');
      await expectLater(
        wrongPin,
        throwsA(isA<ApiFailure>().having((f) => f.code, 'code', 'PIN_INVALID')),
      );

      expect(await session.tokens.refreshAccessToken(), isNotNull);
      expect((await session.auth.me()).email, email);

      await session.auth.logout();
      await expectLater(
        session.auth.me(),
        throwsA(
          isA<ApiFailure>().having((f) => f.code, 'code', 'SESSION_REVOKED'),
        ),
      );
    },
    skip: liveApi == null ? 'Set XD_LIVE_API to run against a live API' : false,
  );
}
