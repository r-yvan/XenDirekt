import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/router/routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/widgets/motion/auth_illustration.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../../core/widgets/xd_logo.dart';
import '../../authentication/application/session_controller.dart';

/// The single welcome screen with sign-in buttons (FR-ONB-01). Methods the
/// backend has not enabled are hidden rather than shown and failing.
class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final config = ref.watch(sessionControllerProvider).clientConfig;
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: constraints.maxHeight - 28,
              ),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Spacer(),
                    // The illustration stands in for the logo tile; very short screens keep the
                    // compact tile so the sign-in buttons stay above the fold.
                    if (constraints.maxHeight >= 680)
                      FadeSlideIn(
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: AuthIllustration(
                            kind: AuthIllustrationKind.welcome,
                            size: (constraints.maxHeight * 0.22).clamp(
                              160,
                              240,
                            ),
                          ),
                        ),
                      )
                    else
                      FadeSlideIn(
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: context.xd.surface1,
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(color: context.xd.hairline),
                            ),
                            alignment: Alignment.center,
                            child: const XdLogo(size: 36),
                          ),
                        ),
                      ),
                    const SizedBox(height: 28),
                    FadeSlideIn(
                      delay: const Duration(milliseconds: 120),
                      child: Text(
                        l10n.welcomeTitle,
                        style: theme.displaySmall?.copyWith(
                          fontSize: 34,
                          height: 1.08,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FadeSlideIn(
                      delay: const Duration(milliseconds: 180),
                      child: Text(
                        l10n.tagline,
                        style: theme.bodyLarge?.copyWith(
                          color: context.xd.textSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 22),
                    for (final (index, (icon, text)) in [
                      (Icons.storefront_rounded, l10n.featureMomo),
                      (Icons.credit_card_rounded, l10n.featureCard),
                      (Icons.verified_user_outlined, l10n.featureName),
                    ].indexed)
                      FadeSlideIn(
                        delay: Duration(milliseconds: 240 + 60 * index),
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Row(
                            children: [
                              IconBadge(icon, size: 32),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  text,
                                  style: theme.bodyMedium?.copyWith(
                                    color: context.xd.textPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 18),
                    if (config == null || config.emailSignIn)
                      PrimaryButton(
                        label: l10n.continueWithEmail,
                        icon: Icons.mail_outline_rounded,
                        onPressed: () => context.push(Routes.signInEmail),
                      ),
                    if (config?.smsSignIn ?? false) ...[
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: () => context.push(Routes.signInPhone),
                        icon: const Icon(Icons.smartphone_rounded),
                        label: Text(l10n.continueWithPhone),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.lock_outline_rounded,
                          size: 14,
                          color: context.xd.textTertiary,
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            l10n.securedByPartner,
                            textAlign: TextAlign.center,
                            style: theme.bodySmall?.copyWith(
                              color: context.xd.textTertiary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
