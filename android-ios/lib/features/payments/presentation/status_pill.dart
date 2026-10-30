import 'package:flutter/material.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../core/widgets/ui_kit.dart';

/// Status chip: colour plus words, never colour alone (accessibility).
class StatusPill extends StatelessWidget {
  const StatusPill({required this.status, super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (label, tone) = switch (status) {
      'COMPLETED' => (l10n.statusCompleted, PillTone.success),
      'FAILED' => (l10n.statusFailed, PillTone.error),
      'IN_REVIEW' => (l10n.statusInReview, PillTone.warning),
      'REFUNDED' => (l10n.statusRefunded, PillTone.info),
      _ => (l10n.statusInProgress, PillTone.brand),
    };
    return TagPill(label, tone: tone);
  }
}
