import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/widgets/state_views.dart';
import '../../features/authentication/application/session_controller.dart';
import '../localization/generated/app_localizations.dart';
import '../theme/app_colors.dart';

/// Three bottom tabs only: Pay, History, Profile (PRD §5.0 rule 1).
class HomeShell extends ConsumerWidget {
  const HomeShell({required this.shell, super.key});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final sandbox = ref.watch(
      sessionControllerProvider.select((state) => state.isSandbox),
    );
    final paused = ref.watch(
      sessionControllerProvider.select((state) => state.paymentsPaused),
    );
    return Scaffold(
      body: Column(
        children: [
          if (sandbox || paused)
            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  if (sandbox) const SandboxBanner(),
                  if (paused) NoticeBanner(text: l10n.paymentsPausedBanner),
                ],
              ),
            ),
          // The banner already sits below the status bar; stop each tab
          // from adding the top inset a second time. This scaffold already
          // ends at the keyboard, so the tabs must not subtract it again.
          Expanded(
            child: MediaQuery.removeViewInsets(
              context: context,
              removeBottom: true,
              child: Builder(
                builder: (context) => MediaQuery.removePadding(
                  context: context,
                  removeTop: sandbox || paused,
                  child: shell,
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          color: context.xd.surface1,
          border: Border(top: BorderSide(color: context.xd.hairline)),
        ),
        child: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (index) => shell.goBranch(
            index,
            initialLocation: index == shell.currentIndex,
          ),
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.storefront_outlined),
              selectedIcon: const Icon(Icons.storefront_rounded),
              label: l10n.tabPay,
            ),
            NavigationDestination(
              icon: const Icon(Icons.receipt_long_outlined),
              selectedIcon: const Icon(Icons.receipt_long_rounded),
              label: l10n.tabHistory,
            ),
            NavigationDestination(
              icon: const Icon(Icons.person_outline_rounded),
              selectedIcon: const Icon(Icons.person_rounded),
              label: l10n.tabProfile,
            ),
          ],
        ),
      ),
    );
  }
}
