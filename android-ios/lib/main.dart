import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'app/app.dart';
import 'app/providers.dart';
import 'core/config/app_config.dart';
import 'core/storage/preferences.dart';
import 'core/storage/secure_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = AppConfig.fromEnvironment();
  final secureStore = PlatformSecureStore();
  var installId = await secureStore.read(SecureKeys.installId);
  final firstLaunch = installId == null;
  if (installId == null) {
    installId = const Uuid().v4();
    await secureStore.write(SecureKeys.installId, installId);
  }
  final preferences = Preferences(await SharedPreferences.getInstance());
  final container = ProviderContainer(
    overrides: [
      appConfigProvider.overrideWithValue(config),
      installIdProvider.overrideWithValue(installId),
      secureStoreProvider.overrideWithValue(secureStore),
      preferencesProvider.overrideWithValue(preferences),
    ],
  );
  if (firstLaunch) {
    // Sent once signed in (analytics needs a session); no personal data.
    container.read(analyticsProvider).track('app_installed', {
      'platform': defaultTargetPlatform == TargetPlatform.iOS
          ? 'ios'
          : 'android',
      'language': PlatformDispatcher.instance.locale.languageCode == 'fr'
          ? 'fr'
          : 'en',
    });
  }
  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const XenDirektApp(),
    ),
  );
}
