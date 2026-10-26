import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../data/card_models.dart';
import 'cards_controller.dart';

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
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(
                '${card.brandLabel} •••• ${card.last4}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            if (!card.isDefault)
              ListTile(
                leading: const Icon(Icons.star_outline),
                title: Text(l10n.makeDefault),
                onTap: () => Navigator.of(context).pop('default'),
              ),
            ListTile(
              leading: const Icon(
                Icons.delete_outline,
                color: AppColors.statusErrorText,
              ),
              title: Text(l10n.removeCard),
              onTap: () => Navigator.of(context).pop('remove'),
            ),
          ],
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
    final cards = ref.watch(cardsControllerProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          child: Text(
            l10n.cardsSection,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        ...switch (cards) {
          AsyncData(:final value) => [
            if (value.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  l10n.noCards,
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ),
            for (final card in value)
              ListTile(
                leading: const Icon(Icons.credit_card),
                title: Text('${card.brandLabel} •••• ${card.last4}'),
                subtitle: Text(l10n.cardExpires(card.expiryLabel)),
                trailing: card.isDefault
                    ? Chip(label: Text(l10n.defaultCard))
                    : null,
                onTap: () => _actions(context, ref, card),
              ),
            if (value.length < 3)
              ListTile(
                leading: const Icon(
                  Icons.add_card,
                  color: AppColors.brandOrange,
                ),
                title: Text(l10n.addCard),
                onTap: () => _add(context, ref),
              ),
          ],
          AsyncError(:final error) => [
            ListTile(
              title: Text(messageForFailure(l10n, error)),
              trailing: TextButton(
                onPressed: () =>
                    ref.read(cardsControllerProvider.notifier).refresh(),
                child: Text(l10n.retry),
              ),
            ),
          ],
          _ => [
            const Padding(
              padding: EdgeInsets.all(16),
              child: LinearProgressIndicator(),
            ),
          ],
        },
      ],
    );
  }
}
