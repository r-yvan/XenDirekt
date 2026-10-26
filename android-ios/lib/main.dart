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
  if (installId == null) {
    installId = const Uuid().v4();
    await secureStore.write(SecureKeys.installId, installId);
  }
  final preferences = Preferences(await SharedPreferences.getInstance());
  runApp(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(config),
        installIdProvider.overrideWithValue(installId),
        secureStoreProvider.overrideWithValue(secureStore),
        preferencesProvider.overrideWithValue(preferences),
      ],
      child: const XenDirektApp(),
    ),
  );
}
