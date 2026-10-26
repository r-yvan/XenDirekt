import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/router/routes.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/state_views.dart';

/// Email or international phone entry. Validation here is only a convenience;
/// the server normalises and validates the destination.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({required this.channel, super.key});

  final String channel;

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _controller = TextEditingController();
  bool _busy = false;
  String? _error;

  bool get _isEmail => widget.channel == 'EMAIL';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool _looksValid(String value) => _isEmail
      ? RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(value.trim())
      : RegExp(r'^\+[1-9][\d\s\-]{6,18}$').hasMatch(value.trim());

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final value = _controller.text.trim();
    if (!_looksValid(value)) {
      setState(() => _error = _isEmail ? l10n.invalidEmail : l10n.invalidPhone);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final challenge = await ref
          .read(authApiProvider)
          .requestOtp(
            channel: widget.channel,
            destination: value,
            locale: effectiveLanguage(ref.read(localeControllerProvider)),
          );
      if (mounted) {
        await context.push<void>(
          Routes.verifyOtp,
          extra: OtpRouteArgs(
            channel: widget.channel,
            destination: value,
            challenge: challenge,
          ),
        );
      }
    } on ApiFailure catch (failure) {
      if (mounted) {
        setState(() => _error = messageForFailure(l10n, failure));
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
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
                _isEmail ? l10n.emailTitle : l10n.phoneTitle,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _controller,
                autofocus: true,
                enabled: !_busy,
                keyboardType: _isEmail
                    ? TextInputType.emailAddress
                    : TextInputType.phone,
                autofillHints: [
                  _isEmail
                      ? AutofillHints.email
                      : AutofillHints.telephoneNumber,
                ],
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: _isEmail ? l10n.emailLabel : l10n.phoneLabel,
                  hintText: _isEmail ? null : l10n.phoneHint,
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                InlineError(_error!),
              ],
              const Spacer(),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      )
                    : Text(l10n.continueLabel),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
