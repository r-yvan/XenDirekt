import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/widgets/motion/card_visual.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/motion/pressable.dart';
import '../../../core/widgets/motion/shimmer.dart';
import '../../../core/widgets/ui_kit.dart';
import '../data/card_models.dart';
import 'cards_controller.dart';

const _maxCards = 3;

/// Cards on the Profile screen (FR-CRD-04/05): brand, last 4, expiry, default, remove.
class CardsSection extends ConsumerWidget {
  const CardsSection({super.key});

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final card = await ref
          .read(cardsControllerProvider.notifier)
          .addCard(context);
      if (card != null) {
        messenger.showSnackBar(SnackBar(content: Text(l10n.cardAdded)));
      }
    } on ApiFailure catch (failure) {
      messenger.showSnackBar(
        SnackBar(content: Text(messageForFailure(l10n, failure))),
      );
    }
  }

  Future<void> _remove(
    BuildContext context,
    WidgetRef ref,
    PaymentCard card,
  ) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final undo = Completer<bool>();
    final snack = messenger.showSnackBar(
      SnackBar(
        content: Text(l10n.cardRemoved),
        duration: const Duration(seconds: 5),
        action: SnackBarAction(
          label: l10n.undo,
          onPressed: () => undo.complete(true),
        ),
      ),
    );
    unawaited(
      snack.closed.then((_) {
        if (!undo.isCompleted) {
          undo.complete(false);
        }
      }),
    );
    try {
      await ref
          .read(cardsControllerProvider.notifier)
          .removeWithUndo(card.id, undoRequested: () => undo.future);
    } on ApiFailure catch (failure) {
      messenger.showSnackBar(
        SnackBar(content: Text(messageForFailure(l10n, failure))),
      );
    }
  }

  Future<void> _actions(
    BuildContext context,
    WidgetRef ref,
    PaymentCard card,
  ) async {
    final l10n = AppLocalizations.of(context);
    final action = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CardVisual(
                brand: card.brand,
                last4: card.last4,
                expiry: card.expiryLabel,
                badge: card.isDefault ? l10n.defaultCard : null,
              ),
              const SizedBox(height: 18),
              SettingsGroup(
                children: [
                  if (!card.isDefault)
                    SettingsRow(
                      icon: Icons.star_outline_rounded,
                      title: l10n.makeDefault,
                      onTap: () => Navigator.of(context).pop('default'),
                    ),
                  SettingsRow(
                    icon: Icons.delete_outline_rounded,
                    title: l10n.removeCard,
                    destructive: true,
                    showChevron: false,
                    onTap: () => Navigator.of(context).pop('remove'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (!context.mounted) {
      return;
    }
    if (action == 'default') {
      await ref.read(cardsControllerProvider.notifier).makeDefault(card.id);
    } else if (action == 'remove') {
      await _remove(context, ref, card);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final cards = ref.watch(cardsControllerProvider);
    final count = cards.value?.length ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionLabel(
          l10n.cardsSection,
          action: cards.hasValue
              ? Text(
                  l10n.cardsCount(count),
                  style: theme.labelMedium?.copyWith(
                    color: context.xd.textTertiary,
                  ),
                )
              : null,
        ),
        switch (cards) {
          AsyncData(:final value) when value.isEmpty => XdCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const IconBadge(Icons.add_card_rounded, size: 46),
                const SizedBox(height: 14),
                Text(l10n.addFirstCardTitle, style: theme.titleLarge),
                const SizedBox(height: 6),
                Text(
                  l10n.addFirstCardBody,
                  style: theme.bodyMedium?.copyWith(
                    color: context.xd.textSecondary,
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => _add(context, ref),
                  icon: const Icon(Icons.add_rounded),
                  label: Text(l10n.addCard),
                ),
              ],
            ),
          ),
          AsyncData(:final value) => SizedBox(
            height: 190,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              itemCount: value.length + (value.length < _maxCards ? 1 : 0),
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, index) {
                if (index == value.length) {
                  return _AddCardTile(onTap: () => _add(context, ref));
                }
                final card = value[index];
                return FadeSlideIn.stagger(
                  index: index,
                  child: SizedBox(
                    width: 300,
                    child: Pressable(
                      onTap: () => _actions(context, ref, card),
                      child: CardVisual(
                        brand: card.brand,
                        last4: card.last4,
                        expiry: card.expiryLabel,
                        badge: card.isDefault ? l10n.defaultCard : null,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          AsyncError(:final error) => XdCard(
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    messageForFailure(l10n, error),
                    style: theme.bodyMedium,
                  ),
                ),
                TextButton(
                  onPressed: () =>
                      ref.read(cardsControllerProvider.notifier).refresh(),
                  child: Text(l10n.retry),
                ),
              ],
            ),
          ),
          _ => const Shimmer(child: SkeletonBox(height: 190, radius: 22)),
        },
      ],
    );
  }
}

class _AddCardTile extends StatelessWidget {
  const _AddCardTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Pressable(
      onTap: onTap,
      semanticLabel: l10n.addCard,
      child: CustomPaint(
        painter: _DashedBorderPainter(),
        child: SizedBox(
          width: 140,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const IconBadge(Icons.add_rounded, size: 44),
              const SizedBox(height: 12),
              Text(l10n.addCard, style: Theme.of(context).textTheme.titleSmall),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(22),
    );
    final paint = Paint()
      ..color = AppColors.brandOrange.withValues(alpha: 0.45)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    final path = Path()..addRRect(rect);
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + 7), paint);
        distance += 12;
      }
    }
    canvas.drawRRect(
      rect,
      Paint()..color = AppColors.brandOrange.withValues(alpha: 0.04),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
