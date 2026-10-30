import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../data/support_api.dart';
import 'report_problem_sheet.dart';

final _myTicketsProvider = FutureProvider.autoDispose<List<SupportTicket>>(
  (ref) => ref.watch(supportApiProvider).mine(),
);

/// Help centre (FR-HIS-02): bundled FAQ (works offline), contact, and the
/// status of problems the user reported.
class HelpScreen extends ConsumerWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = effectiveLanguage(ref.watch(localeControllerProvider));
    final faq = [
      (l10n.faq1q, l10n.faq1a),
      (l10n.faq2q, l10n.faq2a),
      (l10n.faq3q, l10n.faq3a),
      (l10n.faq4q, l10n.faq4a),
      (l10n.faq5q, l10n.faq5a),
      (l10n.faq6q, l10n.faq6a),
      (l10n.faq7q, l10n.faq7a),
      (l10n.faq8q, l10n.faq8a),
    ];
    final tickets = ref.watch(_myTicketsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.helpCentre)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          for (final (index, item) in faq.indexed)
            FadeSlideIn.stagger(
              index: index,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  child: ExpansionTile(
                    shape: const Border(),
                    title: Text(
                      item.$1,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    children: [
                      Text(
                        item.$2,
                        style: TextStyle(
                          color: context.xd.textSecondary,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => showReportProblemSheet(context, ref),
            icon: const Icon(Icons.support_agent_rounded),
            label: Text(l10n.contactSupport),
          ),
          const SizedBox(height: 24),
          Text(l10n.myRequests, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          ...switch (tickets) {
            AsyncData(:final value) when value.isEmpty => [
              Text(
                l10n.noRequests,
                style: TextStyle(color: context.xd.textSecondary),
              ),
            ],
            AsyncData(:final value) => [
              for (final ticket in value)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(ticket.paymentReference ?? ticket.reference),
                  subtitle: Text(
                    DateFormat.yMMMd(locale).format(ticket.createdAt.toLocal()),
                  ),
                  trailing: Text(switch (ticket.status) {
                    'IN_PROGRESS' => l10n.ticketStatusInProgress,
                    'RESOLVED' => l10n.ticketStatusResolved,
                    'CLOSED' => l10n.ticketStatusClosed,
                    _ => l10n.ticketStatusOpen,
                  }),
                ),
            ],
            AsyncError() => [
              Text(
                l10n.errorNetwork,
                style: TextStyle(color: context.xd.textSecondary),
              ),
            ],
            _ => [const LinearProgressIndicator()],
          },
        ],
      ),
    );
  }
}
