import 'package:mocktail/mocktail.dart';
import 'package:xendirekt/features/authentication/data/auth_api.dart';
import 'package:xendirekt/features/authentication/data/auth_models.dart';
import 'package:xendirekt/shared/models/app_client_config.dart';
import 'package:xendirekt/shared/models/user_profile.dart';

import 'fixtures.dart';

class MockAuthApi extends Mock implements AuthApi {}

AppClientConfig fixtureAppConfig() =>
    AppClientConfig.fromJson(contractFixture('app_config'));
SignInResult fixtureNewUserSignIn() =>
    SignInResult.fromJson(contractFixture('auth_verified_new_user'));
OtpChallenge fixtureOtpChallenge() {
  final json = contractFixture('auth_otp_requested');
  // Fixture timestamps are in the past; move resend availability to now.
  return OtpChallenge.fromJson({
    ...json,
    'expiresAt': DateTime.now()
        .add(const Duration(minutes: 5))
        .toIso8601String(),
    'resendAvailableAt': DateTime.now()
        .add(const Duration(seconds: 30))
        .toIso8601String(),
  });
}

UserProfile fixtureActiveProfile({bool pinSet = false}) => UserProfile.fromJson(
  {...contractFixture('me_profile_active'), 'pinSet': pinSet},
);
