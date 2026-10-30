import 'package:flutter/widgets.dart';

import 'motion.dart';

/// Counts smoothly between values so totals feel alive as the quote updates.
class AnimatedAmount extends StatelessWidget {
  const AnimatedAmount({
    required this.value,
    required this.format,
    this.style,
    this.semanticsLabel,
    super.key,
  });

  final int value;
  final String Function(int value) format;
  final TextStyle? style;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticsLabel ?? format(value),
      excludeSemantics: true,
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(end: value.toDouble()),
        duration: Motion.of(context, Motion.slow),
        curve: Motion.emphasized,
        builder: (context, current, _) =>
            Text(format(current.round()), style: style),
      ),
    );
  }
}
