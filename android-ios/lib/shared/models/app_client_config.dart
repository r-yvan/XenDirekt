import 'json.dart';

/// Mirrors `GET /v1/app-config`. Features the backend cannot honour are hidden.
class AppClientConfig {
  const AppClientConfig({
    required this.providerMode,
    required this.merchantCodes,
    required this.emailSignIn,
    required this.smsSignIn,
    required this.identityVerification,
    required this.otpLength,
    required this.pinLength,
    required this.otpResendSeconds,
    required this.termsUrl,
    required this.privacyUrl,
    this.bannerKind,
  });

  factory AppClientConfig.fromJson(Json json) {
    final features = readObject(json, 'features');
    final auth = readObject(json, 'auth');
    final legal = readObject(json, 'legal');
    final banner = readObjectOrNull(json, 'banner');
    return AppClientConfig(
      providerMode: readString(json, 'providerMode'),
      merchantCodes: readBool(features, 'merchantCodes'),
      emailSignIn: readBool(features, 'emailSignIn'),
      smsSignIn: readBool(features, 'smsSignIn'),
      identityVerification: readBool(features, 'identityVerification'),
      otpLength: readInt(auth, 'otpLength'),
      pinLength: readInt(auth, 'pinLength'),
      otpResendSeconds: readInt(auth, 'otpResendSeconds'),
      termsUrl: readString(legal, 'termsUrl'),
      privacyUrl: readString(legal, 'privacyUrl'),
      bannerKind: banner == null ? null : readStringOrNull(banner, 'kind'),
    );
  }

  final String providerMode;
  final bool merchantCodes;
  final bool emailSignIn;
  final bool smsSignIn;
  final bool identityVerification;
  final int otpLength;
  final int pinLength;
  final int otpResendSeconds;
  final String termsUrl;
  final String privacyUrl;
  final String? bannerKind;

  /// Operations paused new payments (provider outage runbook).
  bool get paymentsPaused => bannerKind == 'PAYMENTS_PAUSED';

  /// Simulated money: every screen shows the sandbox banner.
  bool get isSandbox => providerMode == 'SANDBOX';
}
