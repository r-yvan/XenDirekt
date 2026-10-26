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

class _DigitCodeFieldState extends State<DigitCodeField> {
  late final TextEditingController _controller =
      widget.controller ?? TextEditingController();
  final FocusNode _focus = FocusNode();

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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Stack(
          alignment: Alignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var index = 0; index < widget.length; index++)
                  Container(
                    width: 44,
                    height: 56,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.surface1,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        width: 2,
                        color: hasError
                            ? AppColors.statusErrorText
                            : index == text.length && _focus.hasFocus
                            ? AppColors.brandOrange
                            : AppColors.surface1,
                      ),
                    ),
                    child: ExcludeSemantics(
                      child: Text(
                        index < text.length
                            ? (widget.obscure ? '•' : text[index])
                            : '',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
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
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              widget.errorText!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.statusErrorText),
              semanticsLabel: widget.errorText,
            ),
          ),
      ],
    );
  }
}
