import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/primary_button.dart';

/// "Report a problem" (PRD tap map: payment → Report a problem → reason chip).
/// The payment reference is attached by the server; details are optional.
Future<void> showReportProblemSheet(
  BuildContext context,
  WidgetRef ref, {
  String? paymentId,
}) async {
  final l10n = AppLocalizations.of(context);
  final messenger = ScaffoldMessenger.of(context);
  final sent = await showModalBottomSheet<String>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    builder: (context) => _ReportProblemSheet(paymentId: paymentId),
  );
  if (sent != null) {
    messenger.showSnackBar(SnackBar(content: Text(l10n.reportSent(sent))));
    ref.read(analyticsProvider).track('ticket_created');
  }
}

class _ReportProblemSheet extends ConsumerStatefulWidget {
  const _ReportProblemSheet({this.paymentId});

  final String? paymentId;

  @override
  ConsumerState<_ReportProblemSheet> createState() =>
      _ReportProblemSheetState();
}

class _ReportProblemSheetState extends ConsumerState<_ReportProblemSheet> {
  final _details = TextEditingController();
  String? _category;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _details.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final category = _category;
    if (category == null) {
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final api = ref.read(supportApiProvider);
      final message = _details.text.trim().isEmpty
          ? null
          : _details.text.trim();
      final ticket = widget.paymentId == null
          ? await api.report(category: category, message: message)
          : await api.reportPayment(
              widget.paymentId!,
              category: category,
              message: message,
            );
      if (mounted) {
        Navigator.of(context).pop(ticket.reference);
      }
    } on ApiFailure catch (failure) {
      if (mounted) {
        setState(() {
          _sending = false;
          _error = messageForFailure(AppLocalizations.of(context), failure);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final categories = <String, String>{
      if (widget.paymentId != null) ...{
        'SELLER_NOT_PAID': l10n.ticketSellerNotPaid,
        'WRONG_AMOUNT': l10n.ticketWrongAmount,
        'CHARGED_BUT_FAILED': l10n.ticketChargedButFailed,
        'CHARGED_TWICE': l10n.ticketChargedTwice,
        'WRONG_SELLER': l10n.ticketWrongSeller,
        'REFUND_REQUEST': l10n.ticketRefundRequest,
      },
      'APP_PROBLEM': l10n.ticketAppProblem,
      'OTHER': l10n.ticketOther,
    };
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.reportProblemTitle,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final entry in categories.entries)
                ChoiceChip(
                  label: Text(entry.value),
                  selected: _category == entry.key,
                  showCheckmark: false,
                  labelStyle: TextStyle(
                    color: _category == entry.key
                        ? context.xd.accentText
                        : context.xd.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                  onSelected: (_) => setState(() => _category = entry.key),
                ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _details,
            maxLength: 1000,
            minLines: 2,
            maxLines: 5,
            decoration: InputDecoration(labelText: l10n.addDetails),
          ),
          if (_error != null)
            Text(_error!, style: TextStyle(color: context.xd.statusErrorText)),
          const SizedBox(height: 8),
          PrimaryButton(
            label: l10n.send,
            loading: _sending,
            onPressed: _category == null ? null : _send,
          ),
        ],
      ),
    );
  }
}
