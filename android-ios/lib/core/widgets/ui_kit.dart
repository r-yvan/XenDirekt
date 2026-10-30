import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';

/// The app's surface: a flat card with a thin edge, on the page background.
class XdCard extends StatelessWidget {
  const XdCard({
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.color,
    this.borderColor,
    this.radius = 16,
    this.semanticLabel,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  /// Defaults to the theme's card surface.
  final Color? color;

  /// Defaults to the theme's hairline.
  final Color? borderColor;
  final double radius;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final xd = context.xd;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radius),
      side: BorderSide(color: borderColor ?? xd.hairline),
    );
    final content = Padding(padding: padding, child: child);
    return Semantics(
      button: onTap != null,
      label: semanticLabel,
      child: Material(
        color: color ?? xd.surface1,
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: onTap == null ? content : InkWell(onTap: onTap, child: content),
      ),
    );
  }
}

/// A tinted rounded square holding an icon: gives lists colour and rhythm.
class IconBadge extends StatelessWidget {
  const IconBadge(this.icon, {this.color, this.size = 40, super.key});

  final IconData icon;

  /// Defaults to the brand orange.
  final Color? color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tint = color ?? AppColors.brandOrange;
    final iconColor = color ?? context.xd.accentText;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      alignment: Alignment.center,
      child: Icon(icon, color: iconColor, size: size * 0.5),
    );
  }
}

/// Small heading above a group of content, with an optional action on the right.
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {this.action, this.padding, super.key});

  final String text;
  final Widget? action;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ?? const EdgeInsets.fromLTRB(4, 0, 4, 8),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              header: true,
              child: Text(
                text,
                style: Theme.of(context).textTheme.labelMedium
                    ?.copyWith(color: context.xd.textSecondary),
              ),
            ),
          ),
          ?action,
        ],
      ),
    );
  }
}

/// Rows grouped in one card, separated by inset hairlines (settings style).
class SettingsGroup extends StatelessWidget {
  const SettingsGroup({required this.children, super.key});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return XdCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (final (index, child) in children.indexed) ...[
            if (index > 0) const Divider(indent: 66, height: 1),
            child,
          ],
        ],
      ),
    );
  }
}

