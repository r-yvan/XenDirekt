import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/router/routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/widgets/xd_logo.dart';
import '../../authentication/application/session_controller.dart';

/// The single welcome screen with sign-in buttons (FR-ONB-01). Methods the
/// backend has not enabled are hidden rather than shown and failing.
class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final config = ref.watch(sessionControllerProvider).clientConfig;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Center(child: XdLogo(size: 88)),
              const SizedBox(height: 32),
              Text(
                l10n.welcomeTitle,
                style: Theme.of(context).textTheme.headlineMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                l10n.tagline,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const Spacer(),
              if (config == null || config.emailSignIn)
                FilledButton.icon(
                  onPressed: () => context.push(Routes.signInEmail),
                  icon: const Icon(Icons.mail_outline),
                  label: Text(l10n.continueWithEmail),
                ),
              if (config?.smsSignIn ?? false) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => context.push(Routes.signInPhone),
                  icon: const Icon(Icons.phone_iphone),
                  label: Text(l10n.continueWithPhone),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
