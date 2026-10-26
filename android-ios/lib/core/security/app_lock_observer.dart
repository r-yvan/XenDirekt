import 'package:flutter/widgets.dart';

/// Locks the app after 5 minutes in the background (NFR-SEC-04) and hides
/// content in the app switcher while inactive.
class AppLockObserver extends StatefulWidget {
  const AppLockObserver({
    required this.child,
    required this.onLockRequired,
    this.lockAfter = const Duration(minutes: 5),
    this.now = DateTime.now,
    super.key,
  });

  final Widget child;
  final VoidCallback onLockRequired;
  final Duration lockAfter;
  final DateTime Function() now;

  @override
  State<AppLockObserver> createState() => _AppLockObserverState();
}

class _AppLockObserverState extends State<AppLockObserver>
    with WidgetsBindingObserver {
  DateTime? _backgroundedAt;
  bool _obscured = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
        setState(() => _obscured = true);
      case AppLifecycleState.paused:
        _backgroundedAt ??= widget.now();
        setState(() => _obscured = true);
      case AppLifecycleState.resumed:
        final since = _backgroundedAt;
        _backgroundedAt = null;
        if (since != null &&
            widget.now().difference(since) >= widget.lockAfter) {
          widget.onLockRequired();
        }
        setState(() => _obscured = false);
      case AppLifecycleState.detached:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      textDirection: TextDirection.ltr,
      children: [
        widget.child,
        if (_obscured)
          const Positioned.fill(child: ColoredBox(color: Color(0xFF000000))),
      ],
    );
  }
}
