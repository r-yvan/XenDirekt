import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/security/screen_security.dart';
import '../../../core/widgets/digit_code_field.dart';
import '../../../core/widgets/motion/auth_illustration.dart';
import '../application/session_controller.dart';
import 'auth_layout.dart';

/// Fixed 6-digit PIN, entered twice; saves itself on the last digit (FR-ONB-04).
class PinSetupScreen extends ConsumerStatefulWidget {
  const PinSetupScreen({super.key});

  @override
  ConsumerState<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends ConsumerState<PinSetupScreen> {
  final _controller = TextEditingController();
  String? _first;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _completed(String pin) async {
    final l10n = AppLocalizations.of(context);
    if (_first == null) {
      setState(() {
        _first = pin;
        _error = null;
        _controller.clear();
      });
      return;
    }
    if (pin != _first) {
      setState(() {
        _first = null;
        _error = l10n.pinMismatch;
        _controller.clear();
      });
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(authApiProvider).setPin(pin);
      await ref.read(sessionControllerProvider.notifier).reloadProfile();
    } on ApiFailure catch (failure) {
      if (mounted) {
        setState(() {
          _first = null;
          _busy = false;
          _error = failure.code == 'VALIDATION_FAILED'
              ? (failure.message ?? l10n.errorGeneric)
              : messageForFailure(l10n, failure);
          _controller.clear();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SecureScreen(
      child: AuthLayout(
        step: 3,
        illustration: AuthIllustrationKind.pin,
        illustrationProgress: _first == null ? null : 1,
        title: _first == null ? l10n.pinCreateTitle : l10n.pinConfirmTitle,
        subtitle: l10n.pinCreateBody,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DigitCodeField(
              key: ValueKey(_first == null),
              length: 6,
              obscure: true,
              controller: _controller,
              enabled: !_busy,
              semanticLabel: l10n.pinFieldLabel,
              errorText: _error,
              onCompleted: _completed,
            ),
            if (_busy)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                  child: SizedBox.square(
                    dimension: 26,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
