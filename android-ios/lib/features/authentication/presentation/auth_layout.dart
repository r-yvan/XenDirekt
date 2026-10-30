import 'package:flutter/material.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/widgets/ui_kit.dart';

/// The shared frame for sign-in and onboarding steps: optional back button and
/// step progress, a haloed icon, title and subtitle, the step's content, and
/// actions pinned to the bottom (above the keyboard when it is open).
class AuthLayout extends StatelessWidget {
  const AuthLayout({
    required this.title,
    required this.child,
    this.icon,
    this.hero,
    this.subtitle,
    this.step,
    this.totalSteps = 3,
    this.showBack = false,
    this.actions = const [],
    this.centered = false,
    super.key,
  });

  final String title;
  final Widget child;
  final IconData? icon;

  /// Replaces the haloed [icon] with any widget (e.g. the user's avatar).
  final Widget? hero;
  final String? subtitle;

  /// 1-based onboarding step; null hides the progress bar.
  final int? step;
  final int totalSteps;
  final bool showBack;
  final List<Widget> actions;

  /// Centre the header (lock and permission screens) instead of left-aligning.
  final bool centered;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final align = centered
        ? CrossAxisAlignment.center
        : CrossAxisAlignment.start;
    final textAlign = centered ? TextAlign.center : TextAlign.start;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            if (showBack || step != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 20, 0),
                child: Row(
                  children: [
                    if (showBack)
                      IconButton(
                        tooltip: MaterialLocalizations.of(context)
                            .backButtonTooltip,
                        style: IconButton.styleFrom(
                          backgroundColor: context.xd.surface1,
                          side: BorderSide(color: context.xd.hairline),
                        ),
                        onPressed: () => Navigator.of(context).maybePop(),
                        icon: const Icon(
                          Icons.arrow_back_ios_new_rounded,
                          size: 18,
                        ),
                      )
                    else
                      const SizedBox(width: 8),
                    if (step != null) ...[
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            StepProgress(current: step!, total: totalSteps),
                            const SizedBox(height: 6),
                            Text(
                              l10n.stepOf(step!, totalSteps),
                              style: theme.labelSmall?.copyWith(
                                color: context.xd.textTertiary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) => SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight - 36,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (centered) const SizedBox(height: 24),
                        FadeSlideIn(
                          child: Column(
                            crossAxisAlignment: align,
                            children: [
                              if (hero != null) ...[
                                hero!,
                                const SizedBox(height: 18),
                              ] else if (icon != null) ...[
                                HaloIcon(icon!, size: centered ? 128 : 96),
                                const SizedBox(height: 18),
                              ],
                              Semantics(
                                header: true,
                                child: Text(
                                  title,
                                  textAlign: textAlign,
                                  style: theme.headlineLarge,
                                ),
                              ),
                              if (subtitle != null) ...[
                                const SizedBox(height: 10),
                                Text(
                                  subtitle!,
                                  textAlign: textAlign,
                                  style: theme.bodyLarge?.copyWith(
                                    color: context.xd.textSecondary,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),
                        FadeSlideIn(
                          delay: const Duration(milliseconds: 90),
                          child: child,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            if (actions.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 4, 24, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: actions,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
