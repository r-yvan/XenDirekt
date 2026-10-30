import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';

/// The XenDirekt mark (PRD §9): two interlocking chevrons forming an X.
/// The orange chevron points right (send); the white one points left (receive)
/// on dark backgrounds. Drawn as vectors so it stays crisp at any size and is
/// never stretched or recoloured.
class XdLogo extends StatelessWidget {
  const XdLogo({super.key, this.size = 72, this.semanticLabel = 'XenDirekt'});

  final double size;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticLabel,
      image: true,
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(
          // The receive chevron is white on dark, near-black on light.
          painter: _XdLogoPainter(receive: context.xd.textPrimary),
        ),
      ),
    );
  }
}

class _XdLogoPainter extends CustomPainter {
  const _XdLogoPainter({required this.receive});

  final Color receive;

  // Outline traced from the 480×480 brand mark in the PRD, normalised to 0..1.
  static const _send = [
    Offset(0.254, 0.152),
    Offset(0.542, 0.442),
    Offset(0.167, 0.808),
    Offset(0.358, 0.444),
    Offset(0.254, 0.338),
  ];
  static const _receive = [
    Offset(0.831, 0.188),
    Offset(0.458, 0.558),
    Offset(0.746, 0.846),
    Offset(0.746, 0.663),
    Offset(0.642, 0.558),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    Path pathFor(List<Offset> points) {
      final path = Path()
        ..moveTo(points.first.dx * size.width, points.first.dy * size.height);
      for (final point in points.skip(1)) {
        path.lineTo(point.dx * size.width, point.dy * size.height);
      }
      return path..close();
    }

    canvas
      ..drawPath(pathFor(_send), Paint()..color = AppColors.brandOrange)
      ..drawPath(pathFor(_receive), Paint()..color = receive);
  }

  @override
  bool shouldRepaint(covariant _XdLogoPainter oldDelegate) =>
      oldDelegate.receive != receive;
}
