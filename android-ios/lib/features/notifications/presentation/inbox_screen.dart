import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/motion/pressable.dart';
import '../../../core/widgets/state_views.dart';
import '../../receipts/presentation/receipt_screen.dart';
import '../data/notifications_api.dart';

final inboxProvider = FutureProvider.autoDispose<Inbox>(
  (ref) => ref.watch(notificationsApiProvider).inbox(),
);

/// In-app notifications: payment outcomes always reach the user here, even when
/// push or SMS can't (FR-RCP-02, FR-HIS-03).
class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = effectiveLanguage(ref.watch(localeControllerProvider));
    final inbox = ref.watch(inboxProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.notificationsTitle)),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(inboxProvider.future),
        child: switch (inbox) {
          AsyncData(:final value) when value.items.isEmpty => ListView(
            children: [
              const SizedBox(height: 80),
              EmptyView(
                icon: Icons.notifications_none_rounded,
                message: l10n.noNotifications,
              ),
            ],
          ),
          AsyncData(:final value) => ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: value.items.length,
            itemBuilder: (context, index) {
              final item = value.items[index];
              return FadeSlideIn.stagger(
                index: index,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Pressable(
                    scale: 0.98,
                    onTap: () async {
                      if (!item.read) {
                        await ref
                            .read(notificationsApiProvider)
                            .markRead(item.id);
                        ref.invalidate(inboxProvider);
                      }
                      if (item.paymentId != null && context.mounted) {
                        await Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                ReceiptScreen(paymentId: item.paymentId!),
                          ),
                        );
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: context.xd.surface1,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: item.read
                              ? Colors.transparent
                              : AppColors.brandOrange.withValues(alpha: 0.5),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(_icon(item.kind), color: AppColors.brandOrange),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.title,
                                  style: TextStyle(
                                    fontWeight: item.read
                                        ? FontWeight.w600
                                        : FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  item.body,
                                  style: TextStyle(
                                    color: context.xd.textSecondary,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  DateFormat.MMMd(locale)
                                      .add_Hm()
                                      .format(toKigali(item.createdAt)),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: context.xd.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          AsyncError() => ListView(
            children: [
              ErrorView(
                message: l10n.errorNetwork,
                onRetry: () => ref.invalidate(inboxProvider),
              ),
            ],
          ),
          _ => const LoadingView(),
        },
      ),
    );
  }

  IconData _icon(String kind) => switch (kind) {
    'PAYMENT_COMPLETED' => Icons.check_circle_rounded,
    'PAYMENT_IN_REVIEW' => Icons.hourglass_top_rounded,
    'PAYMENT_REFUNDED' => Icons.undo_rounded,
    _ => Icons.info_outline_rounded,
  };
}
