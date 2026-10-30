import 'dart:async';

import 'package:flutter/widgets.dart';

import 'motion.dart';

/// Fades and slides its child in once, after [delay]. Use [stagger] for lists.
class FadeSlideIn extends StatefulWidget {
  const FadeSlideIn({
    required this.child,
    this.delay = Duration.zero,
    this.offset = const Offset(0, 0.08),
    this.duration = Motion.medium,
    super.key,
  });

  /// Index-based delay for list entrances (capped so long lists don't drag).
  factory FadeSlideIn.stagger({
    required int index,
    required Widget child,
    Key? key,
  }) => FadeSlideIn(
    key: key,
    delay: Duration(milliseconds: 45 * (index > 8 ? 8 : index)),
    child: child,
  );

  final Widget child;
  final Duration delay;
  final Offset offset;
  final Duration duration;

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );
  late final Animation<double> _curve = CurvedAnimation(
    parent: _controller,
    curve: Motion.emphasized,
  );
  Timer? _timer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_controller.isAnimating || _controller.isCompleted) {
      return;
    }
    if (Motion.reduced(context)) {
      _controller.value = 1;
    } else {
      _timer = Timer(widget.delay, () {
        if (mounted) {
          _controller.forward();
        }
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _curve,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: widget.offset,
          end: Offset.zero,
        ).animate(_curve),
        child: widget.child,
      ),
    );
  }
}
