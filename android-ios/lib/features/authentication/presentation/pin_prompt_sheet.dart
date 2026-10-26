import 'package:flutter/material.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/digit_code_field.dart';

/// Bottom sheet asking for the PIN; [submit] verifies it on the server. Wrong
/// PINs keep the sheet open with the server's message (attempts left / locked).
Future<T?> showPinPromptSheet<T>(
  BuildContext context, {
  required String title,
  required Future<T> Function(String pin) submit,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _PinPromptSheet<T>(title: title, submit: submit),
  );
}

class _PinPromptSheet<T> extends StatefulWidget {
  const _PinPromptSheet({required this.title, required this.submit, super.key});

  final String title;
  final Future<T> Function(String pin) submit;

  @override
  State<_PinPromptSheet<T>> createState() => _PinPromptSheetState<T>();
}

class _PinPromptSheetState<T> extends State<_PinPromptSheet<T>> {
  final _controller = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _completed(String pin) async {
    if (_busy) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await widget.submit(pin);
      if (mounted) {
        Navigator.of(context).pop(result);
      }
    } on ApiFailure catch (failure) {
      if (!mounted) {
        return;
      }
      setState(() {
        _busy = false;
        _error = messageForFailure(AppLocalizations.of(context), failure);
        _controller.clear();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        8,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            widget.title,
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          DigitCodeField(
            length: 6,
            obscure: true,
            controller: _controller,
            enabled: !_busy,
            semanticLabel: l10n.pinFieldLabel,
            errorText: _error,
            onCompleted: _completed,
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: _busy ? null : () => Navigator.of(context).pop(),
            child: Text(l10n.cancel),
          ),
        ],
      ),
    );
  }
}
