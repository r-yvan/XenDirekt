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
import 'auth_layout.dart';

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
    final theme = Theme.of(context).textTheme;
    final isEmail = widget.args.channel == 'EMAIL';
    return AuthLayout(
      showBack: true,
      step: 1,
      icon: isEmail ? Icons.mark_email_read_outlined : Icons.sms_outlined,
      title: l10n.otpTitle,
      subtitle: l10n.otpSentTo(_challenge.destinationMasked),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
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
          const SizedBox(height: 28),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: _busy
                ? const Center(
                    key: ValueKey('busy'),
                    child: SizedBox.square(
                      dimension: 26,
                      child: CircularProgressIndicator(strokeWidth: 2.4),
                    ),
                  )
                : Center(
                    key: const ValueKey('resend'),
                    child: _resendIn == 0
                        ? TextButton.icon(
                            onPressed: _resend,
                            icon: const Icon(Icons.refresh_rounded, size: 18),
                            label: Text(l10n.otpResend),
                          )
                        : Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: context.xd.surface1,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: context.xd.hairline),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.schedule_rounded,
                                  size: 16,
                                  color: context.xd.textTertiary,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  l10n.otpResendIn(_resendIn),
                                  style: theme.labelMedium?.copyWith(
                                    color: context.xd.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}
