import 'package:flutter/material.dart';

import '../../../app/theme/app_colors.dart';
import 'motion.dart';

/// Skeleton placeholder with a moving highlight; static when motion is reduced.
class Shimmer extends StatefulWidget {
  const Shimmer({required this.child, super.key});

  final Widget child;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _controller.stop();
    } else if (!_controller.isAnimating) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) {
          final x = _controller.value * 2 - 0.5;
          return LinearGradient(
            colors: [
              context.xd.surface2,
              context.xd.surface3,
              context.xd.surface2,
            ],
            stops: [
              x - 0.3,
              x,
              x + 0.3,
            ].map((stop) => stop.clamp(0.0, 1.0)).toList(),
          ).createShader(bounds);
        },
        child: child,
      ),
    );
  }
}

class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    this.width,
    this.height = 16,
    this.radius = 10,
    super.key,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) => Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: context.xd.surface2,
      borderRadius: BorderRadius.circular(radius),
    ),
  );
}
