import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/date_wheel_picker.dart';
import '../../../core/widgets/motion/auth_illustration.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../../shared/models/countries.dart';
import '../../authentication/application/session_controller.dart';

/// Name, country of residence (prefilled from the device region) and date of
/// birth; the Continue tap also records acceptance of Terms and Privacy (FR-ONB-03).
class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  ConsumerState<CompleteProfileScreen> createState() =>
      _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends ConsumerState<CompleteProfileScreen> {
  final _name = TextEditingController();
  String? _country;
  DateTime? _dateOfBirth;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final profile = ref.read(sessionControllerProvider).profile;
    _name.text = profile?.fullName ?? '';
    final region = PlatformDispatcher.instance.locale.countryCode;
    _country =
        profile?.countryOfResidence ??
        (countries.any((country) => country.code == region) && region != 'RW'
            ? region
            : null);
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  bool get _complete =>
      _name.text.trim().length >= 2 && _country != null && _dateOfBirth != null;

  Future<void> _pickDate() async {
    final l10n = AppLocalizations.of(context);
    final now = DateTime.now();
    final picked = await showDateWheelPicker(
      context,
      initial: _dateOfBirth ?? DateTime(now.year - 30),
      first: DateTime(1900),
      last: DateTime(now.year - 18, now.month, now.day),
      title: l10n.dateOfBirthLabel,
      subtitle: l10n.dobPickerSubtitle,
    );
    if (picked != null) {
      setState(() => _dateOfBirth = picked);
    }
  }

  Future<void> _pickCountry() async {
    final language = effectiveLanguage(ref.read(localeControllerProvider));
    final picked = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (context) =>
          _CountryPicker(language: language, selected: _country),
    );
    if (picked != null) {
      setState(() => _country = picked);
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    final dob = _dateOfBirth!;
    try {
      final profile = await ref
          .read(authApiProvider)
          .updateProfile(
            fullName: _name.text.trim(),
            countryOfResidence: _country,
            dateOfBirth:
                '${dob.year.toString().padLeft(4, '0')}-${dob.month.toString().padLeft(2, '0')}-${dob.day.toString().padLeft(2, '0')}',
            preferredLanguage: effectiveLanguage(
              ref.read(localeControllerProvider),
            ),
            acceptLegalTerms: true,
          );
      ref.read(analyticsProvider)
        ..track('signup_completed', {'country': _country})
        ..flushSoon();
      ref.read(sessionControllerProvider.notifier).profileUpdated(profile);
    } on ApiFailure catch (failure) {
      if (mounted) {
        setState(
          () =>
              _error = messageForFailure(AppLocalizations.of(context), failure),
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
    final theme = Theme.of(context).textTheme;
    final language = effectiveLanguage(ref.watch(localeControllerProvider));
    final config = ref.watch(sessionControllerProvider).clientConfig;
    final country = _country == null
        ? null
        : countries.firstWhere((country) => country.code == _country);
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  const StepProgress(current: 2, total: 3),
                  const SizedBox(height: 10),
                  Text(
                    l10n.stepOf(2, 3),
                    style: theme.labelMedium?.copyWith(
                      color: context.xd.textTertiary,
                    ),
                  ),
                  const SizedBox(height: 20),
                  FadeSlideIn(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const AuthIllustration(
                          kind: AuthIllustrationKind.profile,
                          size: 200,
                        ),
                        const SizedBox(height: 12),
                        Semantics(
                          header: true,
                          child: Text(
                            l10n.profileTitle,
                            style: theme.headlineLarge,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          l10n.profileSubtitle,
                          style: theme.bodyLarge?.copyWith(
                            color: context.xd.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 60),
                    child: TextField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.name],
                      textInputAction: TextInputAction.done,
                      style: theme.titleMedium,
                      decoration: InputDecoration(
                        labelText: l10n.fullNameLabel,
                        prefixIcon: const Icon(Icons.person_outline_rounded),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 110),
                    child: SelectField(
                      label: l10n.countryLabel,
                      icon: Icons.public_rounded,
                      value: country?.name(language),
                      leading: country == null
                          ? null
                          : Text(
                              flagEmoji(country.code),
                              style: const TextStyle(fontSize: 22),
                            ),
                      onTap: _pickCountry,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 160),
                    child: SelectField(
                      label: l10n.dateOfBirthLabel,
                      icon: Icons.cake_outlined,
                      value: _dateOfBirth == null
                          ? null
                          : DateFormat.yMMMMd(
                              Localizations.localeOf(context).toString(),
                            ).format(_dateOfBirth!),
                      onTap: _pickDate,
                    ),
                  ),
                  const SizedBox(height: 22),
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 210),
                    child: XdCard(
                      padding: const EdgeInsets.fromLTRB(16, 14, 8, 6),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Icon(
                                  Icons.verified_user_outlined,
                                  size: 20,
                                  color: context.xd.statusSuccessText,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  l10n.termsNotice,
                                  style: theme.bodyMedium?.copyWith(
                                    color: context.xd.textSecondary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          Padding(
                            padding: const EdgeInsets.only(left: 22),
                            child: Wrap(
                              children: [
                                TextButton(
                                  onPressed: config == null
                                      ? null
                                      : () => launchUrl(
                                          Uri.parse(config.termsUrl),
                                        ),
                                  child: Text(l10n.viewTerms),
                                ),
                                TextButton(
                                  onPressed: config == null
                                      ? null
                                      : () => launchUrl(
                                          Uri.parse(config.privacyUrl),
                                        ),
                                  child: Text(l10n.viewPrivacy),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    InlineError(_error!),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: PrimaryButton(
                label: l10n.continueLabel,
                trailingIcon: Icons.arrow_forward_rounded,
                loading: _busy,
                onPressed: _complete && !_busy ? _submit : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CountryPicker extends StatefulWidget {
  const _CountryPicker({required this.language, this.selected});

  final String language;
  final String? selected;

  @override
  State<_CountryPicker> createState() => _CountryPickerState();
}

class _CountryPickerState extends State<_CountryPicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final query = _query.toLowerCase();
    final matches =
        countries
            .where(
              (country) =>
                  country.code != 'RW' &&
                  (query.isEmpty ||
                      country
                          .name(widget.language)
                          .toLowerCase()
                          .contains(query) ||
                      country.code.toLowerCase() == query),
            )
            .toList()
          ..sort(
            (a, b) =>
                a.name(widget.language).compareTo(b.name(widget.language)),
          );
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.82,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
            child: Text(l10n.chooseCountry, style: theme.titleLarge),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: TextField(
              autofocus: true,
              decoration: InputDecoration(
                hintText: l10n.searchCountry,
                prefixIcon: const Icon(Icons.search_rounded),
                fillColor: context.xd.surface2,
              ),
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.only(bottom: 24),
              itemCount: matches.length,
              itemBuilder: (context, index) {
                final country = matches[index];
                final selected = country.code == widget.selected;
                return ListTile(
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: context.xd.surface2,
                      shape: BoxShape.circle,
                      border: Border.all(color: context.xd.hairline),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      flagEmoji(country.code),
                      style: const TextStyle(fontSize: 20),
                    ),
                  ),
                  title: Text(
                    country.name(widget.language),
                    style: theme.bodyLarge?.copyWith(
                      fontWeight: selected ? FontWeight.w700 : null,
                    ),
                  ),
                  trailing: selected
                      ? const Icon(
                          Icons.check_circle_rounded,
                          color: AppColors.brandOrange,
                        )
                      : Text(
                          country.code,
                          style: theme.labelMedium?.copyWith(
                            color: context.xd.textTertiary,
                          ),
                        ),
                  onTap: () => Navigator.of(context).pop(country.code),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
