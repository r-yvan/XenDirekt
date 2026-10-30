import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';

/// Destructive action that must be held for [duration] (PRD §5.0: only Delete
/// account uses hold-to-confirm). Releasing early cancels.
class HoldToConfirmButton extends StatefulWidget {
  const HoldToConfirmButton({
    required this.label,
    required this.onConfirmed,
    this.duration = const Duration(seconds: 2),
    super.key,
  });

  final String label;
  final VoidCallback onConfirmed;
  final Duration duration;

  @override
  State<HoldToConfirmButton> createState() => _HoldToConfirmButtonState();
}

class _HoldToConfirmButtonState extends State<HoldToConfirmButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progress =
      AnimationController(vsync: this, duration: widget.duration)
        ..addStatusListener((status) {
          if (status == AnimationStatus.completed) {
            _progress.reset();
            widget.onConfirmed();
          }
        });

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      onLongPress: widget.onConfirmed,
      child: GestureDetector(
        onTapDown: (_) => _progress.forward(),
        onTapUp: (_) => _progress.reverse(),
        onTapCancel: _progress.reverse,
        child: AnimatedBuilder(
          animation: _progress,
          builder: (context, _) {
            final error = context.xd.statusErrorText;
            return Container(
              height: 54,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: error),
              ),
              child: Stack(
                children: [
                  // The fill grows while the finger stays down.
                  FractionallySizedBox(
                    widthFactor: _progress.value,
                    heightFactor: 1,
                    child: ColoredBox(color: error.withValues(alpha: 0.16)),
                  ),
                  Center(
                    child: Text(
                      widget.label,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: error,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
