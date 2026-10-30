import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Brand constants from PRD §9, the same in light and dark mode. Orange is the
/// single accent for primary actions; orange buttons carry black text, and
/// bright orange is never body text on a light background.
abstract final class AppColors {
  static const Color brandOrange = Color(0xFFFF640A);
  static const Color brandBlack = Color(0xFF000000);
  static const Color brandWhite = Color(0xFFFFFFFF);
}

/// Semantic colours for the current brightness. Read them with `context.xd`.
/// Every text/background pair is held to WCAG AA by `theme_contrast_test.dart`.
@immutable
class XdColors extends ThemeExtension<XdColors> {
  const XdColors({
    required this.canvas,
    required this.surface1,
    required this.surface2,
    required this.surface3,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.hairline,
    required this.hairlineStrong,
    required this.accentText,
    required this.statusSuccess,
    required this.statusSuccessText,
    required this.statusWarning,
    required this.statusError,
    required this.statusErrorText,
    required this.statusInfo,
  });

  /// Page background.
  final Color canvas;

  /// Cards and grouped lists.
  final Color surface1;

  /// Inputs, sheets and raised elements.
  final Color surface2;

  /// Pressed and selected states, skeletons.
  final Color surface3;

  final Color textPrimary;
  final Color textSecondary;

  /// Hints and captions (still ≥ 4.5:1 on canvas, surface1 and surface2).
  final Color textTertiary;

  /// 1px separators.
  final Color hairline;
  final Color hairlineStrong;

  /// Orange as *text* (links, amounts, labels). Bright brand orange in dark
  /// mode; a deeper orange in light mode, where #FF640A only reaches ~3:1.
  final Color accentText;

  /// Filled status shapes (chips with black text, icons).
  final Color statusSuccess;
  final Color statusError;

  /// Status colours safe for text on this mode's surfaces.
  final Color statusSuccessText;
  final Color statusWarning;
  final Color statusErrorText;
  final Color statusInfo;

  static const XdColors dark = XdColors(
    canvas: Color(0xFF0A0A0B),
    surface1: Color(0xFF141416),
    surface2: Color(0xFF1C1C1F),
    surface3: Color(0xFF26262A),
    textPrimary: Color(0xFFF4F4F5),
    textSecondary: Color(0xFFA1A1AA),
    textTertiary: Color(0xFF8B8B94),
    hairline: Color(0x14FFFFFF),
    hairlineStrong: Color(0x24FFFFFF),
    accentText: AppColors.brandOrange,
    statusSuccess: Color(0xFF22A559),
    statusSuccessText: Color(0xFF34C26E),
    statusWarning: Color(0xFFF5B83D),
    statusError: Color(0xFFE5484D),
    // The PRD's #E5484D is too dark for text on raised dark surfaces.
    statusErrorText: Color(0xFFFF6369),
    statusInfo: Color(0xFF6E9BFF),
  );

  static const XdColors light = XdColors(
    canvas: Color(0xFFF4F4F6),
    surface1: Color(0xFFFFFFFF),
    surface2: Color(0xFFEFEFF2),
    surface3: Color(0xFFE5E5EA),
    textPrimary: Color(0xFF111113),
    textSecondary: Color(0xFF55555F),
    textTertiary: Color(0xFF6B6B75),
    hairline: Color(0x14000000),
    hairlineStrong: Color(0x24000000),
    accentText: Color(0xFFB94500),
    statusSuccess: Color(0xFF22A559),
    statusSuccessText: Color(0xFF15803D),
    statusWarning: Color(0xFFA15C07),
    statusError: Color(0xFFE5484D),
    statusErrorText: Color(0xFFC8231B),
    statusInfo: Color(0xFF2457D6),
  );

  @override
  XdColors copyWith() => this;

  @override
  XdColors lerp(XdColors? other, double t) {
    if (other == null) {
      return this;
    }
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    return XdColors(
      canvas: mix(canvas, other.canvas),
      surface1: mix(surface1, other.surface1),
      surface2: mix(surface2, other.surface2),
      surface3: mix(surface3, other.surface3),
      textPrimary: mix(textPrimary, other.textPrimary),
      textSecondary: mix(textSecondary, other.textSecondary),
      textTertiary: mix(textTertiary, other.textTertiary),
      hairline: mix(hairline, other.hairline),
      hairlineStrong: mix(hairlineStrong, other.hairlineStrong),
      accentText: mix(accentText, other.accentText),
      statusSuccess: mix(statusSuccess, other.statusSuccess),
      statusSuccessText: mix(statusSuccessText, other.statusSuccessText),
      statusWarning: mix(statusWarning, other.statusWarning),
      statusError: mix(statusError, other.statusError),
      statusErrorText: mix(statusErrorText, other.statusErrorText),
      statusInfo: mix(statusInfo, other.statusInfo),
    );
  }
}

extension XdColorsContext on BuildContext {
  /// The semantic colours of the current theme (light or dark).
  XdColors get xd => Theme.of(this).extension<XdColors>() ?? XdColors.dark;
}

/// WCAG 2.x contrast ratio, used by tests to hold NFR-QA-02 (≥ 4.5:1).
double contrastRatio(Color a, Color b) {
  double channel(double value) => value <= 0.03928
      ? value / 12.92
      : math.pow((value + 0.055) / 1.055, 2.4).toDouble();
  double luminance(Color color) =>
      0.2126 * channel(color.r) +
      0.7152 * channel(color.g) +
      0.0722 * channel(color.b);
  final la = luminance(a);
  final lb = luminance(b);
  final lighter = math.max(la, lb);
  final darker = math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
