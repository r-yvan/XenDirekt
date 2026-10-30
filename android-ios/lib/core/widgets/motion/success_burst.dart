import 'package:flutter/material.dart';

import '../../../app/theme/app_colors.dart';
import 'motion.dart';

/// The success moment: the disc settles in, the check draws itself and a soft
/// ring fades out. Static check when motion is reduced.
class SuccessBurst extends StatefulWidget {
  const SuccessBurst({
    this.size = 140,
    this.color = AppColors.brandOrange,
    this.icon = Icons.check_rounded,
    super.key,
  });

  final double size;
  final Color color;
  final IconData icon;

  @override
  State<SuccessBurst> createState() => _SuccessBurstState();
}

class _SuccessBurstState extends State<SuccessBurst>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _controller.value = 1;
    } else if (_controller.value == 0) {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: widget.size * 1.8,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final t = _controller.value;
          final pop = Curves.easeOutBack.transform((t / 0.45).clamp(0, 1));
          final draw = Curves.easeOut.transform(
            ((t - 0.25) / 0.45).clamp(0, 1),
          );
          final burst = Curves.easeOutCubic.transform(
            ((t - 0.2) / 0.8).clamp(0, 1),
          );
          return CustomPaint(
            painter: _BurstPainter(
              progress: burst,
              color: widget.color,
              radius: widget.size / 2,
            ),
            child: Center(
              child: Transform.scale(
                scale: pop,
                child: Container(
                  width: widget.size,
                  height: widget.size,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: widget.color,
                  ),
                  child: widget.icon == Icons.check_rounded
                      ? CustomPaint(painter: _CheckPainter(progress: draw))
                      : Icon(
                          widget.icon,
                          color: AppColors.brandBlack,
                          size: widget.size * 0.5,
                        ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _CheckPainter extends CustomPainter {
  _CheckPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.28, size.height * 0.52)
      ..lineTo(size.width * 0.44, size.height * 0.67)
      ..lineTo(size.width * 0.73, size.height * 0.36);
    final metric = path.computeMetrics().first;
    final paint = Paint()
      ..color = AppColors.brandBlack
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.085
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(metric.extractPath(0, metric.length * progress), paint);
  }

  @override
  bool shouldRepaint(covariant _CheckPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

class _BurstPainter extends CustomPainter {
  _BurstPainter({
    required this.progress,
    required this.color,
    required this.radius,
  });

  final double progress;
  final Color color;
  final double radius;

  /// One soft ring that expands and fades: a quiet "done", not fireworks.
  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0 || progress >= 1) {
      return;
    }
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = color.withValues(alpha: 0.45 * (1 - progress));
    canvas.drawCircle(
      size.center(Offset.zero),
      radius * (1 + 0.45 * progress),
      ring,
    );
  }

  @override
  bool shouldRepaint(covariant _BurstPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
