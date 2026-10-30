import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/motion/card_visual.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/motion/motion.dart';
import '../../../core/widgets/motion/pressable.dart';
import '../../../core/widgets/motion/shimmer.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../authentication/application/session_controller.dart';
import '../../authentication/application/step_up_coordinator.dart';
import '../../authentication/data/auth_models.dart';
import '../../cards/data/card_models.dart';
import '../../cards/presentation/cards_controller.dart';
import '../../notifications/presentation/inbox_screen.dart';
import '../../payee_lookup/data/payee_models.dart';
import '../../quotes/data/quote_models.dart';
import '../application/pay_controller.dart';
import 'payment_progress_screen.dart';

/// The home screen (PRD §5.0): type a number, the registered name appears, type
/// an amount, the summary updates live, tap Pay. No confirmation screen.
class PayScreen extends ConsumerStatefulWidget {
  const PayScreen({super.key});

  @override
  ConsumerState<PayScreen> createState() => _PayScreenState();
}

class _PayScreenState extends ConsumerState<PayScreen> {
  final _identifier = TextEditingController();
  final _amount = TextEditingController();
  final _amountFocus = FocusNode();
  bool _starting = false;
  int _taps = 0;
  String? _shownQuoteId;

  @override
  void initState() {
    super.initState();
    ref.read(analyticsProvider).track('pay_screen_opened');
  }

  @override
  void dispose() {
    _identifier.dispose();
    _amount.dispose();
    _amountFocus.dispose();
    super.dispose();
  }

  String get _locale => effectiveLanguage(ref.read(localeControllerProvider));

  void _selectRecent(RecentPayee payee) {
    _taps++;
    ref.read(payControllerProvider.notifier).selectRecent(payee);
    _identifier.text = payee.maskedIdentifier;
    if (payee.lastAmountRwf != null) {
      _amount.text = NumberFormat.decimalPattern(_locale)
          .format(payee.lastAmountRwf);
    }
    _amountFocus.requestFocus();
  }

