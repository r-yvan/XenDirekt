import 'package:flutter/material.dart';

import '../../../app/theme/app_colors.dart';
import 'motion.dart';

/// Processing → Sent → Received (FR-EXE-04): connectors fill smoothly and the
/// step in progress shows a quiet spinner.
class StepTracker extends StatelessWidget {
  const StepTracker({
    required this.labels,
    required this.done,
    this.failed = false,
    super.key,
  });

  final List<String> labels;
  final List<bool> done;
  final bool failed;

  @override
  Widget build(BuildContext context) {
    final active = done.indexWhere((value) => !value);
    return Semantics(
      label: [
        for (var i = 0; i < labels.length; i++)
          '${labels[i]}: ${done[i] ? '✓' : (i == active ? '…' : '')}',
      ].join(', '),
      excludeSemantics: true,
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++) ...[
            Expanded(
              child: Column(
                children: [
                  _Dot(
                    done: done[i],
                    active: i == active && !failed,
                    failed: failed && i == active,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    labels[i],
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: done[i] || i == active
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: done[i]
                          ? context.xd.textPrimary
                          : context.xd.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            if (i < labels.length - 1)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 26),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: Stack(
                      children: [
                        Container(height: 3, color: context.xd.surface2),
                        AnimatedFractionallySizedBox(
                          duration: Motion.of(context, Motion.slow),
                          curve: Motion.emphasized,
                          widthFactor:
                              done[i + 1] || (done[i] && i + 1 == active)
                              ? (done[i + 1] ? 1 : 0.5)
                              : 0,
                          child: Container(
                            height: 3,
                            color: AppColors.brandOrange,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.done, required this.active, required this.failed});

  final bool done;
  final bool active;
  final bool failed;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: Motion.of(context, Motion.medium),
      curve: Motion.emphasized,
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: failed
            ? context.xd.statusError
            : done
            ? AppColors.brandOrange
            : context.xd.surface2,
        border: Border.all(
          color: active ? AppColors.brandOrange : context.xd.surface3,
          width: 2,
        ),
      ),
      child: AnimatedSwitcher(
        duration: Motion.of(context, Motion.medium),
        child: active
            ? const Padding(
                key: ValueKey('active'),
                padding: EdgeInsets.all(8),
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Icon(
                failed
                    ? Icons.close_rounded
                    : (done ? Icons.check_rounded : Icons.circle),
                key: ValueKey('${failed}_$done'),
                size: done || failed ? 18 : 6,
                color: done || failed
                    ? AppColors.brandBlack
                    : context.xd.textSecondary,
              ),
      ),
    );
  }
}
