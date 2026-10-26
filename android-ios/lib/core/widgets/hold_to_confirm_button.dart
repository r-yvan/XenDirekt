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
          builder: (context, _) => Container(
            height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.statusError),
              gradient: LinearGradient(
                colors: const [AppColors.statusError, AppColors.brandBlack],
                stops: [_progress.value, _progress.value],
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              widget.label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: _progress.value > 0.5
                    ? AppColors.brandBlack
                    : AppColors.statusErrorText,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
