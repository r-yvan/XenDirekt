import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../../../shared/models/app_client_config.dart';
import '../../../shared/models/user_profile.dart';
import 'auth_models.dart';

/// `/v1/auth`, `/v1/me` and `/v1/app-config`. Field names follow the
/// contract fixtures recorded by the API e2e suite.
class AuthApi {
  AuthApi(this._api, {required this.installId});

  final ApiClient _api;
  final String installId;

  static String? get _platform {
    if (kIsWeb) {
      return null; // the API accepts only ios/android; web is a dev preview
    }
    return switch (defaultTargetPlatform) {
      TargetPlatform.iOS => 'ios',
      TargetPlatform.android => 'android',
      _ => null,
    };
  }

  Future<AppClientConfig> appConfig() async => AppClientConfig.fromJson(
    await _api.get('/v1/app-config', authenticated: false),
  );

  Future<OtpChallenge> requestOtp({
    required String channel,
    required String destination,
    String? locale,
  }) async => OtpChallenge.fromJson(
    await _api.post(
      '/v1/auth/otp',
      authenticated: false,
      body: {'channel': channel, 'destination': destination, 'locale': ?locale},
    ),
  );

  Future<SignInResult> verifyOtp({
    required String challengeId,
    required String otp,
  }) async => SignInResult.fromJson(
    await _api.post(
      '/v1/auth/verify',
      authenticated: false,
      body: {
        'challengeId': challengeId,
        'otp': otp,
        'deviceId': installId,
        'platform': ?_platform,
        'appVersion': '1.0.0',
      },
    ),
  );

  Future<TokenPair> refresh(String refreshToken) async => TokenPair.fromJson(
    await _api.post(
      '/v1/auth/refresh',
      authenticated: false,
      body: {'refreshToken': refreshToken, 'deviceId': installId},
    ),
  );

  Future<void> logout() => _api.post('/v1/auth/logout');

  Future<UserProfile> me() async =>
      UserProfile.fromJson(await _api.get('/v1/me'));

  Future<UserProfile> updateProfile({
    String? fullName,
    String? countryOfResidence,
    String? dateOfBirth,
    String? preferredLanguage,
    bool? acceptLegalTerms,
  }) async => UserProfile.fromJson(
    await _api.patch(
      '/v1/me',
      body: {
        'fullName': ?fullName,
        'countryOfResidence': ?countryOfResidence,
        'dateOfBirth': ?dateOfBirth,
        'preferredLanguage': ?preferredLanguage,
        'acceptLegalTerms': ?acceptLegalTerms,
      },
    ),
  );

  Future<void> setPin(String pin) =>
      _api.post('/v1/me/pin', body: {'pin': pin});

  Future<void> verifyPin(String pin) =>
      _api.post('/v1/auth/pin/verify', body: {'pin': pin});

  Future<void> changePin(String pin, {required String stepUpToken}) =>
      _api.post(
        '/v1/me/pin/change',
        body: {'pin': pin},
        headers: {'X-Step-Up-Token': stepUpToken},
      );

  Future<StepUpChallenge> stepUpChallenge(StepUpPurpose purpose) async =>
      StepUpChallenge.fromJson(
        await _api.post(
          '/v1/auth/step-up/challenge',
          body: {'purpose': purpose.wire},
        ),
      );

  Future<String> stepUpWithPin(StepUpPurpose purpose, String pin) async {
    final json = await _api.post(
      '/v1/auth/step-up',
      body: {'purpose': purpose.wire, 'method': 'PIN', 'pin': pin},
    );
    return json['stepUpToken']! as String;
  }

  Future<String> stepUpWithDeviceKey(
    StepUpPurpose purpose, {
    required String challengeId,
    required String signature,
  }) async {
    final json = await _api.post(
      '/v1/auth/step-up',
      body: {
        'purpose': purpose.wire,
        'method': 'DEVICE_KEY',
        'challengeId': challengeId,
        'signature': signature,
      },
    );
    return json['stepUpToken']! as String;
  }

  Future<void> registerDeviceKey({
    required String publicKeyBase64,
    required String stepUpToken,
  }) => _api.post(
    '/v1/me/device-key',
    body: {'algorithm': 'ED25519', 'publicKey': publicKeyBase64},
    headers: {'X-Step-Up-Token': stepUpToken},
  );

  Future<void> revokeDeviceKey() => _api.delete('/v1/me/device-key');

  Future<void> deleteAccount({required String stepUpToken}) =>
      _api.delete('/v1/me', headers: {'X-Step-Up-Token': stepUpToken});
}
