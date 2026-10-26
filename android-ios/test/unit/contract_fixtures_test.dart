import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:xendirekt/core/errors/api_failure.dart';
import 'package:xendirekt/core/network/api_client.dart';
import 'package:xendirekt/features/authentication/data/auth_models.dart';
import 'package:xendirekt/features/cards/data/card_models.dart';
import 'package:xendirekt/features/payee_lookup/data/payee_models.dart';
import 'package:xendirekt/features/payee_lookup/data/payees_api.dart';
import 'package:xendirekt/features/quotes/data/quote_models.dart';
import 'package:xendirekt/shared/models/app_client_config.dart';
import 'package:xendirekt/shared/models/json.dart';
import 'package:xendirekt/shared/models/user_profile.dart';

/// Decodes the response bodies recorded by the API e2e suite
/// (api/test/support/contracts.ts → /contracts/fixtures). If the API changes a
/// shape the app relies on, these tests fail on the mobile side.
Json fixture(String name) {
  final file = File('../contracts/fixtures/$name.json');
  if (!file.existsSync()) {
    fail(
      'Missing contract fixture $name.json: run `npm run test:e2e` in /api first',
    );
  }
  return (jsonDecode(file.readAsStringSync()) as Map).cast<String, Object?>();
}

void main() {
  test('app config', () {
    final config = AppClientConfig.fromJson(fixture('app_config'));
    expect(config.isSandbox, isTrue);
    expect(config.otpLength, 6);
    expect(config.pinLength, 6);
    expect(config.merchantCodes, isFalse);
  });

  test('OTP challenge', () {
    final challenge = OtpChallenge.fromJson(fixture('auth_otp_requested'));
    expect(challenge.codeLength, 6);
    expect(challenge.resendAvailableAt.isAfter(challenge.expiresAt), isFalse);
  });

  test('sign-in result for a new user', () {
    final result = SignInResult.fromJson(fixture('auth_verified_new_user'));
    expect(result.isNewUser, isTrue);
    expect(result.tokens.expiresIn, 900);
    expect(result.user.profileComplete, isFalse);
    expect(result.user.pinSet, isFalse);
  });

  test('refreshed tokens', () {
    expect(TokenPair.fromJson(fixture('auth_refreshed')).expiresIn, 900);
  });

  test('active profile', () {
    final profile = UserProfile.fromJson(fixture('me_profile_active'));
    expect(profile.profileComplete, isTrue);
    expect(profile.firstName, isNotEmpty);
  });

  test('step-up challenge carries the message to sign', () {
    final challenge = StepUpChallenge.fromJson(
      fixture('auth_step_up_challenge'),
    );
    expect(
      challenge.signingMessage,
      startsWith('xendirekt-step-up:v1:${challenge.challengeId}:'),
    );
  });

  test('error envelope maps to ApiFailure', () {
    final request = RequestOptions(path: '/');
    final failure = mapDioError(
      DioException(
        requestOptions: request,
        type: DioExceptionType.badResponse,
        response: Response<Object?>(
          requestOptions: request,
          statusCode: 400,
          data: fixture('error_validation'),
        ),
      ),
    );
    expect(failure.code, 'VALIDATION_FAILED');
    expect(failure.requestId, isNotNull);
    expect(failure.kind, FailureKind.server);
  });

  test('card setup, card and card list', () {
    final setup = CardSetupSession.fromJson(fixture('card_setup_started'));
    expect(setup.returnUrlPrefix, 'xendirekt-app://card-setup/return');
    final card = PaymentCard.fromJson(fixture('card_added'));
    expect(card.last4, hasLength(4));
    expect(card.expiryLabel, matches(RegExp(r'^\d{2}/\d{2}$')));
    final list = readObjectList(
      fixture('cards_list'),
      'cards',
    ).map(PaymentCard.fromJson);
    expect(list, isNotEmpty);
  });

  test('payee lookup', () {
    final payee = PayeeLookup.fromJson(fixture('payee_lookup'));
    expect(payee.registeredName, isNotEmpty);
    expect(payee.maskedIdentifier, contains('*'));
  });

  test('quote: all figures come from the server', () {
    final quote = Quote.fromJson(fixture('quote_created'));
    expect(quote.totalRwf, quote.amountRwf + quote.feeRwf);
    expect(quote.totalCardDisplay, startsWith(quote.cardCurrency));
    expect(quote.cardLabel, contains('••••'));
  });

  test('client-side completeness check for automatic lookup', () {
    expect(isCompleteRwandanNumber('078 812 3456'), isTrue);
    expect(isCompleteRwandanNumber('+250788123456'), isTrue);
    expect(isCompleteRwandanNumber('078812345'), isFalse);
  });
}
