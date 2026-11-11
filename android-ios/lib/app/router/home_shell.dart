import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/widgets/motion/motion.dart';
import '../../core/widgets/state_views.dart';
import '../../features/authentication/application/session_controller.dart';
import '../localization/generated/app_localizations.dart';
import '../theme/app_colors.dart';

/// Three bottom tabs only: Pay, History, Profile (PRD §5.0 rule 1).
class HomeShell extends ConsumerWidget {
  const HomeShell({required this.shell, super.key});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final sandbox = ref.watch(
      sessionControllerProvider.select((state) => state.isSandbox),
    );
    final paused = ref.watch(
      sessionControllerProvider.select((state) => state.paymentsPaused),
    );
    return Scaffold(
      body: Column(
        children: [
          if (sandbox || paused)
            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  if (sandbox) const SandboxBanner(),
                  if (paused) NoticeBanner(text: l10n.paymentsPausedBanner),
                ],
              ),
            ),
          // The banner already sits below the status bar; stop each tab
          // from adding the top inset a second time. This scaffold already
          // ends at the keyboard, so the tabs must not subtract it again.
          Expanded(
            child: MediaQuery.removeViewInsets(
              context: context,
              removeBottom: true,
              child: Builder(
                builder: (context) => MediaQuery.removePadding(
                  context: context,
                  removeTop: sandbox || paused,
                  child: _TabSwitchTransition(
                    index: shell.currentIndex,
                    child: shell,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _FloatingTabBar(
        currentIndex: shell.currentIndex,
        onSelected: (index) =>
            shell.goBranch(index, initialLocation: index == shell.currentIndex),
        tabs: [
          (Icons.storefront_outlined, Icons.storefront_rounded, l10n.tabPay),
          (
            Icons.receipt_long_outlined,
            Icons.receipt_long_rounded,
            l10n.tabHistory,
          ),
          (Icons.person_outline_rounded, Icons.person_rounded, l10n.tabProfile),
        ],
      ),
    );
  }
}

/// Fades and lifts the tab content in whenever the selected tab changes. The shell
/// keeps each tab's state (an IndexedStack), so this animates the one shell widget
/// rather than swapping two copies of it.
class _TabSwitchTransition extends StatefulWidget {
  const _TabSwitchTransition({required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  State<_TabSwitchTransition> createState() => _TabSwitchTransitionState();
}

class _TabSwitchTransitionState extends State<_TabSwitchTransition>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 220),
    value: 1,
  );
  late final Animation<double> _curve = CurvedAnimation(
    parent: _controller,
    curve: Motion.emphasized,
  );

  @override
  void didUpdateWidget(covariant _TabSwitchTransition oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.index != widget.index && !Motion.reduced(context)) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: Tween<double>(begin: 0.6, end: 1).animate(_curve),
    child: SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0, 0.006),
        end: Offset.zero,
      ).animate(_curve),
      child: widget.child,
    ),
  );
}

/// A suspended, fully rounded tab bar: it floats above the canvas with a margin,
/// and one orange-tinted pill slides to the selected tab.
class _FloatingTabBar extends StatelessWidget {
  const _FloatingTabBar({
    required this.currentIndex,
    required this.onSelected,
    required this.tabs,
  });

  final int currentIndex;
  final ValueChanged<int> onSelected;
  final List<(IconData, IconData, String)> tabs;

  @override
  Widget build(BuildContext context) {
    final xd = context.xd;
    final duration = Motion.of(context, const Duration(milliseconds: 300));
    final count = tabs.length;
    // viewPadding still holds the system gesture area even where padding was removed.
    final bottom = MediaQuery.viewPaddingOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 6, 16, bottom + 10),
      child: Container(
        height: 64,
        padding: const EdgeInsets.all(6),
        decoration: ShapeDecoration(
          color: xd.surface1,
          shape: StadiumBorder(side: BorderSide(color: xd.hairline)),
        ),
        child: Stack(
          children: [
            // The sliding pill behind the selected tab.
            AnimatedAlign(
              duration: duration,
              curve: Curves.easeOutCubic,
              alignment: Alignment(
                count == 1 ? 0 : -1 + 2 * currentIndex / (count - 1),
                0,
              ),
              child: FractionallySizedBox(
                widthFactor: 1 / count,
                heightFactor: 1,
                child: DecoratedBox(
                  decoration: ShapeDecoration(
                    color: AppColors.brandOrange.withValues(alpha: 0.14),
                    shape: const StadiumBorder(),
                  ),
                ),
              ),
            ),
            Row(
              children: [
                for (final (index, (icon, selectedIcon, label)) in tabs.indexed)
                  Expanded(
                    child: _TabPill(
                      icon: index == currentIndex ? selectedIcon : icon,
                      label: label,
                      selected: index == currentIndex,
                      onTap: () => onSelected(index),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TabPill extends StatelessWidget {
  const _TabPill({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final xd = context.xd;
    final duration = Motion.of(context, Motion.medium);
    final style = Theme.of(context).textTheme.labelMedium!;
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // The newly selected icon pops with a small spring.
              TweenAnimationBuilder<double>(
                key: ValueKey(selected),
                tween: Tween(begin: selected ? 0.88 : 1, end: 1),
                duration: duration,
                curve: Curves.easeOutBack,
                builder: (context, scale, child) =>
                    Transform.scale(scale: scale, child: child),
                child: TweenAnimationBuilder<Color?>(
                  tween: ColorTween(
                    end: selected ? xd.accentText : xd.textTertiary,
                  ),
                  duration: duration,
                  builder: (context, color, _) =>
                      Icon(icon, size: 22, color: color),
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: AnimatedDefaultTextStyle(
                  duration: duration,
                  curve: Motion.emphasized,
                  style: style.copyWith(
                    color: selected ? xd.textPrimary : xd.textTertiary,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
