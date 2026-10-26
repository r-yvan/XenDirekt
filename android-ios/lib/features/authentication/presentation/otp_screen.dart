import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/router/routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/digit_code_field.dart';
import '../application/session_controller.dart';
import '../data/auth_models.dart';

/// 6-digit code that submits itself on the last digit (FR-ONB-02).
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({required this.args, super.key});

  final OtpRouteArgs args;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  late OtpChallenge _challenge = widget.args.challenge;
  final _codeController = TextEditingController();
  Timer? _ticker;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(
      const Duration(seconds: 1),
      (_) => setState(() {}),
    );
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _codeController.dispose();
    super.dispose();
  }

  int get _resendIn {
    final seconds = _challenge.resendAvailableAt
        .difference(DateTime.now())
        .inSeconds;
    return seconds < 0 ? 0 : seconds;
  }

  Future<void> _verify(String code) async {
    if (_busy) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(authApiProvider)
          .verifyOtp(challengeId: _challenge.challengeId, otp: code);
      await ref.read(sessionControllerProvider.notifier).signedIn(result);
      // The router redirects to the next onboarding step.
    } on ApiFailure catch (failure) {
      if (mounted) {
        setState(() {
          _error = messageForFailure(AppLocalizations.of(context), failure);
          _codeController.clear();
        });
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _resend() async {
    try {
      final challenge = await ref
          .read(authApiProvider)
          .requestOtp(
            channel: widget.args.channel,
            destination: widget.args.destination,
            locale: effectiveLanguage(ref.read(localeControllerProvider)),
          );
      setState(() {
        _challenge = challenge;
        _error = null;
        _codeController.clear();
      });
    } on ApiFailure catch (failure) {
      if (mounted) {
        setState(
          () =>
              _error = messageForFailure(AppLocalizations.of(context), failure),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.otpTitle,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                l10n.otpSentTo(_challenge.destinationMasked),
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 32),
              AutofillGroup(
                child: DigitCodeField(
                  length: _challenge.codeLength,
                  controller: _codeController,
                  autofillOneTimeCode: true,
                  enabled: !_busy,
                  semanticLabel: l10n.otpFieldLabel,
                  errorText: _error,
                  onCompleted: _verify,
                ),
              ),
              const SizedBox(height: 24),
              if (_busy) const Center(child: CircularProgressIndicator()),
              Center(
                child: TextButton(
                  onPressed: _resendIn == 0 && !_busy ? _resend : null,
                  child: Text(
                    _resendIn == 0
                        ? l10n.otpResend
                        : l10n.otpResendIn(_resendIn),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