  Future<void> _chooseCard(List<PaymentCard> cards) async {
    final l10n = AppLocalizations.of(context);
    final selected = ref.read(payControllerProvider).cardId;
    final picked = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.chooseCard,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              for (final card in cards) ...[
                Pressable(
                  onTap: () => Navigator.of(context).pop(card.id),
                  child: CardVisual(
                    brand: card.brand,
                    last4: card.last4,
                    expiry: card.expiryLabel,
                    compact: true,
                    selected: card.id == selected,
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (cards.length < 3)
                OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).pop('add'),
                  icon: const Icon(Icons.add_card),
                  label: Text(l10n.addCard),
                ),
            ],
          ),
        ),
      ),
    );
    if (!mounted || picked == null) {
      return;
    }
    if (picked == 'add') {
      await _addCard();
    } else {
      ref.read(payControllerProvider.notifier).selectCard(picked);
    }
  }

  Future<void> _addCard() async {
    try {
      final card = await ref
          .read(cardsControllerProvider.notifier)
          .addCard(context);
      if (card != null) {
        ref.read(payControllerProvider.notifier).selectCard(card.id);
      }
    } on ApiFailure catch (failure) {
      if (mounted) {
        _snack(messageForFailure(AppLocalizations.of(context), failure));
      }
    }
  }

  void _snack(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    }
  }

  Future<void> _pay() async {
    final l10n = AppLocalizations.of(context);
    final state = ref.read(payControllerProvider);
    final quote = state.quote;
    if (quote == null || _starting) {
      return;
    }
    if (quote.isExpired(DateTime.now())) {
      await ref.read(payControllerProvider.notifier).refreshQuote();
      _snack(l10n.errorQuoteExpired);
      return;
    }
    setState(() => _starting = true);
    _taps++;
    try {
      // FR-QTE-05: one tap on Pay starts biometric approval; PIN is the fallback.
      final stepUpToken = await ref
          .read(stepUpCoordinatorProvider)
          .obtain(context, StepUpPurpose.payment);
      if (stepUpToken == null || !mounted) {
        return;
      }
      ref.read(analyticsProvider)
        ..track('payment_confirmed', {'amountRwf': quote.amountRwf})
        ..taps(_taps > 1 ? 'pay_recent_merchant' : 'pay_new_merchant', _taps);
      _taps = 0;
      final attempt = PaymentAttempt(
        quote: quote,
        idempotencyKey: const Uuid().v4(),
        stepUpToken: stepUpToken,
        note: (state.note ?? '').trim().isEmpty ? null : state.note!.trim(),
      );
      final settled = await Navigator.of(context).push<bool>(
        PageRouteBuilder(
          transitionDuration: Motion.of(context, Motion.medium),
          pageBuilder: (_, _, _) => PaymentProgressScreen(attempt: attempt),
          transitionsBuilder: (_, animation, _, child) =>
              FadeTransition(opacity: animation, child: child),
        ),
      );
      if (settled == true && mounted) {
        _identifier.clear();
        _amount.clear();
        ref.read(payControllerProvider.notifier).reset();
        ref.invalidate(recentPayeesProvider);
      } else {
        await ref.read(payControllerProvider.notifier).refreshQuote();
      }
    } on ApiFailure catch (failure) {
      _snack(messageForFailure(l10n, failure));
    } finally {
      if (mounted) {
        setState(() => _starting = false);
      }
    }
  }

  String _greeting(AppLocalizations l10n) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? l10n.greetingMorning
        : hour < 17
        ? l10n.greetingAfternoon
        : l10n.greetingEvening;
    final name = ref.read(sessionControllerProvider).profile?.firstName;
    return name == null ? greeting : l10n.greetingWithName(greeting, name);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = effectiveLanguage(ref.watch(localeControllerProvider));
    final state = ref.watch(payControllerProvider);
    final cards = ref.watch(cardsControllerProvider);
    final recents = ref.watch(recentPayeesProvider);
    final unread = ref.watch(inboxProvider).value?.unread ?? 0;
    final cardList = cards.value ?? const <PaymentCard>[];
    final defaultCard =
        cardList.where((card) => card.isDefault).firstOrNull ??
        cardList.firstOrNull;
    ref.listen(cardsControllerProvider, (_, next) {
      final list = next.value ?? const <PaymentCard>[];
      final fallback =
          list.where((card) => card.isDefault).firstOrNull ?? list.firstOrNull;
      ref.read(payControllerProvider.notifier).ensureCard(fallback?.id);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(payControllerProvider.notifier).ensureCard(defaultCard?.id);
      }
    });
    final selectedCard =
        cardList.where((card) => card.id == state.cardId).firstOrNull ??
        defaultCard;
    final quote = state.quoteMatches ? state.quote : null;
    if (quote != null && quote.quoteId != _shownQuoteId) {
      _shownQuoteId = quote.quoteId;
      ref.read(analyticsProvider).track('quote_shown', {
        'amountRwf': quote.amountRwf,
        'cardCurrency': quote.cardCurrency,
      });
    }
    final showSummary =
        state.quoteError != null || quote != null || state.quoting;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            PageHeader(
              eyebrow: _greeting(l10n),
              title: l10n.payTitle,
              subtitle: l10n.paySubtitle,
              trailing: _InboxButton(unread: unread),
            ),
            if (recents.value case final list? when list.isNotEmpty) ...[
              SectionLabel(l10n.recentPayees),
              SizedBox(
                height: 88,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  clipBehavior: Clip.none,
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 12),
                  itemBuilder: (context, index) => FadeSlideIn.stagger(
                    index: index,
                    child: _RecentPayeeTile(
                      payee: list[index],
                      onTap: () => _selectRecent(list[index]),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),
            ],
            SectionLabel(l10n.sendTo),
            _IdentifierField(
              controller: _identifier,
              state: state,
              onChanged: (value) => ref
                  .read(payControllerProvider.notifier)
                  .identifierChanged(value),
            ),
            _PayeeReveal(state: state),
            const SizedBox(height: 24),
            SectionLabel(l10n.amountSection),
            _AmountField(
              controller: _amount,
              focusNode: _amountFocus,
              locale: locale,
              onChanged: (value) =>
                  ref.read(payControllerProvider.notifier).amountChanged(value),
            ),
            const SizedBox(height: 24),
            SectionLabel(l10n.payWithLabel),
            if (cards.isLoading && cardList.isEmpty)
              const Shimmer(child: SkeletonBox(height: 74, radius: 22))
            else if (selectedCard == null)
              XdCard(
                onTap: _addCard,
                semanticLabel: l10n.addCardToPay,
                borderColor: AppColors.brandOrange.withValues(alpha: 0.35),
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    const IconBadge(Icons.add_card_rounded, size: 46),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        l10n.addCardToPay,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.brandOrange,
                    ),
                  ],
                ),
              )
            else
              _CardRow(card: selectedCard, onTap: () => _chooseCard(cardList)),
            if (showSummary) ...[
              const SizedBox(height: 24),
              SectionLabel(
                l10n.summarySection,
                action: quote == null
                    ? null
                    : _QuoteTimer(expiresAt: quote.expiresAt),
              ),
              _SummaryCard(state: state, quote: quote, locale: locale),
            ],
            const SizedBox(height: 16),
            TextField(
              maxLength: 60,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: l10n.noteLabel,
                counterText: '',
                prefixIcon: const Icon(Icons.chat_bubble_outline_rounded),
              ),
              onChanged: (value) =>
                  ref.read(payControllerProvider.notifier).noteChanged(value),
            ),
          ],
        ),
      ),
      // The tab bar below already handles the bottom inset.
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
        decoration: BoxDecoration(
          color: context.xd.canvas,
          border: Border(top: BorderSide(color: context.xd.hairline)),
        ),
        child: PrimaryButton(
          label: quote == null
              ? l10n.payButton
              : '${l10n.payButton} ${quote.totalCardDisplay}',
          icon: Icons.lock_rounded,
          loading: _starting,
          onPressed: state.canPay(DateTime.now()) && !_starting ? _pay : null,
        ),
      ),
    );
  }
}

