import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../payments/data/payment_models.dart';
import '../../payments/presentation/status_pill.dart';

/// In-app receipt (FR-RCP-03): reference, Kigali date/time, seller, amounts,
/// rate, card total, card, status. Simulated payments say so. Drawn as a
/// ticket: seller and amount on top, details below a perforated tear line.
class ReceiptCard extends StatelessWidget {
  const ReceiptCard({required this.payment, required this.locale, super.key});

  final Payment payment;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final when = payment.completedAt ?? payment.createdAt;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TicketHalf(
          top: true,
          child: Column(
            children: [
              InitialsAvatar(name: payment.payeeName, size: 52),
              const SizedBox(height: 12),
              Text(
                payment.payeeName,
                textAlign: TextAlign.center,
                style: theme.titleLarge,
              ),
              const SizedBox(height: 2),
              Text(
                '${l10n.mtnMomo} · ${payment.payeeMasked}',
                style: theme.bodySmall?.copyWith(
                  color: context.xd.textSecondary,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                formatRwf(payment.amountRwf, locale),
                style: theme.displaySmall,
              ),
              const SizedBox(height: 10),
              StatusPill(status: payment.status),
            ],
          ),
        ),
        const _TicketHalf(
          top: false,
          perforation: true,
          child: SizedBox.shrink(),
        ),
        _TicketHalf(
          top: false,
          child: Column(
            children: [
              _row(context, l10n.reference, payment.reference, strong: true),
              _row(context, l10n.dateTime, formatKigaliDateTime(when, locale)),
              _row(
                context,
                l10n.sellerReceives,
                formatRwf(payment.amountRwf, locale),
              ),
              _row(
                context,
                l10n.xendirektFee,
                formatRwf(payment.feeRwf, locale),
              ),
              _row(
                context,
                l10n.exchangeRate,
                payment.fxRateDisplay,
                muted: true,
              ),
              _row(context, l10n.cardCharged, payment.cardLabel),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: DashedDivider(),
              ),
              Row(
                children: [
                  Text(l10n.youPay, style: theme.titleMedium),
                  const Spacer(),
                  Text(
                    payment.totalCardDisplay,
                    style: theme.titleLarge?.copyWith(
                      color: context.xd.accentText,
                    ),
                  ),
                ],
              ),
              if (payment.simulated) ...[
                const SizedBox(height: 16),
                TagPill(
                  l10n.sandboxReceiptNote,
                  tone: PillTone.warning,
                  icon: Icons.science_outlined,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _row(
    BuildContext context,
    String label,
    String value, {
    bool strong = false,
    bool muted = false,
  }) {
    final theme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.bodyMedium?.copyWith(color: context.xd.textSecondary),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: (strong ? theme.titleSmall : theme.bodyMedium)?.copyWith(
                fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
                color: muted
                    ? context.xd.textSecondary
                    : context.xd.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One part of the ticket. The top part has rounded top corners, the bottom
/// part rounded bottom corners; the [perforation] strip between them has a
/// semicircular notch on each side and a dashed tear line.
class _TicketHalf extends StatelessWidget {
  const _TicketHalf({
    required this.top,
    required this.child,
    this.perforation = false,
  });

  final bool top;
  final bool perforation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (perforation) {
      return SizedBox(
        height: 24,
        child: CustomPaint(
          painter: _PerforationPainter(color: context.xd.surface1),
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 22),
            child: Center(child: DashedDivider()),
          ),
        ),
      );
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.xd.surface1,
        borderRadius: top
            ? const BorderRadius.vertical(top: Radius.circular(24))
            : const BorderRadius.vertical(bottom: Radius.circular(24)),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, top ? 24 : 6, 20, top ? 14 : 20),
        child: child,
      ),
    );
  }
}

class _PerforationPainter extends CustomPainter {
  const _PerforationPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final notch = size.height / 2;
    final path = Path.combine(
      PathOperation.difference,
      Path()..addRect(rect),
      Path()
        ..addOval(
          Rect.fromCircle(center: Offset(0, size.height / 2), radius: notch),
        )
        ..addOval(
          Rect.fromCircle(
            center: Offset(size.width, size.height / 2),
            radius: notch,
          ),
        ),
    );
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _PerforationPainter oldDelegate) =>
      oldDelegate.color != color;
}

Future<void> shareReceipt(
  BuildContext context,
  Payment payment,
  String locale,
) async {
  final l10n = AppLocalizations.of(context);
  final text = l10n.receiptShareText(
    payment.reference,
    formatRwf(payment.amountRwf, locale),
    payment.payeeName,
    formatKigaliDateTime(payment.completedAt ?? payment.createdAt, locale),
    payment.totalCardDisplay,
    payment.cardLabel,
  );
  await SharePlus.instance.share(
    ShareParams(
      text: payment.simulated ? '$text\n${l10n.sandboxReceiptNote}' : text,
    ),
  );
}
