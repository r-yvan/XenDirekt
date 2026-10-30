import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/router/routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/primary_button.dart';
import '../application/biometric_enrolment.dart';
import 'auth_layout.dart';

/// Offered once, right after the PIN (FR-ONB-04: same step).
class BiometricOfferScreen extends ConsumerStatefulWidget {
  const BiometricOfferScreen({super.key});

  @override
  ConsumerState<BiometricOfferScreen> createState() =>
      _BiometricOfferScreenState();
}

class _BiometricOfferScreenState extends ConsumerState<BiometricOfferScreen> {
  bool _busy = false;

  Future<void> _finish() async {
    await ref.read(preferencesProvider).setBiometricsOffered();
    if (mounted) {
      context.go(Routes.pay);
    }
  }

  Future<void> _enable() async {
    setState(() => _busy = true);
    try {
      await ref.read(biometricEnrolmentProvider).enable(context);
      await _finish();
    } on ApiFailure catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              messageForFailure(AppLocalizations.of(context), failure),
            ),
          ),
        );
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
    return AuthLayout(
      centered: true,
      icon: Icons.fingerprint_rounded,
      title: l10n.enableBiometricsTitle,
      subtitle: l10n.enableBiometricsBody,
      actions: [
        PrimaryButton(
          label: l10n.enableBiometrics,
          icon: Icons.fingerprint_rounded,
          loading: _busy,
          onPressed: _busy ? null : _enable,
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: _busy ? null : _finish,
          style: TextButton.styleFrom(
            foregroundColor: context.xd.textSecondary,
            minimumSize: const Size.fromHeight(48),
          ),
          child: Text(l10n.notNow),
        ),
      ],
      child: const SizedBox.shrink(),
    );
  }
}
