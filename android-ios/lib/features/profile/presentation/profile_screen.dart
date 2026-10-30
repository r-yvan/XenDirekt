import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme_controller.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/hold_to_confirm_button.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../authentication/application/biometric_enrolment.dart';
import '../../authentication/application/session_controller.dart';
import '../../authentication/application/step_up_coordinator.dart';
import '../../authentication/data/auth_models.dart';
import '../../authentication/presentation/pin_prompt_sheet.dart';
import '../../cards/presentation/cards_section.dart';
import '../../notifications/presentation/inbox_screen.dart';
import '../../support/presentation/help_screen.dart';

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

  /// A titled bottom sheet with radio options; returns the picked value.
  Future<String?> _choose(
    String title,
    String selected,
    List<(String, String)> options,
  ) {
    return showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: RadioGroup<String>(
            groupValue: selected,
            onChanged: (value) => Navigator.of(context).pop(value),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                for (final (value, label) in options)
                  RadioListTile<String>(value: value, title: Text(label)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _chooseAppearance() async {
    final l10n = AppLocalizations.of(context);
    final current = ref.read(themeModeProvider);
    final picked = await _choose(l10n.appearance, current.name, [
      (ThemeMode.system.name, l10n.themeSystem),
      (ThemeMode.light.name, l10n.themeLight),
      (ThemeMode.dark.name, l10n.themeDark),
    ]);
    if (picked != null) {
      await ref
          .read(themeModeProvider.notifier)
          .set(ThemeMode.values.byName(picked));
    }
  }

  Future<void> _chooseLanguage() async {
    final l10n = AppLocalizations.of(context);
    final current = ref.read(localeControllerProvider)?.languageCode;
    final picked = await _choose(l10n.language, current ?? 'system', [
      ('system', l10n.languageSystem),
      ('en', l10n.languageEnglish),
      ('fr', l10n.languageFrench),
    ]);
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
    final theme = Theme.of(context).textTheme;
    final session = ref.watch(sessionControllerProvider);
    final profile = session.profile;
    final language = ref.watch(localeControllerProvider)?.languageCode;
    final biometricsOn =
        ref.watch(preferencesProvider).biometricsEnabled &&
        (profile?.biometricKeyRegistered ?? false);
    final config = session.clientConfig;
    final name = profile?.fullName ?? l10n.notSet;
    final country = profile?.countryOfResidence;
    return Scaffold(
      body: AbsorbPointer(
        absorbing: _busy,
        child: SafeArea(
          bottom: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              PageHeader(title: l10n.profileTitleTab),
              FadeSlideIn(
                child: XdCard(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      InitialsAvatar(name: name, size: 62),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.headlineSmall,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              profile?.email ?? profile?.phone ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.bodyMedium?.copyWith(
                                color: context.xd.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                if (session.isSandbox)
                                  TagPill(
                                    l10n.sandboxAccount,
                                    tone: PillTone.warning,
                                    icon: Icons.science_outlined,
                                  )
                                else
                                  TagPill(
                                    l10n.verifiedAccount,
                                    tone: PillTone.success,
                                    icon: Icons.verified_rounded,
                                  ),
                                if (country != null)
                                  TagPill(
                                    '${flagEmoji(country)}  $country',
                                    dot: false,
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 28),
              const CardsSection(),
              const SizedBox(height: 28),
              SectionLabel(l10n.securitySection),
              SettingsGroup(
                children: [
                  SettingsRow(
                    icon: Icons.fingerprint_rounded,
                    title: l10n.biometricsToggle,
                    subtitle: l10n.biometricsSubtitle,
                    trailing: Switch(
                      value: biometricsOn,
                      onChanged: _toggleBiometrics,
                    ),
                    onTap: () => _toggleBiometrics(!biometricsOn),
                  ),
                  SettingsRow(
                    icon: Icons.password_rounded,
                    iconColor: context.xd.statusInfo,
                    title: l10n.changePin,
                    subtitle: l10n.changePinSubtitle,
                    onTap: _changePin,
                  ),
                ],
              ),
              const SizedBox(height: 24),
              SectionLabel(l10n.sectionPreferences),
              SettingsGroup(
                children: [
                  SettingsRow(
                    icon: Icons.contrast_rounded,
                    iconColor: context.xd.statusInfo,
                    title: l10n.appearance,
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          switch (ref.watch(themeModeProvider)) {
                            ThemeMode.light => l10n.themeLight,
                            ThemeMode.dark => l10n.themeDark,
                            ThemeMode.system => l10n.themeSystem,
                          },
                          style: theme.bodyMedium?.copyWith(
                            color: context.xd.textSecondary,
                          ),
                        ),
                        Icon(
                          Icons.chevron_right_rounded,
                          color: context.xd.textTertiary,
                        ),
                      ],
                    ),
                    onTap: _chooseAppearance,
                  ),
                  SettingsRow(
                    icon: Icons.translate_rounded,
                    iconColor: context.xd.statusSuccessText,
                    title: l10n.language,
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          switch (language) {
                            'en' => l10n.languageEnglish,
                            'fr' => l10n.languageFrench,
                            _ => l10n.languageSystem,
                          },
                          style: theme.bodyMedium?.copyWith(
                            color: context.xd.textSecondary,
                          ),
                        ),
                        Icon(
                          Icons.chevron_right_rounded,
                          color: context.xd.textTertiary,
                        ),
                      ],
                    ),
                    onTap: _chooseLanguage,
                  ),
                  SettingsRow(
                    icon: Icons.notifications_none_rounded,
                    iconColor: context.xd.statusWarning,
                    title: l10n.notificationsTitle,
                    subtitle: l10n.notificationsSubtitle,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const InboxScreen(),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              SectionLabel(l10n.sectionSupport),
              SettingsGroup(
                children: [
                  SettingsRow(
                    icon: Icons.support_agent_rounded,
                    iconColor: context.xd.statusInfo,
                    title: l10n.helpCentre,
                    subtitle: l10n.helpSubtitle,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const HelpScreen(),
                      ),
                    ),
                  ),
                  SettingsRow(
                    icon: Icons.shield_outlined,
                    iconColor: context.xd.textSecondary,
                    title: l10n.termsAndPrivacy,
                    subtitle: l10n.termsSubtitle,
                    trailing: Icon(
                      Icons.open_in_new_rounded,
                      size: 18,
                      color: context.xd.textTertiary,
                    ),
                    onTap: config == null
                        ? null
                        : () => launchUrl(Uri.parse(config.privacyUrl)),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SettingsGroup(
                children: [
                  SettingsRow(
                    icon: Icons.logout_rounded,
                    iconColor: context.xd.textSecondary,
                    title: l10n.logOut,
                    showChevron: false,
                    onTap: () =>
                        ref.read(sessionControllerProvider.notifier).signOut(),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              SectionLabel(l10n.sectionDangerZone),
              XdCard(
                borderColor: context.xd.statusErrorText.withValues(alpha: 0.22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        IconBadge(
                          Icons.person_remove_outlined,
                          color: context.xd.statusErrorText,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            l10n.deleteAccount,
                            style: theme.titleMedium,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      l10n.deleteAccountBody,
                      style: theme.bodyMedium?.copyWith(
                        color: context.xd.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 16),
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
      ),
    );
  }
}
