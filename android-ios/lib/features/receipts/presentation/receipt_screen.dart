import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../payments/data/payment_models.dart';
import '../../payments/presentation/payment_progress_screen.dart';
import '../../support/presentation/report_problem_sheet.dart';
import 'receipt_card.dart';

/// Payment detail and receipt (FR-RCP-03/04). Always re-reads the server's state.
class ReceiptScreen extends ConsumerStatefulWidget {
  const ReceiptScreen({required this.paymentId, this.initial, super.key});

  final String paymentId;
  final Payment? initial;

  @override
  ConsumerState<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends ConsumerState<ReceiptScreen> {
  late Payment? _payment = widget.initial;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final fresh = await ref.read(paymentsApiProvider).get(widget.paymentId);
      if (mounted) {
        setState(() => _payment = fresh);
      }
    } on ApiFailure {
      // Keep showing the last known state; pull to refresh retries.
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final locale = effectiveLanguage(ref.watch(localeControllerProvider));
    final payment = _payment;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.receiptTitle)),
      body: payment == null
          ? const LoadingView()
          : RefreshIndicator(
              color: AppColors.brandOrange,
              backgroundColor: context.xd.surface2,
              onRefresh: _refresh,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                children: [
                  if (payment.status == 'FAILED') ...[
                    FadeSlideIn(
                      child: XdCard(
                        borderColor: context.xd.statusErrorText.withValues(
                          alpha: 0.25,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                IconBadge(
                                  Icons.close_rounded,
                                  color: context.xd.statusErrorText,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    l10n.failedTitle,
                                    style: theme.titleMedium,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              failureMessage(l10n, payment.failureReason),
                              style: theme.bodyMedium?.copyWith(
                                color: context.xd.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 10),
                            TagPill(
                              payment.chargeStatus == 'HOLD_RELEASING'
                                  ? l10n.holdReleasing
                                  : l10n.notCharged,
                              tone: PillTone.success,
                              icon: Icons.check_circle_outline_rounded,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (payment.isInReview) ...[
                    FadeSlideIn(
                      child: XdCard(
                        borderColor: context.xd.statusWarning.withValues(
                          alpha: 0.25,
                        ),
                        child: Row(
                          children: [
                            IconBadge(
                              Icons.hourglass_top_rounded,
                              color: context.xd.statusWarning,
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Text(
                                l10n.errorPendingReview,
                                style: theme.bodyMedium,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 80),
                    child: ReceiptCard(payment: payment, locale: locale),
                  ),
                  const SizedBox(height: 20),
                  if (payment.status == 'COMPLETED') ...[
                    OutlinedButton.icon(
                      onPressed: () => shareReceipt(context, payment, locale),
                      icon: const Icon(Icons.ios_share_rounded),
                      label: Text(l10n.shareReceipt),
                    ),
                    const SizedBox(height: 8),
                  ],
                  TextButton.icon(
                    onPressed: () => showReportProblemSheet(
                      context,
                      ref,
                      paymentId: payment.id,
                    ),
                    style: TextButton.styleFrom(
                      foregroundColor: context.xd.textSecondary,
                      minimumSize: const Size.fromHeight(48),
                    ),
                    icon: const Icon(Icons.flag_outlined, size: 20),
                    label: Text(l10n.reportProblem),
                  ),
                ],
              ),
            ),
    );
  }
}
