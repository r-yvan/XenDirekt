import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../data/auth_models.dart';
import '../presentation/pin_prompt_sheet.dart';
import 'session_controller.dart';

/// Turns biometric approval on or off. Enrolling creates a device key and
/// registers its public key after a PIN step-up (a key can't vouch for itself).
class BiometricEnrolment {
  BiometricEnrolment(this._ref);

  final Ref _ref;

  Future<bool> enable(BuildContext context) async {
    final l10n = AppLocalizations.of(context);
    if (!await _ref
        .read(biometricGateProvider)
        .authenticate(l10n.biometricReasonSensitive)) {
      return false;
    }
    if (!context.mounted) {
      return false;
    }
    final auth = _ref.read(authApiProvider);
    final stepUpToken = await showPinPromptSheet<String>(
      context,
      title: l10n.pinEnterTitle,
      submit: (pin) => auth.stepUpWithPin(StepUpPurpose.registerDeviceKey, pin),
    );
    if (stepUpToken == null) {
      return false;
    }
    final keys = _ref.read(deviceKeyServiceProvider);
    await auth.registerDeviceKey(
      publicKeyBase64: await keys.createKey(),
      stepUpToken: stepUpToken,
    );
    await _ref.read(preferencesProvider).setBiometricsEnabled(true);
    await _ref.read(sessionControllerProvider.notifier).reloadProfile();
    return true;
  }

  Future<void> disable() async {
    await _ref.read(authApiProvider).revokeDeviceKey();
    await _ref.read(deviceKeyServiceProvider).deleteKey();
    await _ref.read(preferencesProvider).setBiometricsEnabled(false);
    await _ref.read(sessionControllerProvider.notifier).reloadProfile();
  }
}

final biometricEnrolmentProvider = Provider<BiometricEnrolment>(
  BiometricEnrolment.new,
);
