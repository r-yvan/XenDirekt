import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/router/routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/widgets/motion/auth_illustration.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/primary_button.dart';
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
                    // A large centred illustration tells the story (card → MoMo); very short
                    // screens keep the compact logo so the sign-in button stays above the fold.
                    FadeSlideIn(
                      child: Center(
                        child: constraints.maxHeight >= 600
                            ? AuthIllustration(
                                kind: AuthIllustrationKind.welcome,
                                size: math.min(
                                  constraints.maxWidth * 0.86,
                                  constraints.maxHeight * 0.42,
                                ),
                              )
                            : Container(
                                width: 64,
                                height: 64,
                                decoration: BoxDecoration(
                                  color: context.xd.surface1,
                                  borderRadius: BorderRadius.circular(22),
                                  border: Border.all(
                                    color: context.xd.hairline,
                                  ),
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
                        textAlign: TextAlign.center,
                        style: theme.displaySmall?.copyWith(
                          fontSize: 32,
                          height: 1.1,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FadeSlideIn(
                      delay: const Duration(milliseconds: 180),
                      child: Text(
                        l10n.tagline,
                        textAlign: TextAlign.center,
                        style: theme.bodyLarge?.copyWith(
                          color: context.xd.textSecondary,
                        ),
                      ),
                    ),
                    const Spacer(),
                    const SizedBox(height: 24),
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
