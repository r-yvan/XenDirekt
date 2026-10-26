import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../core/errors/api_failure.dart';
import '../data/auth_models.dart';
import '../presentation/pin_prompt_sheet.dart';

/// Obtains a single-use step-up token for a sensitive action (ADR 0005):
/// biometrics unlock the device key, which signs the server's nonce; the PIN is
/// the fallback (and the only way to enrol a new device key).
class StepUpCoordinator {
  StepUpCoordinator(this._ref);

  final Ref _ref;

  /// Returns null if the user cancels.
  Future<String?> obtain(BuildContext context, StepUpPurpose purpose) async {
    final l10n = AppLocalizations.of(context);
    final prefs = _ref.read(preferencesProvider);
    final deviceKey = _ref.read(deviceKeyServiceProvider);
    final auth = _ref.read(authApiProvider);

    if (purpose != StepUpPurpose.registerDeviceKey &&
        prefs.biometricsEnabled &&
        await deviceKey.hasKey()) {
      final reason = purpose == StepUpPurpose.payment
          ? l10n.biometricReasonPay
          : l10n.biometricReasonSensitive;
      if (await _ref.read(biometricGateProvider).authenticate(reason)) {
        try {
          final challenge = await auth.stepUpChallenge(purpose);
          return await auth.stepUpWithDeviceKey(
            purpose,
            challengeId: challenge.challengeId,
            signature: await deviceKey.sign(challenge.signingMessage),
          );
        } on ApiFailure catch (failure) {
          if (failure.isConnectivity) {
            rethrow;
          }
          // Key no longer accepted (e.g. revoked server-side): fall back to the PIN.
        }
      }
    }
    if (!context.mounted) {
      return null;
    }
    return showPinPromptSheet(
      context,
      title: l10n.pinEnterTitle,
      submit: (pin) => auth.stepUpWithPin(purpose, pin),
    );
  }
}

final stepUpCoordinatorProvider = Provider<StepUpCoordinator>(
  StepUpCoordinator.new,
);
