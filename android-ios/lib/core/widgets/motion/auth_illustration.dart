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
/// orange as the only accent. They loop calmly with a short rest on the final frame between
/// cycles. Widget tests play a few cycles and stop, so `pumpAndSettle` can settle. Reduced
/// motion shows the final frame.
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
  /// Cycles to play under the widget-test binding; the app loops indefinitely.
  static const _testCycles = 3;
  static const _rest = Duration(milliseconds: 900);
  static final bool _underTest = WidgetsBinding.instance.runtimeType
      .toString()
      .contains('TestWidgetsFlutterBinding');
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
        if (_underTest) {
          if (_played < _testCycles) {
            _controller.forward(from: 0);
          }
          return;
        }
        // A hidden route mutes this ticker, so the loop pauses by itself there.
        Future<void>.delayed(_rest, () {
          if (mounted) {
            _controller.forward(from: 0);
          }
        });
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

  /// An orange card taps a phone (contactless waves); the phone confirms the MoMo payment
  /// with a check, an amount and a receipt, while a shop badge floats and sparkles pop.
  void _welcome(Canvas canvas) {
    // Soft accent disc behind the scene (flat tint, no gradient).
    canvas.drawCircle(
      const Offset(176, 128),
      104,
      fill(orange.withValues(alpha: 0.08)),
    );
    canvas.drawCircle(
      const Offset(176, 128),
      78,
      fill(orange.withValues(alpha: 0.06)),
    );

    // Phone.
    canvas.drawRRect(rr(150, 22, 104, 208, 22), fill(surface));
    canvas.drawRRect(rr(150, 22, 104, 208, 22), stroke(line));
    canvas.drawRRect(rr(188, 32, 28, 6, 3), fill(line.withValues(alpha: 0.4)));
    // Success check pops, then the amount and receipt lines write in.
    final pop = Curves.easeOutBack.transform(phase(0.42, 0.6));
    canvas.save();
    canvas.translate(202, 82);
    canvas.scale(pop);
    canvas.drawCircle(Offset.zero, 21, fill(orange));
    canvas.restore();
    if (pop > 0.6) {
      final tick = Path()
        ..moveTo(193, 82)
        ..lineTo(199.5, 88.5)
        ..lineTo(212, 76);
      drawPartial(canvas, tick, phase(0.52, 0.66), stroke(Colors.black, 3.2));
    }
    _rings(canvas, const Offset(202, 82), 24, phase(0.55, 0.95));
    final amount = phase(0.58, 0.72);
    _text(
      canvas,
      'RWF 5,000',
      Offset(202, 132 + 6 * (1 - amount)),
      ink.withValues(alpha: amount),
      17,
    );
    canvas.drawRRect(
      rr(170, 146, 64 * phase(0.62, 0.78), 6, 3),
      fill(line.withValues(alpha: 0.35)),
    );
    canvas.drawRRect(
      rr(182, 160, 40 * phase(0.68, 0.84), 6, 3),
      fill(line.withValues(alpha: 0.22)),
    );
    canvas.drawRRect(
      rr(166, 190, 72, 22, 11),
      fill(orange.withValues(alpha: 0.15 + 0.85 * phase(0.72, 0.86))),
    );

    // Contactless waves from the card towards the phone.
    for (var i = 0; i < 3; i++) {
      final w = phase(0.18 + i * 0.07, 0.36 + i * 0.07);
      final fade = 1 - phase(0.5 + i * 0.05, 0.7 + i * 0.05);
      if (w <= 0 || fade <= 0) {
        continue;
      }
      final arc = Path()
        ..addArc(
          Rect.fromCircle(center: const Offset(118, 98), radius: 12.0 + i * 9),
          -math.pi * 0.42,
          math.pi * 0.42,
        );
      drawPartial(canvas, arc, w, stroke(orange.withValues(alpha: fade), 3));
    }

    // The card: slides in on the first play, then taps towards the phone each cycle.
    final slide = intro ? 1 - phase(0.0, 0.28) : 0.0;
    final tap = math.sin(math.pi * phase(0.12, 0.34)) * 8;
    canvas.save();
    canvas.translate(92 - 70 * slide + tap, 156 - tap * 0.4);
    canvas.rotate(-0.2 + 0.12 * slide);
    final cardPaint = fill(orange.withValues(alpha: 1 - slide));
    canvas.drawRRect(rr(-64, -40, 128, 80, 12), cardPaint);
    canvas.drawRRect(
      rr(-50, -24, 22, 16, 4),
      fill(Colors.white.withValues(alpha: 0.85 * (1 - slide))),
    );
    for (var g = 0; g < 4; g++) {
      canvas.drawRRect(
        rr(-50 + g * 26.0, 8, 20, 5, 2.5),
        fill(Colors.white.withValues(alpha: 0.6 * (1 - slide))),
      );
    }
    for (var i = 0; i < 3; i++) {
      canvas.drawArc(
        Rect.fromCircle(center: const Offset(36, -16), radius: 4.0 + i * 4),
        -math.pi * 0.3,
        math.pi * 0.6,
        false,
        stroke(Colors.white.withValues(alpha: 0.8 * (1 - slide)), 1.8),
      );
    }
    canvas.drawCircle(
      const Offset(-42, 26),
      7,
      fill(Colors.white.withValues(alpha: 0.35 * (1 - slide))),
    );
    canvas.drawCircle(
      const Offset(-32, 26),
      7,
      fill(Colors.white.withValues(alpha: 0.55 * (1 - slide))),
    );
    canvas.restore();

    // Floating shop badge (the MoMo merchant).
    final bob = wave * 5;
    final badge = Offset(280, 60 - bob);
    canvas.drawCircle(badge, 22, fill(surface));
    canvas.drawCircle(badge, 22, stroke(orange, 2));
    final shop = Path()
      ..moveTo(badge.dx - 11, badge.dy - 3)
      ..lineTo(badge.dx - 9, badge.dy - 10)
      ..lineTo(badge.dx + 9, badge.dy - 10)
      ..lineTo(badge.dx + 11, badge.dy - 3)
      ..moveTo(badge.dx - 9, badge.dy - 3)
      ..lineTo(badge.dx - 9, badge.dy + 10)
      ..lineTo(badge.dx + 9, badge.dy + 10)
      ..lineTo(badge.dx + 9, badge.dy - 3)
      ..moveTo(badge.dx - 3, badge.dy + 10)
      ..lineTo(badge.dx - 3, badge.dy + 3)
      ..lineTo(badge.dx + 3, badge.dy + 3)
      ..lineTo(badge.dx + 3, badge.dy + 10);
    canvas.drawPath(shop, stroke(orange, 2));
    canvas.drawRRect(rr(badge.dx - 11, badge.dy - 4, 22, 4, 2), fill(orange));

    // Sparkles once the payment lands.
    final sparkle = math.sin(math.pi * phase(0.66, 1.0));
    for (final (at, r) in const [
      (Offset(132, 44), 7.0),
      (Offset(296, 152), 6.0),
      (Offset(48, 84), 5.0),
    ]) {
      _sparkle(canvas, at, r * sparkle);
    }
  }

  void _sparkle(Canvas canvas, Offset at, double r) {
    if (r <= 0.2) {
      return;
    }
    final star = Path()
      ..moveTo(at.dx, at.dy - r)
      ..quadraticBezierTo(at.dx, at.dy, at.dx + r, at.dy)
      ..quadraticBezierTo(at.dx, at.dy, at.dx, at.dy + r)
      ..quadraticBezierTo(at.dx, at.dy, at.dx - r, at.dy)
      ..quadraticBezierTo(at.dx, at.dy, at.dx, at.dy - r)
      ..close();
    canvas.drawPath(star, fill(orange));
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
          fontFamily: 'Satoshi',
          fontWeight: FontWeight.w700,
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
