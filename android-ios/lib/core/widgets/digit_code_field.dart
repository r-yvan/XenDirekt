import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/theme/app_colors.dart';

/// Fixed-length numeric code entry (OTP, PIN). Completes on the last digit
/// with no Submit button (PRD §5.0 rule 3). A single hidden TextField keeps
/// paste, SMS autofill (`oneTimeCode`) and screen readers working.
class DigitCodeField extends StatefulWidget {
  const DigitCodeField({
    required this.length,
    required this.onCompleted,
    required this.semanticLabel,
    this.obscure = false,
    this.autofillOneTimeCode = false,
    this.enabled = true,
    this.errorText,
    this.controller,
    super.key,
  });

  final int length;
  final ValueChanged<String> onCompleted;
  final String semanticLabel;
  final bool obscure;
  final bool autofillOneTimeCode;
  final bool enabled;
  final String? errorText;
  final TextEditingController? controller;

  @override
  State<DigitCodeField> createState() => _DigitCodeFieldState();
}

class _DigitCodeFieldState extends State<DigitCodeField>
    with SingleTickerProviderStateMixin {
  late final TextEditingController _controller =
      widget.controller ?? TextEditingController();
  final FocusNode _focus = FocusNode();

  /// A short horizontal shake when a new error arrives.
  late final AnimationController _shake = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );

  @override
  void didUpdateWidget(DigitCodeField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.errorText != null &&
        widget.errorText != oldWidget.errorText &&
        !(MediaQuery.maybeDisableAnimationsOf(context) ?? false)) {
      HapticFeedback.heavyImpact();
      _shake.forward(from: 0);
    }
  }

  @override
  void initState() {
    super.initState();
    _controller.addListener(_changed);
  }

  @override
  void dispose() {
    _controller.removeListener(_changed);
    if (widget.controller == null) {
      _controller.dispose();
    }
    _focus.dispose();
    _shake.dispose();
    super.dispose();
  }

  void _changed() {
    setState(() {});
    final value = _controller.text;
    if (value.length == widget.length) {
      widget.onCompleted(value);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = _controller.text;
    final hasError = widget.errorText != null;
    final theme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedBuilder(
          animation: _shake,
          builder: (context, child) {
            // Damped shake: three swings that settle back to rest.
            final t = _shake.value;
            final dx = math.sin(t * math.pi * 6) * 10 * (1 - t);
            return Transform.translate(offset: Offset(dx, 0), child: child);
          },
          child: Stack(
            alignment: Alignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var index = 0; index < widget.length; index++)
                    Flexible(
                      child: _box(
                        filled: index < text.length,
                        active: index == text.length && _focus.hasFocus,
                        hasError: hasError,
                        child: index < text.length
                            ? (widget.obscure
                                  ? Container(
                                      width: 12,
                                      height: 12,
                                      decoration: BoxDecoration(
                                        color: context.xd.textPrimary,
                                        shape: BoxShape.circle,
                                      ),
                                    )
                                  : Text(
                                      text[index],
                                      style: theme.headlineMedium?.copyWith(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ))
                            : null,
                      ),
                    ),
                ],
              ),
              Positioned.fill(
                child: Opacity(
                  opacity: 0,
                  child: TextField(
                    controller: _controller,
                    focusNode: _focus,
                    autofocus: true,
                    enabled: widget.enabled,
                    keyboardType: TextInputType.number,
                    maxLength: widget.length,
                    obscureText: widget.obscure,
                    autofillHints: widget.autofillOneTimeCode
                        ? const [AutofillHints.oneTimeCode]
                        : null,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: InputDecoration(
                      counterText: '',
                      labelText: widget.semanticLabel,
                    ),
                    showCursor: false,
                    enableInteractiveSelection: false,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline_rounded,
                  size: 17,
                  color: context.xd.statusErrorText,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    widget.errorText!,
                    textAlign: TextAlign.center,
                    style: theme.bodyMedium?.copyWith(
                      color: context.xd.statusErrorText,
                    ),
                    semanticsLabel: widget.errorText,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _box({
    required bool filled,
    required bool active,
    required bool hasError,
    Widget? child,
  }) {
    final borderColor = hasError
        ? context.xd.statusErrorText
        : active
        ? AppColors.brandOrange
        : filled
        ? context.xd.hairlineStrong
        : context.xd.hairline;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      constraints: const BoxConstraints(maxWidth: 52),
      height: 62,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: filled ? context.xd.surface2 : context.xd.surface1,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(width: active ? 1.6 : 1, color: borderColor),
      ),
      child: ExcludeSemantics(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 140),
          transitionBuilder: (child, animation) =>
              ScaleTransition(scale: animation, child: child),
          child: child ?? const SizedBox.shrink(),
        ),
      ),
    );
  }
}
