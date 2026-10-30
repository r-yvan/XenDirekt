import 'package:flutter/material.dart';

import '../../app/localization/generated/app_localizations.dart';
import '../../app/theme/app_colors.dart';

class SandboxBanner extends StatelessWidget {
  const SandboxBanner({super.key});

  @override
  Widget build(BuildContext context) => NoticeBanner(
    text: AppLocalizations.of(context).sandboxBanner,
    icon: Icons.science_outlined,
  );
}

/// A slim notice above the tabs (sandbox mode, paused payments).
class NoticeBanner extends StatelessWidget {
  const NoticeBanner({
    required this.text,
    this.icon = Icons.info_outline_rounded,
    super.key,
  });

  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final xd = context.xd;
    final color = xd.statusWarning;
    return Semantics(
      container: true,
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: Color.alphaBlend(color.withValues(alpha: 0.12), xd.canvas),
          border: Border(bottom: BorderSide(color: xd.hairline)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 15, color: color),
            const SizedBox(width: 7),
            Flexible(
              child: Text(
                text,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelMedium
                    ?.copyWith(color: color, fontSize: 12.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) => Center(
    child: SizedBox.square(
      dimension: 28,
      child: CircularProgressIndicator(
        strokeWidth: 2.6,
        semanticsLabel: AppLocalizations.of(context).loading,
      ),
    ),
  );
}

/// An icon in a soft tinted circle: the illustration for empty, error and
/// outcome states.
class HaloIcon extends StatelessWidget {
  const HaloIcon(this.icon, {this.color, this.size = 88, super.key});

  final IconData icon;

  /// Defaults to the brand orange.
  final Color? color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tint = color ?? AppColors.brandOrange;
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: tint.withValues(alpha: 0.12),
        ),
        alignment: Alignment.center,
        child: Icon(
          icon,
          color: color ?? context.xd.accentText,
          size: size * 0.44,
        ),
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({required this.message, this.onRetry, super.key});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            HaloIcon(Icons.wifi_off_rounded, color: context.xd.statusErrorText),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 20),
              SizedBox(
                width: 180,
                child: OutlinedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded, size: 20),
                  label: Text(AppLocalizations.of(context).retry),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({
    required this.icon,
    required this.message,
    this.title,
    this.action,
    super.key,
  });

  final IconData icon;
  final String message;
  final String? title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            HaloIcon(icon),
            const SizedBox(height: 18),
            if (title != null) ...[
              Text(
                title!,
                textAlign: TextAlign.center,
                style: theme.titleLarge,
              ),
              const SizedBox(height: 6),
            ],
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.bodyMedium?.copyWith(
                color: context.xd.textSecondary,
              ),
            ),
            if (action != null) ...[const SizedBox(height: 22), action!],
          ],
        ),
      ),
    );
  }
}

/// Inline, screen-reader-announced error line.
class InlineError extends StatelessWidget {
  const InlineError(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    final color = context.xd.statusErrorText;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(Icons.error_outline_rounded, size: 18, color: color),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodyMedium
                    ?.copyWith(color: color),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
