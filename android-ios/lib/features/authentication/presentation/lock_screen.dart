import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/digit_code_field.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/widgets/xd_logo.dart';
import '../application/session_controller.dart';

/// Shown on cold start and after 5 minutes in the background (NFR-SEC-04).
/// Biometrics start automatically; the PIN is checked by the server.
class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({super.key});

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  final _controller = TextEditingController();
  bool _showPin = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryBiometrics());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _tryBiometrics() async {
    final prefs = ref.read(preferencesProvider);
    if (!prefs.biometricsEnabled || !mounted) {
      setState(() => _showPin = true);
      return;
    }
    final ok = await ref
        .read(biometricGateProvider)
        .authenticate(AppLocalizations.of(context).biometricReasonUnlock);
    if (ok) {
      await _unlocked();
    } else if (mounted) {
      setState(() => _showPin = true);
    }
  }

  Future<void> _unlocked() async {
    try {
      await ref.read(sessionControllerProvider.notifier).unlocked();
    } on ApiFailure catch (failure) {
      if (mounted) {
        setState(
          () =>
              _error = messageForFailure(AppLocalizations.of(context), failure),
        );
      }
    }
  }

  Future<void> _pin(String pin) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authApiProvider).verifyPin(pin);
      await _unlocked();
    } on ApiFailure catch (failure) {
      if (mounted) {
        setState(() {
          _error = messageForFailure(AppLocalizations.of(context), failure);
          _controller.clear();
        });
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
    final session = ref.watch(sessionControllerProvider);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              const Center(child: XdLogo(size: 64)),
              const SizedBox(height: 24),
              Text(
                session.profile?.firstName == null
                    ? l10n.unlockTitle
                    : '${l10n.unlockTitle}, ${session.profile!.firstName}',
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              if (session.offline) ...[
                const SizedBox(height: 12),
                Text(l10n.offlineBanner, textAlign: TextAlign.center),
              ],
              const SizedBox(height: 32),
              if (_showPin)
                DigitCodeField(
                  length: 6,
                  obscure: true,
                  controller: _controller,
                  enabled: !_busy,
                  semanticLabel: l10n.pinFieldLabel,
                  errorText: _error,
                  onCompleted: _pin,
                )
              else ...[
                FilledButton.icon(
                  onPressed: _tryBiometrics,
                  icon: const Icon(Icons.fingerprint),
                  label: Text(l10n.unlockWithBiometrics),
                ),
                TextButton(
                  onPressed: () => setState(() => _showPin = true),
                  child: Text(l10n.usePinInstead),
                ),
              ],
              if (_error != null && !_showPin) InlineError(_error!),
              const Spacer(),
              TextButton(
                onPressed: () =>
                    ref.read(sessionControllerProvider.notifier).signOut(),
                child: Text(l10n.logOut),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
