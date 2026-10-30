import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// Blocks screenshots/recording on payment screens where the platform allows it
/// (Android FLAG_SECURE). iOS has no such API; the app-switcher cover in
/// AppLockObserver hides content there. Defence in depth only (NFR-SEC-07).
class ScreenSecurity {
  static const _channel = MethodChannel('xendirekt/screen_security');

  /// Secure screens can stack (a PIN sheet over a payment screen), so the flag
  /// is cleared only when the last one goes away.
  static int _holders = 0;

  /// Local design-review builds only (`--dart-define=XD_ALLOW_SCREENSHOTS=true`):
  /// lets QA capture PIN and payment screens. Off unless explicitly passed.
  static const bool _allowScreenshots = bool.fromEnvironment(
    'XD_ALLOW_SCREENSHOTS',
  );

  static Future<void> enable() async {
    if (_allowScreenshots) {
      return;
    }
    _holders++;
    if (_holders == 1) {
      await _invoke('enable');
    }
  }

  static Future<void> disable() async {
    if (_allowScreenshots || _holders == 0) {
      return;
    }
    _holders--;
    if (_holders == 0) {
      await _invoke('disable');
    }
  }

  static Future<void> _invoke(String method) async {
    try {
      await _channel.invokeMethod<void>(method);
    } on MissingPluginException {
      // iOS, tests and other platforms.
    } on PlatformException {
      // Never break a payment because of a cosmetic protection.
    }
  }
}

/// Wrap a payment or PIN screen: secure while visible.
class SecureScreen extends StatefulWidget {
  const SecureScreen({required this.child, super.key});

  final Widget child;

  @override
  State<SecureScreen> createState() => _SecureScreenState();
}

class _SecureScreenState extends State<SecureScreen> {
  @override
  void initState() {
    super.initState();
    ScreenSecurity.enable();
  }

  @override
  void dispose() {
    ScreenSecurity.disable();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
