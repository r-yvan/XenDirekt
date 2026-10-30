import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/security/screen_security.dart';
import '../../../core/widgets/digit_code_field.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/widgets/ui_kit.dart';
import '../application/session_controller.dart';
import 'auth_layout.dart';

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
    final firstName = session.profile?.firstName;
    return SecureScreen(
      child: AuthLayout(
        centered: true,
        hero: InitialsAvatar(name: session.profile?.fullName ?? 'X', size: 88),
        title: firstName == null
            ? l10n.unlockTitle
            : '${l10n.unlockTitle}, $firstName',
        subtitle: session.offline ? l10n.offlineBanner : null,
        actions: [
          if (!_showPin) ...[
            PrimaryButton(
              label: l10n.unlockWithBiometrics,
              icon: Icons.fingerprint_rounded,
              onPressed: _busy ? null : _tryBiometrics,
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => setState(() => _showPin = true),
              style: TextButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              child: Text(l10n.usePinInstead),
            ),
          ],
          TextButton.icon(
            onPressed: () =>
                ref.read(sessionControllerProvider.notifier).signOut(),
            style: TextButton.styleFrom(
              foregroundColor: context.xd.textSecondary,
              minimumSize: const Size.fromHeight(48),
            ),
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: Text(l10n.logOut),
          ),
        ],
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_showPin)
              DigitCodeField(
                length: 6,
                obscure: true,
                controller: _controller,
                enabled: !_busy,
                semanticLabel: l10n.pinFieldLabel,
                errorText: _error,
                onCompleted: _pin,
              ),
            if (_error != null && !_showPin) InlineError(_error!),
          ],
        ),
      ),
    );
  }
}
