import 'dart:math' as math;

import 'package:flutter/painting.dart';

/// Brand tokens from PRD §9. Orange is the single accent for primary actions;
/// orange buttons carry black text, and orange is never body text on white.
abstract final class AppColors {
  static const Color brandOrange = Color(0xFFFF640A);
  static const Color brandBlack = Color(0xFF000000);
  static const Color brandWhite = Color(0xFFFFFFFF);
  static const Color surface1 = Color(0xFF1E1E1E);
  static const Color surface2 = Color(0xFF2A2A2A);
  static const Color textSecondary = Color(0xFFA0A0A0);
  static const Color statusSuccess = Color(0xFF22A559);

  /// Filled error states (chips, icons) with black text.
  static const Color statusError = Color(0xFFE5484D);

  /// Error *text* on dark surfaces. The PRD's proposed #E5484D reaches only
  /// ~4.27:1 on surface-1, below NFR-QA-02; this tone reaches ~5.75:1.
  static const Color statusErrorText = Color(0xFFFF6369);
  static const Color statusWarning = Color(0xFFF5B83D);
  static const Color divider = Color(0xFF333333);
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
