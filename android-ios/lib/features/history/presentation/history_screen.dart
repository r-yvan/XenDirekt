import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/motion/pressable.dart';
import '../../../core/widgets/motion/shimmer.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../payments/data/payment_models.dart';
import '../../payments/presentation/status_pill.dart';
import '../../receipts/presentation/receipt_screen.dart';

/// History (FR-HIS-01): newest first, status chips, filter by status.
class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  static const _filters = [
    'ALL',
    'COMPLETED',
    'IN_PROGRESS',
    'FAILED',
    'IN_REVIEW',
    'REFUNDED',
  ];
  String _filter = 'ALL';
  final List<Payment> _payments = [];
  String? _cursor;
  bool _loading = true;
  bool _loadingMore = false;
  ApiFailure? _error;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref.read(paymentsApiProvider).list(status: _filter);
      setState(() {
        _payments
          ..clear()
          ..addAll(page.payments);
        _cursor = page.nextCursor;
      });
    } on ApiFailure catch (failure) {
      setState(() => _error = failure);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _more() async {
    if (_cursor == null || _loadingMore) {
      return;
    }
    setState(() => _loadingMore = true);
    try {
      final page = await ref
          .read(paymentsApiProvider)
          .list(status: _filter, cursor: _cursor);
      setState(() {
        _payments.addAll(page.payments);
        _cursor = page.nextCursor;
      });
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
        setState(() => _loadingMore = false);
      }
    }
  }

  String _filterLabel(AppLocalizations l10n, String filter) => switch (filter) {
    'COMPLETED' => l10n.statusCompleted,
    'IN_PROGRESS' => l10n.statusInProgress,
    'FAILED' => l10n.statusFailed,
    'IN_REVIEW' => l10n.statusInReview,
    'REFUNDED' => l10n.statusRefunded,
    _ => l10n.filterAll,
  };

  String _dayLabel(AppLocalizations l10n, String locale, DateTime date) {
    final day = DateUtils.dateOnly(toKigali(date));
    final today = DateUtils.dateOnly(toKigali(DateTime.now()));
    if (day == today) {
      return l10n.today;
    }
    if (day == today.subtract(const Duration(days: 1))) {
      return l10n.yesterday;
    }
    return DateFormat.yMMMMd(locale).format(day);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = effectiveLanguage(ref.watch(localeControllerProvider));
    final grouped = <String, List<Payment>>{};
    for (final payment in _payments) {
      grouped
          .putIfAbsent(_dayLabel(l10n, locale, payment.createdAt), () => [])
          .add(payment);
    }
    var index = 0;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: PageHeader(
                title: l10n.historyTitle,
                subtitle: l10n.historySubtitle,
              ),
            ),
            SizedBox(
              height: 40,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                scrollDirection: Axis.horizontal,
                itemCount: _filters.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final filter = _filters[i];
                  return _FilterPill(
                    label: _filterLabel(l10n, filter),
                    selected: _filter == filter,
                    onTap: () {
                      if (_filter == filter) {
                        return;
                      }
                      setState(() => _filter = filter);
                      _reload();
                    },
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.brandOrange,
                backgroundColor: context.xd.surface2,
                onRefresh: _reload,
                child: _loading
                    ? ListView(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                        children: const [
                          Shimmer(child: SkeletonBox(width: 90, height: 14)),
                          SizedBox(height: 12),
                          Shimmer(child: SkeletonBox(height: 220, radius: 22)),
                        ],
                      )
                    : _error != null
                    ? ListView(
                        children: [
                          const SizedBox(height: 40),
                          ErrorView(
                            message: messageForFailure(l10n, _error!),
                            onRetry: _reload,
                          ),
                        ],
                      )
                    : _payments.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 48),
                          EmptyView(
                            icon: Icons.receipt_long_rounded,
                            title: l10n.noPaymentsTitle,
                            message: l10n.noPayments,
                            action: _filter == 'ALL'
                                ? SizedBox(
                                    width: 220,
                                    child: FilledButton.icon(
                                      onPressed: () =>
                                          StatefulNavigationShell.maybeOf(
                                            context,
                                          )?.goBranch(0),
                                      icon: const Icon(
                                        Icons.storefront_rounded,
                                      ),
                                      label: Text(l10n.makePayment),
                                    ),
                                  )
                                : null,
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                        children: [
                          for (final entry in grouped.entries) ...[
                            SectionLabel(entry.key),
                            FadeSlideIn.stagger(
                              index: index++,
                              child: XdCard(
                                padding: EdgeInsets.zero,
                                child: Column(
                                  children: [
                                    for (final (i, payment)
                                        in entry.value.indexed) ...[
                                      if (i > 0)
                                        const Divider(indent: 72, height: 1),
                                      PaymentTile(
                                        payment: payment,
                                        locale: locale,
                                        onTap: () async {
                                          await Navigator.of(context).push(
                                            MaterialPageRoute<void>(
                                              builder: (_) => ReceiptScreen(
                                                paymentId: payment.id,
                                                initial: payment,
                                              ),
                                            ),
                                          );
                                          await _reload();
                                        },
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 22),
                          ],
                          if (_cursor != null)
                            Center(
                              child: _loadingMore
                                  ? const Padding(
                                      padding: EdgeInsets.all(16),
                                      child: SizedBox.square(
                                        dimension: 24,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.4,
                                        ),
                                      ),
                                    )
                                  : OutlinedButton(
                                      onPressed: _more,
                                      style: OutlinedButton.styleFrom(
                                        minimumSize: const Size(160, 46),
                                      ),
                                      child: Text(l10n.loadMore),
                                    ),
                            ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      child: Pressable(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected
                ? AppColors.brandOrange.withValues(alpha: 0.14)
                : context.xd.surface1,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected
                  ? AppColors.brandOrange.withValues(alpha: 0.55)
                  : context.xd.hairline,
            ),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: selected
                  ? context.xd.accentText
                  : context.xd.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class PaymentTile extends StatelessWidget {
  const PaymentTile({
    required this.payment,
    required this.locale,
    required this.onTap,
    super.key,
  });

  final Payment payment;
  final String locale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final time = DateFormat.Hm(locale).format(toKigali(payment.createdAt));
    final name = payment.payeeName.replaceFirst('SANDBOX ', '');
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
          child: Row(
            children: [
              InitialsAvatar(name: name, size: 44, muted: true),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      payment.payeeName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.titleSmall,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '$time · ${payment.cardLabel}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.bodySmall?.copyWith(
                        color: context.xd.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatRwf(payment.amountRwf, locale),
                    style: theme.titleSmall,
                  ),
                  const SizedBox(height: 5),
                  StatusPill(status: payment.status),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
