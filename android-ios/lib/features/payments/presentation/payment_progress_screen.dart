import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/locale_controller.dart';
import '../../../app/localization/generated/app_localizations.dart';
import '../../../app/providers.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/errors/api_failure.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/security/screen_security.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/motion/animated_amount.dart';
import '../../../core/widgets/motion/fade_slide_in.dart';
import '../../../core/widgets/motion/motion.dart';
import '../../../core/widgets/motion/step_tracker.dart';
import '../../../core/widgets/motion/success_burst.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../quotes/data/quote_models.dart';
import '../../receipts/presentation/receipt_card.dart';
import '../data/payment_models.dart';

/// Everything needed to (re)submit a payment. The idempotency key is fixed for
/// the attempt, so resubmitting after a lost response can never charge twice.
class PaymentAttempt {
  const PaymentAttempt({
    required this.quote,
    required this.idempotencyKey,
    required this.stepUpToken,
    this.note,
  });

  final Quote quote;
  final String idempotencyKey;
  final String stepUpToken;
  final String? note;
}

/// Live status (FR-EXE-04): submits the attempt, then follows the payment until it
/// settles. On connectivity loss it shows "Checking your payment…" and resumes by
/// the same key and payment ID; it never creates a new charge (PRD §6).
class PaymentProgressScreen extends ConsumerStatefulWidget {
  const PaymentProgressScreen({required this.attempt, super.key});

  final PaymentAttempt attempt;

  @override
  ConsumerState<PaymentProgressScreen> createState() =>
      _PaymentProgressScreenState();
}

class _PaymentProgressScreenState extends ConsumerState<PaymentProgressScreen> {
  Payment? _payment;
  ApiFailure? _rejected;
  bool _offline = false;
  Timer? _timer;
  int _retries = 0;
  final Set<Uri> _openedActions = {};
  bool _actionOpen = false;

