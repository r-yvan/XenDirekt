import 'package:flutter/widgets.dart';

/// Shared motion language: quick, springy, never in the way.
abstract final class Motion {
  static const fast = Duration(milliseconds: 160);
  static const medium = Duration(milliseconds: 320);
  static const slow = Duration(milliseconds: 600);
  static const emphasized = Curves.easeOutCubic;
  static const spring = Curves.easeOutBack;

  /// Users who reduce motion get instant, static UI (NFR-QA-02).
  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  static Duration of(BuildContext context, Duration duration) =>
      reduced(context) ? Duration.zero : duration;
}
