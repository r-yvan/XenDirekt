import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers.dart';

/// null = follow the device language (FR-ONB-05); English when the device language is unsupported.
class LocaleController extends Notifier<Locale?> {
  @override
  Locale? build() {
    final saved = ref.watch(preferencesProvider).language;
    return saved == null ? null : Locale(saved);
  }

  Future<void> set(String? languageCode) async {
    await ref.read(preferencesProvider).setLanguage(languageCode);
    state = languageCode == null ? null : Locale(languageCode);
  }
}

final localeControllerProvider = NotifierProvider<LocaleController, Locale?>(
  LocaleController.new,
);

String effectiveLanguage(Locale? chosen) {
  final code =
      chosen?.languageCode ?? PlatformDispatcher.instance.locale.languageCode;
  return code == 'fr' ? 'fr' : 'en';
}
