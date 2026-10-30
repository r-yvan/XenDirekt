import 'package:flutter/foundation.dart';

/// Build-time configuration, injected with `--dart-define` (see .env.example).
/// Nothing secret belongs here: anything in the app binary can be extracted.
/// The payment provider's API key lives only on the XenDirekt backend.
class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.environment,
    this.certificatePinsPem = const [],
  });

  factory AppConfig.fromEnvironment() {
    const definedApiBaseUrl = String.fromEnvironment('API_BASE_URL');
    final apiBaseUrl = definedApiBaseUrl.isNotEmpty
        ? definedApiBaseUrl
        : kIsWeb
        // Web preview: the API on the same host that served the page, so one
        // build works from localhost and from a phone on the LAN.
        ? '${Uri.base.scheme}://${Uri.base.host}:3000'
        // Android emulator alias for the developer machine.
        : 'http://10.0.2.2:3000';
    const environment = String.fromEnvironment(
      'APP_ENV',
      defaultValue: 'local',
    );
    const pins = String.fromEnvironment('CERT_PINS_PEM');
    return AppConfig(
      apiBaseUrl: apiBaseUrl,
      environment: environment,
      certificatePinsPem: pins.isEmpty
          ? const []
          : pins
                .split('-----END CERTIFICATE-----')
                .where((part) => part.trim().isNotEmpty)
                .map((part) => '${part.trim()}\n-----END CERTIFICATE-----\n')
                .toList(),
    );
  }

  final String apiBaseUrl;
  final String environment;

  /// PEM certificates the API's TLS chain must lead to (NFR-SEC-02). Empty means
  /// the platform trust store is used (local development only).
  final List<String> certificatePinsPem;

  bool get isProduction => environment == 'production';

  /// Release builds for production must use TLS.
  bool get isInsecureTransport => apiBaseUrl.startsWith('http://');
}
