import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:xendirekt/app/app.dart';
import 'package:xendirekt/app/providers.dart';
import 'package:xendirekt/core/config/app_config.dart';
import 'package:xendirekt/core/security/biometric_gate.dart';
import 'package:xendirekt/core/storage/preferences.dart';
import 'package:xendirekt/core/storage/secure_store.dart';
import 'package:xendirekt/features/authentication/data/auth_api.dart';
import 'package:xendirekt/features/authentication/data/token_store.dart';

import 'recording_analytics.dart';

class FakeBiometricGate implements BiometricGate {
  bool available = true;
  bool approve = true;
  int prompts = 0;

  @override
  Future<bool> authenticate(String reason) async {
    prompts++;
    return approve;
  }

  @override
  Future<bool> isAvailable() async => available;
}

class TestHarness {
  TestHarness(this.api);

  final AuthApi api;
  final secure = MemorySecureStore();
  final biometrics = FakeBiometricGate();
  late Preferences preferences;
  final analytics = RecordingAnalytics();

  Future<List<Override>> overrides() async {
    SharedPreferences.setMockInitialValues({});
    preferences = Preferences(await SharedPreferences.getInstance());
    return [
      appConfigProvider.overrideWithValue(
        const AppConfig(apiBaseUrl: 'http://test.invalid', environment: 'test'),
      ),
      installIdProvider.overrideWithValue('test-install-id-0001'),
      analyticsProvider.overrideWithValue(analytics),
      secureStoreProvider.overrideWithValue(secure),
      preferencesProvider.overrideWithValue(preferences),
      biometricGateProvider.overrideWithValue(biometrics),
      authApiProvider.overrideWithValue(api),
      tokenStoreProvider.overrideWith(
        (ref) => TokenStore(secureStore: secure, authApi: () => api),
      ),
    ];
  }
}

Future<TestHarness> pumpXenDirekt(WidgetTester tester, AuthApi api) async {
  registerFallbackValue(Uri());
  // A real phone viewport (390×844 pt, 3x), not the 800×600 test default.
  tester.view
    ..physicalSize = const Size(1170, 2532)
    ..devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final harness = TestHarness(api);
  await tester.pumpWidget(
    ProviderScope(
      overrides: await harness.overrides(),
      child: const XenDirektApp(),
    ),
  );
  await tester.pumpAndSettle();
  return harness;
}