  @override
  void initState() {
    super.initState();
    unawaited(_submit());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Duration get _backoff =>
      Duration(seconds: [2, 3, 5, 8, 10][_retries.clamp(0, 4)]);

  Future<void> _submit() async {
    try {
      final payment = await ref
          .read(paymentsApiProvider)
          .create(
            quoteId: widget.attempt.quote.quoteId,
            idempotencyKey: widget.attempt.idempotencyKey,
            stepUpToken: widget.attempt.stepUpToken,
            note: widget.attempt.note,
          );
      _onPayment(payment);
    } on ApiFailure catch (failure) {
      if (!mounted) {
        return;
      }
      if (failure.isConnectivity) {
        // The request may or may not have arrived: retry with the SAME key.
        setState(() => _offline = true);
        _retries++;
        _timer = Timer(_backoff, _submit);
      } else {
        unawaited(HapticFeedback.heavyImpact());
        setState(() {
          _offline = false;
          _rejected = failure;
        });
      }
    }
  }

  Future<void> _poll() async {
    final current = _payment;
    if (current == null) {
      return;
    }
    try {
      _onPayment(await ref.read(paymentsApiProvider).get(current.id));
    } on ApiFailure catch (failure) {
      if (!mounted) {
        return;
      }
      setState(() => _offline = failure.isConnectivity);
      _retries++;
      _timer = Timer(_backoff, _poll);
    }
  }

  void _onPayment(Payment payment) {
    if (!mounted) {
      return;
    }
    final previous = _payment;
    setState(() {
      _payment = payment;
      _offline = false;
      _retries = 0;
    });
    if (previous?.status != payment.status) {
      if (payment.status == 'COMPLETED') {
        unawaited(HapticFeedback.heavyImpact());
      } else if (payment.status == 'FAILED') {
        unawaited(HapticFeedback.mediumImpact());
      }
    }
    final action = payment.nextAction;
    if (action != null && !_openedActions.contains(action.url)) {
      _openedActions.add(action.url);
      unawaited(_openAction());
    }
    if (!payment.isSettled && !payment.isInReview) {
      _timer = Timer(const Duration(seconds: 2), _poll);
    }
  }

  /// Opens the bank's 3-D Secure page (partner-hosted) and resumes polling after.
  Future<void> _openAction() async {
    final action = _payment?.nextAction;
    if (action == null || _actionOpen) {
      return;
    }
    _actionOpen = true;
    try {
      await ref
          .read(hostedPageLauncherProvider)
          .open(
            context,
            action.url,
            returnPrefix: action.returnUrlPrefix,
            title: AppLocalizations.of(context).confirmWithBank,
          );
    } finally {
      _actionOpen = false;
    }
    _timer?.cancel();
    unawaited(_poll());
  }

  void _close({required bool settled}) => Navigator.of(context).pop(settled);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = effectiveLanguage(ref.watch(localeControllerProvider));
    final payment = _payment;
    final Widget content;
    if (_rejected != null) {
      content = _Outcome(
        key: const ValueKey('rejected'),
        visual: _OutcomeIcon(
          icon: Icons.close_rounded,
          color: context.xd.statusErrorText,
        ),
        title: l10n.failedTitle,
        message: messageForFailure(l10n, _rejected!),
        charge: l10n.notCharged,
        primary: PrimaryButton(
          label: l10n.retry,
          onPressed: () => _close(settled: false),
        ),
      );
    } else if (payment == null) {
      content = _InFlight(
        key: const ValueKey('submitting'),
        quote: widget.attempt.quote,
        steps: const [false, false, false],
        offline: _offline,
        locale: locale,
      );
    } else if (payment.status == 'COMPLETED' || payment.status == 'REFUNDED') {
      content = _Outcome(
        key: const ValueKey('completed'),
        visual: const SuccessBurst(),
        title: payment.status == 'REFUNDED'
            ? l10n.refundedTitle
            : l10n.successTitle,
        message: l10n.successBody(
          payment.payeeName,
          formatRwf(payment.amountRwf, locale),
        ),
        details: ReceiptCard(payment: payment, locale: locale),
        primary: PrimaryButton(
          label: l10n.done,
          onPressed: () => _close(settled: true),
        ),
        secondary: TextButton.icon(
          onPressed: () => shareReceipt(context, payment, locale),
          icon: const Icon(Icons.ios_share_rounded),
          label: Text(l10n.shareReceipt),
        ),
      );
    } else if (payment.status == 'FAILED') {
      content = _Outcome(
        key: const ValueKey('failed'),
        visual: _OutcomeIcon(
          icon: Icons.close_rounded,
          color: context.xd.statusErrorText,
        ),
        title: l10n.failedTitle,
        message: failureMessage(l10n, payment.failureReason),
        charge: payment.chargeStatus == 'HOLD_RELEASING'
            ? l10n.holdReleasing
            : l10n.notCharged,
        primary: PrimaryButton(
          label: l10n.retry,
          onPressed: () => _close(settled: false),
        ),
        secondary: TextButton(
          onPressed: () => _close(settled: true),
          child: Text(l10n.done),
        ),
      );
    } else if (payment.isInReview) {
      content = _Outcome(
        key: const ValueKey('review'),
        visual: _OutcomeIcon(
          icon: Icons.hourglass_top_rounded,
          color: context.xd.statusWarning,
        ),
        title: l10n.reviewTitle,
        message: l10n.errorPendingReview,
        details: Text(
          '${l10n.reference}: ${payment.reference}',
          style: TextStyle(color: context.xd.textSecondary),
        ),
        primary: PrimaryButton(
          label: l10n.done,
          onPressed: () => _close(settled: true),
        ),
      );
    } else {
      content = _InFlight(
        key: const ValueKey('tracking'),
        quote: widget.attempt.quote,
        steps: [
          payment.steps.processing,
          payment.steps.sent,
          payment.steps.received,
        ],
        offline: _offline,
        locale: locale,
        actionRequired: payment.nextAction != null,
        onOpenAction: _openAction,
      );
    }

    return SecureScreen(
      child: PopScope(
        // While money may be moving, leaving is allowed but never cancels anything.
        canPop: payment == null
            ? _rejected != null
            : (payment.isSettled || payment.isInReview),
        child: Scaffold(
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: AnimatedSwitcher(
                duration: Motion.of(context, Motion.slow),
                switchInCurve: Motion.emphasized,
                transitionBuilder: (child, animation) =>
                    FadeTransition(opacity: animation, child: child),
                child: content,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String failureMessage(AppLocalizations l10n, String? reason) =>
    switch (reason) {
      'CARD_DECLINED' => l10n.errorCardDeclined,
      'THREE_DS_FAILED' || 'THREE_DS_ABANDONED' => l10n.errorThreeDsAbandoned,
      'PAYOUT_FAILED' => l10n.errorPayoutFailed,
      'CAPABILITY_NOT_CONFIGURED' => l10n.errorCapabilityNotConfigured,
      _ => l10n.errorGeneric,
    };

class _InFlight extends StatelessWidget {
  const _InFlight({
    required this.quote,
    required this.steps,
    required this.offline,
    required this.locale,
    this.actionRequired = false,
    this.onOpenAction,
    super.key,
  });

  final Quote quote;
  final List<bool> steps;
  final bool offline;
  final String locale;
  final bool actionRequired;
  final VoidCallback? onOpenAction;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Spacer(),
        XdCard(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
          child: Column(
            children: [
              InitialsAvatar(name: quote.payeeName, size: 56),
              const SizedBox(height: 12),
              Text(
                quote.payeeName,
                textAlign: TextAlign.center,
                style: theme.titleLarge,
              ),
              const SizedBox(height: 14),
              AnimatedAmount(
                value: quote.amountRwf,
                format: (value) => formatRwf(value, locale),
                style: theme.displaySmall,
              ),
              const SizedBox(height: 6),
              TagPill(quote.totalCardDisplay, icon: Icons.credit_card_rounded),
            ],
          ),
        ),
        const SizedBox(height: 32),
        StepTracker(
          labels: [l10n.stepProcessing, l10n.stepSent, l10n.stepReceived],
          done: steps,
        ),
        const SizedBox(height: 32),
        AnimatedSwitcher(
          duration: Motion.of(context, Motion.medium),
          child: actionRequired
              ? Column(
                  key: const ValueKey('action'),
                  children: [
                    Text(
                      l10n.confirmWithBankBody,
                      textAlign: TextAlign.center,
                      style: theme.bodyMedium?.copyWith(
                        color: context.xd.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    PrimaryButton(
                      label: l10n.openBankCheck,
                      icon: Icons.account_balance_rounded,
                      onPressed: onOpenAction,
                    ),
                  ],
                )
              : Semantics(
                  key: ValueKey(offline),
                  liveRegion: true,
                  child: Text(
                    offline ? l10n.checkingPayment : l10n.stepProcessing,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: offline
                          ? context.xd.statusWarning
                          : context.xd.textSecondary,
                    ),
                  ),
                ),
        ),
        const Spacer(flex: 2),
      ],
    );
  }
}

class _Outcome extends StatelessWidget {
  const _Outcome({
    required this.visual,
    required this.title,
    required this.message,
    required this.primary,
    this.charge,
    this.details,
    this.secondary,
    super.key,
  });

  final Widget visual;
  final String title;
  final String message;
  final String? charge;
  final Widget? details;
  final Widget primary;
  final Widget? secondary;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ListView(
            children: [
              const SizedBox(height: 16),
              Center(child: visual),
              FadeSlideIn(
                delay: const Duration(milliseconds: 250),
                child: Column(
                  children: [
                    Semantics(
                      header: true,
                      liveRegion: true,
                      child: Text(
                        title,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      message,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyLarge
                          ?.copyWith(color: context.xd.textSecondary),
                    ),
                    if (charge != null) ...[
                      const SizedBox(height: 14),
                      TagPill(
                        charge!,
                        tone: PillTone.success,
                        icon: Icons.check_circle_outline_rounded,
                      ),
                    ],
                    if (details != null) ...[
                      const SizedBox(height: 24),
                      details!,
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        FadeSlideIn(delay: const Duration(milliseconds: 400), child: primary),
        if (secondary != null) ...[
          const SizedBox(height: 8),
          Center(child: secondary),
        ],
      ],
    );
  }
}

class _OutcomeIcon extends StatelessWidget {
  const _OutcomeIcon({required this.icon, required this.color});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.6, end: 1),
      duration: Motion.of(context, Motion.medium),
      curve: Motion.spring,
      builder: (context, scale, child) =>
          Transform.scale(scale: scale, child: child),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 28),
        child: HaloIcon(icon, color: color, size: 150),
      ),
    );
  }
}
