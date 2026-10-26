import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/state_views.dart';
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
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(now.year - 30),
      firstDate: DateTime(1900),
      lastDate: DateTime(now.year - 18, now.month, now.day),
      initialEntryMode: DatePickerEntryMode.input,
    );
    if (picked != null) {
      setState(() => _dateOfBirth = picked);
    }
  }

  Future<void> _pickCountry() async {
    final language = effectiveLanguage(ref.read(localeControllerProvider));
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _CountryPicker(language: language),
    );
    if (picked != null) {
      setState(() => _country = picked);
    }
  }

  Future<void> _submit() async {
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
    final language = effectiveLanguage(ref.watch(localeControllerProvider));
    final config = ref.watch(sessionControllerProvider).clientConfig;
    final countryName = _country == null
        ? null
        : countries
              .firstWhere((country) => country.code == _country)
              .name(language);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            TextField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.name],
              decoration: InputDecoration(labelText: l10n.fullNameLabel),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),
            _PickerTile(
              label: l10n.countryLabel,
              value: countryName,
              onTap: _pickCountry,
            ),
            const SizedBox(height: 16),
            _PickerTile(
              label: l10n.dateOfBirthLabel,
              value: _dateOfBirth == null
                  ? null
                  : MaterialLocalizations.of(context)
                        .formatMediumDate(_dateOfBirth!),
              onTap: _pickDate,
            ),
            const SizedBox(height: 24),
            Text(
              l10n.termsNotice,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            Wrap(
              children: [
                TextButton(
                  onPressed: config == null
                      ? null
                      : () => launchUrl(Uri.parse(config.termsUrl)),
                  child: Text(l10n.viewTerms),
                ),
                TextButton(
                  onPressed: config == null
                      ? null
                      : () => launchUrl(Uri.parse(config.privacyUrl)),
                  child: Text(l10n.viewPrivacy),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              InlineError(_error!),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _complete && !_busy ? _submit : null,
              child: Text(l10n.continueLabel),
            ),
          ],
        ),
      ),
    );
  }
}

class _PickerTile extends StatelessWidget {
  const _PickerTile({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$label ${value ?? ''}',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            suffixIcon: const Icon(Icons.expand_more),
          ),
          isEmpty: value == null,
          child: Text(value ?? ''),
        ),
      ),
    );
  }
}

class _CountryPicker extends StatefulWidget {
  const _CountryPicker({required this.language});

  final String language;

  @override
  State<_CountryPicker> createState() => _CountryPickerState();
}

class _CountryPickerState extends State<_CountryPicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
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
      height: MediaQuery.sizeOf(context).height * 0.8,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              autofocus: true,
              decoration: InputDecoration(
                labelText: l10n.searchCountry,
                prefixIcon: const Icon(Icons.search),
              ),
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: matches.length,
              itemBuilder: (context, index) {
                final country = matches[index];
                return ListTile(
                  title: Text(country.name(widget.language)),
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