/// Bell with an unread dot; opens the in-app inbox.
class _InboxButton extends StatelessWidget {
  const _InboxButton({required this.unread});

  final int unread;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          IconButton(
            tooltip: l10n.notificationsTitle,
            style: IconButton.styleFrom(
              backgroundColor: context.xd.surface1,
              side: BorderSide(color: context.xd.hairline),
              fixedSize: const Size(46, 46),
            ),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const InboxScreen()),
            ),
            icon: const Icon(Icons.notifications_none_rounded, size: 22),
          ),
          if (unread > 0)
            Positioned(
              top: 6,
              right: 6,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: AppColors.brandOrange,
                  shape: BoxShape.circle,
                  border: Border.all(color: context.xd.canvas, width: 2),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _RecentPayeeTile extends StatelessWidget {
  const _RecentPayeeTile({required this.payee, required this.onTap});

  final RecentPayee payee;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = payee.registeredName.replaceFirst('SANDBOX ', '');
    return Pressable(
      onTap: onTap,
      semanticLabel: '${payee.registeredName}, ${payee.maskedIdentifier}',
      child: SizedBox(
        width: 68,
        child: Column(
          children: [
            InitialsAvatar(name: name, size: 54, muted: true),
            const SizedBox(height: 8),
            Text(
              name.split(' ').first,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _IdentifierField extends StatelessWidget {
  const _IdentifierField({
    required this.controller,
    required this.state,
    required this.onChanged,
  });

  final TextEditingController controller;
  final PayState state;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final Widget trailing;
    if (state.lookingUp) {
      trailing = const SizedBox.square(
        key: ValueKey('busy'),
        dimension: 20,
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    } else if (state.payee != null) {
      trailing = Icon(
        Icons.verified_rounded,
        key: const ValueKey('ok'),
        color: context.xd.statusSuccessText,
      );
    } else {
      trailing = const SizedBox.shrink(key: ValueKey('none'));
    }
    return TextField(
      controller: controller,
      keyboardType: TextInputType.phone,
      autofillHints: const [AutofillHints.telephoneNumber],
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9+ *\-]')),
      ],
      style: Theme.of(context).textTheme.titleLarge
          ?.copyWith(letterSpacing: 0.4),
      decoration: InputDecoration(
        labelText: l10n.momoNumberLabel,
        hintText: l10n.momoNumberHint,
        prefixIcon: Padding(
          padding: const EdgeInsets.only(left: 12, right: 10),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFFFFCC00),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text(
              'MTN',
              style: TextStyle(
                color: AppColors.brandBlack,
                fontWeight: FontWeight.w900,
                fontSize: 12,
                letterSpacing: 0,
              ),
            ),
          ),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        suffixIcon: Padding(
          padding: const EdgeInsets.all(14),
          child: AnimatedSwitcher(
            duration: Motion.of(context, Motion.fast),
            child: trailing,
          ),
        ),
      ),
      onChanged: onChanged,
    );
  }
}

/// The registered name appears in large type before any charge (FR-PAY-03, AC-2).
class _PayeeReveal extends StatelessWidget {
  const _PayeeReveal({required this.state});

  final PayState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    Widget child = const SizedBox.shrink(key: ValueKey('empty'));
    if (state.payee case final payee?) {
      child = Padding(
        key: ValueKey(payee.payeeId),
        padding: const EdgeInsets.only(top: 12),
        child: XdCard(
          borderColor: context.xd.statusSuccessText.withValues(alpha: 0.3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  InitialsAvatar(name: payee.registeredName, size: 46),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.registeredNameVerified,
                          style: theme.labelSmall?.copyWith(
                            color: context.xd.statusSuccessText,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Semantics(
                          header: true,
                          child: Text(
                            payee.registeredName,
                            style: theme.headlineSmall,
                          ),
                        ),
                        Text(
                          '${l10n.mtnMomo} · ${payee.maskedIdentifier}',
                          style: theme.bodySmall?.copyWith(
                            color: context.xd.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.brandOrange.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.record_voice_over_outlined,
                      size: 18,
                      color: AppColors.brandOrange,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(l10n.checkNameHint, style: theme.bodySmall),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    } else if (state.lookupError case final error?) {
      child = Padding(
        key: ValueKey(error.code),
        padding: const EdgeInsets.only(top: 12),
        child: InlineError(messageForFailure(l10n, error)),
      );
    } else if (state.lookingUp) {
      child = const Padding(
        key: ValueKey('looking'),
        padding: EdgeInsets.only(top: 12),
        child: Shimmer(child: SkeletonBox(height: 120, radius: 22)),
      );
    }
    return AnimatedSize(
      duration: Motion.of(context, Motion.medium),
      curve: Motion.emphasized,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
        duration: Motion.of(context, Motion.medium),
        transitionBuilder: (child, animation) => FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween(
              begin: const Offset(0, 0.06),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        ),
        child: child,
      ),
    );
  }
}

class _AmountField extends StatelessWidget {
  const _AmountField({
    required this.controller,
    required this.focusNode,
    required this.locale,
    required this.onChanged,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final String locale;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final style = Theme.of(context).textTheme.displayMedium;
    return XdCard(
      onTap: focusNode.requestFocus,
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 22),
      child: Column(
        children: [
          const TagPill('RWF', tone: PillTone.brand, dot: false),
          const SizedBox(height: 10),
          IntrinsicWidth(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                _GroupingFormatter(locale),
                LengthLimitingTextInputFormatter(11),
              ],
              style: style,
              decoration: InputDecoration(
                hintText: '0',
                hintStyle: style?.copyWith(
                  color: context.xd.textTertiary.withValues(alpha: 0.35),
                ),
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
              onChanged: onChanged,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            l10n.amountLabel,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: context.xd.textTertiary),
          ),
        ],
      ),
    );
  }
}

/// The selected card as a compact row; tap to choose another.
class _CardRow extends StatelessWidget {
  const _CardRow({required this.card, required this.onTap});

  final PaymentCard card;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    return XdCard(
      onTap: onTap,
      semanticLabel: l10n.chooseCard,
      padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
      child: Row(
        children: [
          MiniCardArt(brand: card.brand, width: 52),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${card.brandLabel} •••• ${card.last4}',
                  style: theme.titleMedium,
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.cardExpires(card.expiryLabel),
                  style: theme.bodySmall?.copyWith(
                    color: context.xd.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.unfold_more_rounded, color: context.xd.textTertiary),
        ],
      ),
    );
  }
}

/// "Rate held for 4:32": the quote's remaining validity, ticking each second.
class _QuoteTimer extends StatefulWidget {
  const _QuoteTimer({required this.expiresAt});

  final DateTime expiresAt;

  @override
  State<_QuoteTimer> createState() => _QuoteTimerState();
}

class _QuoteTimerState extends State<_QuoteTimer> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final left = widget.expiresAt.difference(DateTime.now());
    if (left.isNegative) {
      return TagPill(l10n.quoteRefreshing, tone: PillTone.warning);
    }
    final minutes = left.inMinutes;
    final seconds = (left.inSeconds % 60).toString().padLeft(2, '0');
    return TagPill(
      l10n.rateHeldFor('$minutes:$seconds'),
      icon: Icons.timer_outlined,
      tone: left.inSeconds < 60 ? PillTone.warning : PillTone.neutral,
    );
  }
}

/// Groups digits as the user types (12 000 / 12,000), keeping the cursor at the end.
class _GroupingFormatter extends TextInputFormatter {
  _GroupingFormatter(this.locale);

  final String locale;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) {
      return const TextEditingValue();
    }
    final formatted = NumberFormat.decimalPattern(locale)
        .format(int.parse(digits));
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

/// Live summary (FR-QTE-03): every figure comes from the server quote.
class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.state,
    required this.quote,
    required this.locale,
  });

  final PayState state;
  final Quote? quote;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    Widget body;
    if (state.quoteError case final error?) {
      body = InlineError(
        messageForFailure(l10n, error),
        key: const ValueKey('error'),
      );
    } else if (quote case final quote?) {
      body = Column(
        key: const ValueKey('quote'),
        children: [
          _row(
            context,
            l10n.sellerReceives,
            formatRwf(quote.amountRwf, locale),
          ),
          _row(context, l10n.xendirektFee, formatRwf(quote.feeRwf, locale)),
          _row(context, l10n.exchangeRate, quote.fxRateDisplay, muted: true),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: DashedDivider(),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(l10n.youPay, style: theme.titleMedium),
              const Spacer(),
              Text(
                quote.totalCardDisplay,
                style: theme.headlineMedium?.copyWith(
                  color: context.xd.accentText,
                ),
              ),
            ],
          ),
        ],
      );
    } else {
      body = const Shimmer(
        key: ValueKey('loading'),
        child: Column(
          children: [
            SkeletonBox(),
            SizedBox(height: 12),
            SkeletonBox(),
            SizedBox(height: 12),
            SkeletonBox(width: 160, height: 24),
          ],
        ),
      );
    }
    return XdCard(
      child: AnimatedSwitcher(
        duration: Motion.of(context, Motion.medium),
        child: body,
      ),
    );
  }

  Widget _row(
    BuildContext context,
    String label,
    String value, {
    bool muted = false,
  }) {
    final theme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Text(
            label,
            style: theme.bodyMedium?.copyWith(color: context.xd.textSecondary),
          ),
          const Spacer(),
          Text(
            value,
            style: theme.titleSmall?.copyWith(
              color: muted ? context.xd.textSecondary : context.xd.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