class SettingsRow extends StatelessWidget {
  const SettingsRow({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.iconColor,
    this.destructive = false,
    this.showChevron = true,
    super.key,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  /// Defaults to the brand orange.
  final Color? iconColor;
  final bool destructive;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final xd = context.xd;
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 60),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
            child: Row(
              children: [
                IconBadge(
                  icon,
                  size: 38,
                  color: destructive ? xd.statusErrorText : iconColor,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        style: theme.bodyLarge?.copyWith(
                          color: destructive
                              ? xd.statusErrorText
                              : xd.textPrimary,
                        ),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 1),
                        Text(
                          subtitle!,
                          style: theme.bodySmall?.copyWith(
                            color: xd.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (trailing != null) ...[const SizedBox(width: 10), trailing!],
                if (trailing == null && showChevron && onTap != null)
                  Icon(Icons.chevron_right_rounded, color: xd.textTertiary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A circle with initials: orange-tinted for the user, neutral for others.
class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar({
    required this.name,
    this.size = 48,
    this.muted = false,
    super.key,
  });

  final String name;
  final double size;

  /// Neutral (grey) instead of brand orange, for other people (payees).
  final bool muted;

  static String initialsOf(String name) {
    final parts = name
        .replaceFirst('SANDBOX ', '')
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty);
    final letters = parts.take(2).map((part) => part[0]).join().toUpperCase();
    return letters.isEmpty ? '?' : letters;
  }

  @override
  Widget build(BuildContext context) {
    final xd = context.xd;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: muted
            ? xd.surface2
            : AppColors.brandOrange.withValues(alpha: 0.14),
      ),
      alignment: Alignment.center,
      child: Text(
        initialsOf(name),
        style: TextStyle(
          color: muted ? xd.textPrimary : xd.accentText,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.36,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

/// Large screen title with an optional subtitle and trailing actions.
class PageHeader extends StatelessWidget {
  const PageHeader({
    required this.title,
    this.subtitle,
    this.trailing,
    this.eyebrow,
    super.key,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  /// Small line above the title (e.g. a greeting).
  final String? eyebrow;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final xd = context.xd;
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (eyebrow != null) ...[
                  Text(
                    eyebrow!,
                    style: theme.bodyMedium?.copyWith(color: xd.textSecondary),
                  ),
                  const SizedBox(height: 2),
                ],
                Semantics(
                  header: true,
                  child: Text(title, style: theme.headlineLarge),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle!,
                    style: theme.bodyMedium?.copyWith(color: xd.textSecondary),
                  ),
                ],
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

enum PillTone { neutral, success, warning, error, info, brand }

/// Compact status pill with a leading dot.
class TagPill extends StatelessWidget {
  const TagPill(
    this.label, {
    this.tone = PillTone.neutral,
    this.icon,
    this.dot = true,
    super.key,
  });

  final String label;
  final PillTone tone;
  final IconData? icon;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    final xd = context.xd;
    final color = switch (tone) {
      PillTone.neutral => xd.textSecondary,
      PillTone.success => xd.statusSuccessText,
      PillTone.warning => xd.statusWarning,
      PillTone.error => xd.statusErrorText,
      PillTone.info => xd.statusInfo,
      PillTone.brand => xd.accentText,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 5),
          ] else if (dot) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium
                  ?.copyWith(color: color, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

/// A small brand-coloured card glyph for card rows and pickers.
class MiniCardArt extends StatelessWidget {
  const MiniCardArt({required this.brand, this.width = 46, super.key});

  final String brand;
  final double width;

  @override
  Widget build(BuildContext context) {
    final color = switch (brand) {
      'VISA' => const Color(0xFF1A3A8F),
      'MASTERCARD' => const Color(0xFF222226),
      _ => context.xd.surface3,
    };
    return Container(
      width: width,
      height: width * 0.66,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        color: color,
      ),
      alignment: Alignment.bottomRight,
      padding: const EdgeInsets.all(4),
      child: brand == 'MASTERCARD'
          ? SizedBox(
              width: 18,
              height: 11,
              child: Stack(
                children: [
                  Positioned(left: 0, child: _dot(const Color(0xFFEB001B))),
                  Positioned(right: 0, child: _dot(const Color(0xFFF79E1B))),
                ],
              ),
            )
          : Text(
              brand == 'VISA' ? 'VISA' : '',
              style: const TextStyle(
                color: AppColors.brandWhite,
                fontSize: 8,
                fontWeight: FontWeight.w900,
                fontStyle: FontStyle.italic,
                letterSpacing: 0,
              ),
            ),
    );
  }

  Widget _dot(Color color) => Container(
    width: 11,
    height: 11,
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.9),
      shape: BoxShape.circle,
    ),
  );
}

/// The flag emoji for an ISO 3166-1 alpha-2 code ('CA' → 🇨🇦).
String flagEmoji(String countryCode) {
  final code = countryCode.toUpperCase();
  if (code.length != 2) {
    return '';
  }
  return String.fromCharCodes(
    code.codeUnits.map((unit) => 0x1F1E6 + unit - 0x41),
  );
}

/// A tappable form field that opens a picker: leading icon, small label,
/// the chosen value and a chevron. Matches the text inputs.
class SelectField extends StatelessWidget {
  const SelectField({
    required this.label,
    required this.icon,
    required this.onTap,
    this.value,
    this.leading,
    super.key,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final String? value;

  /// Replaces the icon when a value is chosen (e.g. a country flag).
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final xd = context.xd;
    final hasValue = value != null;
    return Semantics(
      button: true,
      label: '$label ${value ?? ''}',
      excludeSemantics: true,
      child: Material(
        color: xd.surface1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: xd.hairlineStrong),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(minHeight: 60),
            padding: const EdgeInsets.fromLTRB(16, 10, 12, 10),
            child: Row(
              children: [
                SizedBox(
                  width: 28,
                  child: hasValue && leading != null
                      ? leading
                      : Icon(icon, color: xd.textTertiary, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        label,
                        style: hasValue
                            ? theme.labelMedium?.copyWith(
                                color: xd.textSecondary,
                              )
                            : theme.bodyLarge?.copyWith(
                                color: xd.textSecondary,
                              ),
                      ),
                      if (hasValue) ...[
                        const SizedBox(height: 3),
                        Text(value!, style: theme.titleMedium),
                      ],
                    ],
                  ),
                ),
                Icon(Icons.keyboard_arrow_down_rounded, color: xd.textTertiary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Thin segmented progress for multi-step onboarding.
class StepProgress extends StatelessWidget {
  const StepProgress({required this.current, required this.total, super.key});

  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var step = 1; step <= total; step++) ...[
          if (step > 1) const SizedBox(width: 6),
          Expanded(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 320),
              height: 4,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                color: step <= current
                    ? AppColors.brandOrange
                    : context.xd.surface3,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// A dashed hairline, for receipt-style separators.
class DashedDivider extends StatelessWidget {
  const DashedDivider({this.color, super.key});

  final Color? color;

  @override
  Widget build(BuildContext context) {
    final dashColor = color ?? context.xd.hairlineStrong;
    return LayoutBuilder(
      builder: (context, constraints) {
        const dash = 6.0;
        const gap = 5.0;
        final count = (constraints.maxWidth / (dash + gap)).floor();
        return Row(
          children: [
            for (var i = 0; i < count; i++) ...[
              Container(width: dash, height: 1, color: dashColor),
              if (i < count - 1) const SizedBox(width: gap),
            ],
          ],
        );
      },
    );
  }
}
