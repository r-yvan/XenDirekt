import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../core/errors/api_failure.dart';
import '../data/card_models.dart';

/// Saved cards as the server reports them. Adding goes through the partner's
/// hosted page; the server decides eligibility.
class CardsController extends AsyncNotifier<List<PaymentCard>> {
  @override
  Future<List<PaymentCard>> build() => ref.read(cardsApiProvider).list();

  Future<void> refresh() async {
    state = await AsyncValue.guard(() => ref.read(cardsApiProvider).list());
  }

  /// Returns the new card, or null if the user closed the hosted page.
  Future<PaymentCard?> addCard(BuildContext context) async {
    final title = AppLocalizations.of(context).addCardTitle;
    final api = ref.read(cardsApiProvider);
    final session = await api.startSetup();
    if (!context.mounted) {
      return null;
    }
    final returned = await ref
        .read(hostedPageLauncherProvider)
        .open(
          context,
          session.hostedUrl,
          returnPrefix: session.returnUrlPrefix,
          title: title,
        );
    if (returned == null) {
      return null;
    }
    final card = await api.completeSetup(session.setupId);
    await refresh();
    return card;
  }

  Future<void> makeDefault(String cardId) async {
    await ref.read(cardsApiProvider).makeDefault(cardId);
    await refresh();
  }

  /// Hides the card immediately; removes it on the server only if not undone
  /// within 5 seconds (PRD §5.0 rule 6: Undo instead of confirmation).
  Future<void> removeWithUndo(
    String cardId, {
    required Future<bool> Function() undoRequested,
  }) async {
    final previous = state.value ?? const <PaymentCard>[];
    state = AsyncData(previous.where((card) => card.id != cardId).toList());
    if (await undoRequested()) {
      state = AsyncData(previous);
      return;
    }
    try {
      await ref.read(cardsApiProvider).remove(cardId);
    } on ApiFailure {
      state = AsyncData(previous);
      rethrow;
    }
    await refresh();
  }
}

final cardsControllerProvider =
    AsyncNotifierProvider<CardsController, List<PaymentCard>>(
      CardsController.new,
    );
