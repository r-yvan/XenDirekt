import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../app/theme/app_colors.dart';
import 'motion.dart';

/// Which onboarding story to tell. Matches the web portal's auth illustrations.
enum AuthIllustrationKind {
  welcome,
  email,
  phone,
  code,
  profile,
  pin,
  biometrics,
}

/// Animated line illustrations for sign-in and onboarding: flat, neutral strokes with brand
/// orange as the only accent. They play a few calm cycles, then rest on their final frame
/// (no endless animation, and widget tests can settle). Reduced motion shows the final frame.
class AuthIllustration extends StatefulWidget {
  const AuthIllustration({
    required this.kind,
    this.size = 180,
    this.progress,
    super.key,
  });

  final AuthIllustrationKind kind;
  final double size;

  /// Optional live value (e.g. PIN digits entered / 6) drawn on top of the loop.
  final double? progress;

  @override
  State<AuthIllustration> createState() => _AuthIllustrationState();
}

class _AuthIllustrationState extends State<AuthIllustration>
    with SingleTickerProviderStateMixin {
  static const _cycles = 3;
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  );
  int _played = 0;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        _played++;
        if (_played < _cycles) {
          _controller.forward(from: 0);
        }
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) {
      return;
    }
    _started = true;
    if (Motion.reduced(context)) {
      _controller.value = 1;
    } else {
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
    final xd = context.xd;
    return ExcludeSemantics(
      child: SizedBox(
        width: widget.size,
        height: widget.size * 0.8,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) => CustomPaint(
            painter: _IllustrationPainter(
              kind: widget.kind,
              t: _controller.value,
              intro: _played == 0,
              progress: widget.progress,
              line: xd.textTertiary,
              ink: xd.textPrimary,
              surface: xd.surface1,
              surfaceAlt: xd.surface2,
            ),
          ),
        ),
      ),
    );
  }
}

class _IllustrationPainter extends CustomPainter {
  _IllustrationPainter({
    required this.kind,
    required this.t,
    required this.intro,
    required this.progress,
    required this.line,
    required this.ink,
    required this.surface,
    required this.surfaceAlt,
  });

  final AuthIllustrationKind kind;
  final double t;
  final bool intro;
  final double? progress;
  final Color line;
  final Color ink;
  final Color surface;
  final Color surfaceAlt;

  static const orange = AppColors.brandOrange;

  /// 0→1 over [a, b] of the cycle, eased.
  double phase(double a, double b) =>
      Curves.easeInOutCubic.transform(((t - a) / (b - a)).clamp(0.0, 1.0));

  /// 0→1→0 bounce over the cycle (for floating motion).
  double get wave => math.sin(t * math.pi);

  Paint stroke(Color color, [double width = 2]) => Paint()
    ..color = color
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;

  Paint fill(Color color) => Paint()..color = color;

