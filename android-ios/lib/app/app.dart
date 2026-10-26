import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/security/app_lock_observer.dart';
import '../features/authentication/application/session_controller.dart';
import 'locale_controller.dart';
import 'localization/generated/app_localizations.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

class XenDirektApp extends ConsumerWidget {
  const XenDirektApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'XenDirekt',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.dark,
      locale: ref.watch(localeControllerProvider),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: ref.watch(routerProvider),
      builder: (context, child) => AppLockObserver(
        onLockRequired: () =>
            ref.read(sessionControllerProvider.notifier).lock(),
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
