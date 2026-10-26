import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/router/routes.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../application/biometric_enrolment.dart';

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
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Icon(
                Icons.fingerprint,
                size: 72,
                color: AppColors.brandOrange,
              ),
              const SizedBox(height: 24),
              Text(
                l10n.enableBiometricsTitle,
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                l10n.enableBiometricsBody,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const Spacer(),
              FilledButton(
                onPressed: _busy ? null : _enable,
                child: Text(l10n.enableBiometrics),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _busy ? null : _finish,
                child: Text(l10n.notNow),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
