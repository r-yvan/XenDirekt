import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/analytics/analytics.dart';
import '../core/config/app_config.dart';
import '../core/network/api_client.dart';
import '../core/security/biometric_gate.dart';
import '../core/security/device_key.dart';
import '../core/storage/preferences.dart';
import '../core/storage/secure_store.dart';
import '../core/web/hosted_page_launcher.dart';
import '../features/authentication/data/auth_api.dart';
import '../features/authentication/data/token_store.dart';
import '../features/cards/data/cards_api.dart';
import '../features/notifications/data/notifications_api.dart';
import '../features/payee_lookup/data/payees_api.dart';
import '../features/payments/data/payments_api.dart';
import '../features/quotes/data/quotes_api.dart';
import '../features/support/data/support_api.dart';

/// Root dependencies, overridden in main.dart (after async bootstrap) and in tests.
final appConfigProvider = Provider<AppConfig>(
  (ref) => throw UnimplementedError('appConfigProvider must be overridden'),
);

/// Random per-install ID kept in secure storage; binds sessions to this device.
final installIdProvider = Provider<String>(
  (ref) => throw UnimplementedError('installIdProvider must be overridden'),
);

final preferencesProvider = Provider<Preferences>(
  (ref) => throw UnimplementedError('preferencesProvider must be overridden'),
);

final secureStoreProvider = Provider<SecureStore>(
  (ref) => PlatformSecureStore(),
);

final biometricGateProvider = Provider<BiometricGate>(
  (ref) => LocalAuthBiometricGate(),
);

final deviceKeyServiceProvider = Provider<DeviceKeyService>(
  (ref) => DeviceKeyService(ref.watch(secureStoreProvider)),
);

/// Unauthenticated client; [apiClientProvider] attaches the token store.
final _rawApiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(
    config: ref.watch(appConfigProvider),
    installId: ref.watch(installIdProvider),
  ),
);

final tokenStoreProvider = Provider<TokenStore>((ref) {
  final api = ref.watch(_rawApiClientProvider);
  final store = TokenStore(
    secureStore: ref.watch(secureStoreProvider),
    authApi: () => AuthApi(api, installId: ref.read(installIdProvider)),
  );
  api.attachTokenSource(store);
  return store;
});

final apiClientProvider = Provider<ApiClient>((ref) {
  ref.watch(tokenStoreProvider);
  return ref.watch(_rawApiClientProvider);
});

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(
    ref.watch(apiClientProvider),
    installId: ref.watch(installIdProvider),
  ),
);

final cardsApiProvider = Provider<CardsApi>(
  (ref) => CardsApi(ref.watch(apiClientProvider)),
);
final payeesApiProvider = Provider<PayeesApi>(
  (ref) => PayeesApi(ref.watch(apiClientProvider)),
);
final quotesApiProvider = Provider<QuotesApi>(
  (ref) => QuotesApi(ref.watch(apiClientProvider)),
);
final hostedPageLauncherProvider = Provider<HostedPageLauncher>(
  (ref) =>
      kIsWeb ? BrowserTabHostedPageLauncher() : WebViewHostedPageLauncher(),
);
final paymentsApiProvider = Provider<PaymentsApi>(
  (ref) => PaymentsApi(ref.watch(apiClientProvider)),
);
final supportApiProvider = Provider<SupportApi>(
  (ref) => SupportApi(ref.watch(apiClientProvider)),
);
final notificationsApiProvider = Provider<NotificationsApi>(
  (ref) => NotificationsApi(ref.watch(apiClientProvider)),
);
final analyticsProvider = Provider<Analytics>(
  (ref) => Analytics(ref.watch(apiClientProvider)),
);
