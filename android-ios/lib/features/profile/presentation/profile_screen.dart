import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/hold_to_confirm_button.dart';
import '../../authentication/application/biometric_enrolment.dart';
import '../../authentication/application/session_controller.dart';
import '../../authentication/application/step_up_coordinator.dart';
import '../../authentication/data/auth_models.dart';
import '../../authentication/presentation/pin_prompt_sheet.dart';
import '../../cards/presentation/cards_section.dart';

/// Every setting is one item on this screen, no sub-menus (PRD §5.0 rule 2).
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _busy = false;

  Future<void> _guard(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
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

  Future<void> _chooseLanguage() async {
    final l10n = AppLocalizations.of(context);
    final current = ref.read(localeControllerProvider)?.languageCode;
    final picked = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: RadioGroup<String>(
          groupValue: current ?? 'system',
          onChanged: (value) => Navigator.of(context).pop(value),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile<String>(
                value: 'system',
                title: Text(l10n.languageSystem),
              ),
              RadioListTile<String>(
                value: 'en',
                title: Text(l10n.languageEnglish),
              ),
              RadioListTile<String>(
                value: 'fr',
                title: Text(l10n.languageFrench),
              ),
            ],
          ),
        ),
      ),
    );
    if (picked == null) {
      return;
    }
    final code = picked == 'system' ? null : picked;
    await ref.read(localeControllerProvider.notifier).set(code);
    await _guard(() async {
      final profile = await ref
          .read(authApiProvider)
          .updateProfile(
            preferredLanguage: effectiveLanguage(
              ref.read(localeControllerProvider),
            ),
          );
      ref.read(sessionControllerProvider.notifier).profileUpdated(profile);
    });
  }

  Future<void> _changePin() async {
    final l10n = AppLocalizations.of(context);
    final token = await ref
        .read(stepUpCoordinatorProvider)
        .obtain(context, StepUpPurpose.changePin);
    if (token == null || !mounted) {
      return;
    }
    final changed = await showPinPromptSheet<bool>(
      context,
      title: l10n.newPinTitle,
      submit: (pin) async {
        await ref.read(authApiProvider).changePin(pin, stepUpToken: token);
        return true;
      },
    );
    if (changed == true && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.pinChanged)));
    }
  }

  Future<void> _toggleBiometrics(bool enable) => _guard(() async {
    final enrolment = ref.read(biometricEnrolmentProvider);
    if (enable) {
      await enrolment.enable(context);
    } else {
      await enrolment.disable();
    }
  });

  Future<void> _deleteAccount() => _guard(() async {
    final token = await ref
        .read(stepUpCoordinatorProvider)
        .obtain(context, StepUpPurpose.deleteAccount);
    if (token == null) {
      return;
    }
    await ref.read(authApiProvider).deleteAccount(stepUpToken: token);
    await ref.read(deviceKeyServiceProvider).deleteKey();
    await ref.read(preferencesProvider).setBiometricsEnabled(false);
    await ref.read(sessionControllerProvider.notifier).signOut();
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionControllerProvider);
    final profile = session.profile;
    final language = ref.watch(localeControllerProvider)?.languageCode;
    final biometricsOn =
        ref.watch(preferencesProvider).biometricsEnabled &&
        (profile?.biometricKeyRegistered ?? false);
    final config = session.clientConfig;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileTitleTab)),
      body: AbsorbPointer(
        absorbing: _busy,
        child: ListView(
          children: [
            ListTile(
              title: Text(
                profile?.fullName ?? l10n.notSet,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              subtitle: Text(
                profile?.email ?? profile?.phone ?? '',
                style: const TextStyle(color: AppColors.textSecondary),
              ),
            ),
            const Divider(),
            const CardsSection(),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.language),
              title: Text(l10n.language),
              trailing: Text(switch (language) {
                'en' => l10n.languageEnglish,
                'fr' => l10n.languageFrench,
                _ => l10n.languageSystem,
              }),
              onTap: _chooseLanguage,
            ),
            SwitchListTile(
              secondary: const Icon(Icons.fingerprint),
              title: Text(l10n.biometricsToggle),
              value: biometricsOn,
              onChanged: _toggleBiometrics,
            ),
            ListTile(
              leading: const Icon(Icons.pin_outlined),
              title: Text(l10n.changePin),
              onTap: _changePin,
            ),
            ListTile(
              leading: const Icon(Icons.description_outlined),
              title: Text(l10n.termsAndPrivacy),
              onTap: config == null
                  ? null
                  : () => launchUrl(Uri.parse(config.privacyUrl)),
            ),
            ListTile(
              leading: const Icon(Icons.logout),
              title: Text(l10n.logOut),
              onTap: () =>
                  ref.read(sessionControllerProvider.notifier).signOut(),
            ),
            const Divider(),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    l10n.deleteAccountBody,
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 12),
                  HoldToConfirmButton(
                    label: l10n.holdToDelete,
                    onConfirmed: _deleteAccount,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