  /// Draws `path` up to `amount` of its length (stroke-draw effect).
  void drawPartial(Canvas canvas, Path path, double amount, Paint paint) {
    for (final metric in path.computeMetrics()) {
      canvas.drawPath(metric.extractPath(0, metric.length * amount), paint);
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    // Design space is 320×256, scaled to fit.
    final scale = size.width / 320;
    canvas.save();
    canvas.scale(scale, scale);
    switch (kind) {
      case AuthIllustrationKind.welcome:
        _welcome(canvas);
      case AuthIllustrationKind.email:
        _email(canvas);
      case AuthIllustrationKind.phone:
        _phone(canvas);
      case AuthIllustrationKind.code:
        _code(canvas);
      case AuthIllustrationKind.profile:
        _profile(canvas);
      case AuthIllustrationKind.pin:
        _pin(canvas);
      case AuthIllustrationKind.biometrics:
        _biometrics(canvas);
    }
    canvas.restore();
  }

  RRect rr(double l, double tp, double w, double h, double r) =>
      RRect.fromRectAndRadius(Rect.fromLTWH(l, tp, w, h), Radius.circular(r));

  /// A card on the left sends a dot along an arc to a phone (MoMo wallet) on the right.
  void _welcome(Canvas canvas) {
    canvas.drawRRect(rr(28, 92, 112, 72, 10), fill(const Color(0xFF1A3A8F)));
    canvas.drawRRect(rr(40, 104, 20, 14, 3), fill(Colors.white24));
    _text(
      canvas,
      'VISA',
      const Offset(100, 144),
      Colors.white,
      13,
      italic: true,
    );
    canvas.drawRRect(rr(214, 66, 76, 132, 14), fill(surface));
    canvas.drawRRect(rr(214, 66, 76, 132, 14), stroke(line));
    final arc = Path()
      ..moveTo(140, 110)
      ..quadraticBezierTo(178, 40, 216, 110);
    canvas.drawPath(arc, stroke(line, 1.5)..strokeWidth = 1.5);
    final metric = arc.computeMetrics().first;
    final travel = phase(0.1, 0.6);
    final position = metric
        .getTangentForOffset(metric.length * travel)!
        .position;
    canvas.drawCircle(position, 7, fill(orange));
    final arrived = phase(0.6, 0.75);
    canvas.drawRRect(
      rr(226, 98, 52, 26 * arrived, 8),
      fill(orange.withValues(alpha: 0.18)),
    );
    if (arrived > 0.5) {
      _check(canvas, const Offset(252, 150), 14, phase(0.7, 0.9));
    }
  }

  /// An envelope; a letter carrying six orange code blocks rises out of it.
  void _email(Canvas canvas) {
    final rise = intro ? phase(0.0, 0.5) * 22 : 22 - wave * 6;
    canvas.drawRRect(rr(104, 78 - rise, 112, 84, 10), fill(surface));
    canvas.drawRRect(rr(104, 78 - rise, 112, 84, 10), stroke(line));
    for (var i = 0; i < 6; i++) {
      final on = phase(0.15 + i * 0.07, 0.25 + i * 0.07);
      canvas.drawRRect(
        rr(118 + i * 15.0, 96 - rise, 11, 16, 3),
        fill(orange.withValues(alpha: 0.2 + 0.8 * on)),
      );
    }
    canvas.drawRRect(
      rr(118, 124 - rise, 64, 6, 3),
      fill(line.withValues(alpha: 0.4)),
    );
    final envelope = Path()
      ..moveTo(82, 130)
      ..lineTo(160, 184)
      ..lineTo(238, 130)
      ..lineTo(238, 212)
      ..lineTo(82, 212)
      ..close();
    canvas.drawPath(envelope, fill(surfaceAlt));
    canvas.drawPath(envelope, stroke(line));
    final flaps = Path()
      ..moveTo(82, 212)
      ..lineTo(140, 168)
      ..moveTo(238, 212)
      ..lineTo(180, 168);
    drawPartial(canvas, flaps, phase(0.0, 0.4), stroke(line));
    final pop = Curves.easeOutBack.transform(phase(0.45, 0.7));
    canvas.drawCircle(const Offset(238, 130), 12 * pop, fill(orange));
    // Paper plane on a dashed trail.
    final plane = Offset(250 + wave * 14, 48 - wave * 8);
    final wing = Path()
      ..moveTo(plane.dx - 18, plane.dy + 8)
      ..lineTo(plane.dx + 18, plane.dy - 8)
      ..lineTo(plane.dx + 6, plane.dy + 20)
      ..close();
    canvas.drawPath(wing, fill(surface));
    canvas.drawPath(wing, stroke(orange));
    _dashedArc(canvas, const Offset(30, 74), plane - const Offset(20, -6));
  }

  /// A phone receiving a text bubble.
  void _phone(Canvas canvas) {
    canvas.drawRRect(rr(110, 24, 100, 196, 18), fill(surface));
    canvas.drawRRect(rr(110, 24, 100, 196, 18), stroke(line));
    canvas.drawRRect(
      rr(146, 34, 28, 5, 2.5),
      fill(line.withValues(alpha: 0.4)),
    );
    final bubble = Curves.easeOutBack.transform(phase(0.1, 0.45));
    canvas.save();
    canvas.translate(160, 92);
    canvas.scale(bubble.clamp(0.0, 1.2));
    canvas.drawRRect(rr(-38, -20, 76, 40, 12), fill(orange));
    for (var i = 0; i < 3; i++) {
      final dot = (math.sin((t * 4 - i * 0.25) * math.pi) + 1) / 2;
      canvas.drawCircle(
        Offset(-14.0 + i * 14, 0),
        3.5 + dot * 1.5,
        fill(Colors.black87),
      );
    }
    canvas.restore();
    canvas.drawRRect(
      rr(126, 132, 68, 6, 3),
      fill(line.withValues(alpha: 0.35)),
    );
    canvas.drawRRect(rr(126, 146, 44, 6, 3), fill(line.withValues(alpha: 0.2)));
    _rings(canvas, const Offset(160, 92), 52, phase(0.4, 1));
  }

  /// Six digits fill in, then a shield checks itself.
  void _code(Canvas canvas) {
    canvas.drawRRect(rr(96, 18, 128, 216, 22), fill(surface));
    canvas.drawRRect(rr(96, 18, 128, 216, 22), stroke(line));
    for (var i = 0; i < 6; i++) {
      final x = 110.0 + i * 17;
      canvas.drawRRect(rr(x, 72, 13, 18, 4), stroke(line, 1.5));
      final on = Curves.easeOutBack.transform(
        phase(0.05 + i * 0.07, 0.14 + i * 0.07),
      );
      canvas.drawCircle(Offset(x + 6.5, 81), 3.6 * on, fill(orange));
    }
    final shield = Curves.easeOutBack.transform(phase(0.5, 0.72));
    canvas.save();
    canvas.translate(160, 160);
    canvas.scale(shield);
    final body = Path()
      ..moveTo(0, -30)
      ..lineTo(26, -20)
      ..lineTo(26, 0)
      ..cubicTo(26, 18, 13, 28, 0, 34)
      ..cubicTo(-13, 28, -26, 18, -26, 0)
      ..lineTo(-26, -20)
      ..close();
    canvas.drawPath(body, fill(orange));
    canvas.restore();
    if (shield > 0.8) {
      final tick = Path()
        ..moveTo(148, 160)
        ..lineTo(157, 169)
        ..lineTo(173, 151);
      drawPartial(canvas, tick, phase(0.7, 0.85), stroke(Colors.black, 3.5));
    }
    _rings(canvas, const Offset(160, 160), 42, phase(0.75, 1));
  }

  /// An ID card fills in, then a stamp lands.
  void _profile(Canvas canvas) {
    canvas.drawRRect(rr(50, 58, 220, 136, 16), fill(surface));
    canvas.drawRRect(rr(50, 58, 220, 136, 16), stroke(line));
    final avatar = Path()
      ..addOval(Rect.fromCircle(center: const Offset(102, 128), radius: 26));
    drawPartial(canvas, avatar, phase(0.0, 0.3), stroke(line));
    canvas.drawCircle(
      const Offset(102, 120),
      8 * phase(0.2, 0.35),
      stroke(line),
    );
    for (var i = 0; i < 3; i++) {
      final w = (100.0 - i * 24) * phase(0.25 + i * 0.1, 0.45 + i * 0.1);
      canvas.drawRRect(
        rr(142, 106 + i * 18.0, w, 7, 3.5),
        fill(i == 0 ? ink.withValues(alpha: 0.8) : line.withValues(alpha: 0.4)),
      );
    }
    final stamp = phase(0.55, 0.7);
    if (stamp > 0) {
      canvas.save();
      canvas.translate(236, 176);
      canvas.rotate(-0.22);
      canvas.scale(1 + (1 - stamp) * 0.8);
      final paint = stroke(orange.withValues(alpha: stamp), 3);
      canvas.drawCircle(Offset.zero, 28, paint);
      canvas.drawCircle(
        Offset.zero,
        21,
        stroke(orange.withValues(alpha: stamp), 1.2),
      );
      _text(
        canvas,
        'RW',
        const Offset(0, 5),
        orange.withValues(alpha: stamp),
        13,
      );
      canvas.restore();
    }
  }

  /// A padlock: dots fill (or follow the real PIN progress), then the shackle closes.
  void _pin(Canvas canvas) {
    final live = progress;
    final filled = live ?? phase(0.0, 0.6);
    final closed = live == null ? phase(0.6, 0.8) : (live >= 1 ? 1.0 : 0.0);
    final shackle = Path()
      ..moveTo(118, 112 - 14 * (1 - closed))
      ..lineTo(118, 86 - 14 * (1 - closed))
      ..cubicTo(
        118,
        50 - 14 * (1 - closed),
        202,
        50 - 14 * (1 - closed),
        202,
        86 - 14 * (1 - closed),
      )
      ..lineTo(202, 112);
    canvas.drawPath(shackle, stroke(line, 10));
    canvas.drawRRect(rr(96, 106, 128, 104, 20), fill(surface));
    canvas.drawRRect(rr(96, 106, 128, 104, 20), stroke(line));
    for (var i = 0; i < 6; i++) {
      final on = filled * 6 > i;
      final center = Offset(117.0 + i * 17, 158);
      canvas.drawCircle(center, 5, on ? fill(orange) : stroke(line, 1.5));
    }
    _rings(
      canvas,
      const Offset(160, 158),
      70,
      closed > 0.9 ? phase(0.8, 1) : 0,
    );
  }

  /// A fingerprint traced line by line, with a scan bar.
  void _biometrics(Canvas canvas) {
    const center = Offset(160, 124);
    for (var i = 0; i < 6; i++) {
      final radius = 18.0 + i * 13;
      final path = Path()
        ..addArc(
          Rect.fromCircle(center: center, radius: radius),
          math.pi * (0.95 + i * 0.03),
          math.pi * (1.1 - i * 0.05),
        );
      drawPartial(
        canvas,
        path,
        phase(i * 0.08, 0.4 + i * 0.08),
        stroke(i.isEven ? line : orange, 3),
      );
    }
    final scan = 52 + 140 * phase(0.2, 0.9);
    canvas.drawRRect(
      rr(84, scan, 152, 3, 1.5),
      fill(orange.withValues(alpha: 0.85)),
    );
    canvas.drawRRect(
      rr(84, scan - 12, 152, 12, 4),
      fill(orange.withValues(alpha: 0.08)),
    );
  }

  void _check(Canvas canvas, Offset at, double r, double amount) {
    canvas.drawCircle(at, r, fill(orange));
    final tick = Path()
      ..moveTo(at.dx - r * 0.45, at.dy)
      ..lineTo(at.dx - r * 0.1, at.dy + r * 0.35)
      ..lineTo(at.dx + r * 0.5, at.dy - r * 0.35);
    drawPartial(canvas, tick, amount, stroke(Colors.black, 2.6));
  }

  void _rings(Canvas canvas, Offset center, double radius, double amount) {
    if (amount <= 0 || amount >= 1) {
      return;
    }
    canvas.drawCircle(
      center,
      radius * (1 + 0.4 * amount),
      stroke(orange.withValues(alpha: 0.45 * (1 - amount)), 1.5),
    );
  }

  void _dashedArc(Canvas canvas, Offset from, Offset to) {
    final path = Path()
      ..moveTo(from.dx, from.dy)
      ..quadraticBezierTo((from.dx + to.dx) / 2, from.dy - 50, to.dx, to.dy);
    final paint = stroke(line, 1.5);
    for (final metric in path.computeMetrics()) {
      for (double d = 0; d < metric.length; d += 10) {
        canvas.drawPath(
          metric.extractPath(d, math.min(d + 4, metric.length)),
          paint,
        );
      }
    }
  }

  void _text(
    Canvas canvas,
    String value,
    Offset center,
    Color color,
    double size, {
    bool italic = false,
  }) {
    final painter = TextPainter(
      text: TextSpan(
        text: value,
        style: TextStyle(
          color: color,
          fontSize: size,
          fontWeight: FontWeight.w900,
          fontStyle: italic ? FontStyle.italic : FontStyle.normal,
          letterSpacing: 0,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, center - Offset(painter.width / 2, painter.height));
  }

  @override
  bool shouldRepaint(covariant _IllustrationPainter old) =>
      old.t != t ||
      old.progress != progress ||
      old.kind != kind ||
      old.line != line ||
      old.surface != surface;
}
