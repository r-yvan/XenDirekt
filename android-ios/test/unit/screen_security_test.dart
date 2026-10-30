import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:xendirekt/core/security/screen_security.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'stacked secure screens clear the flag only when the last one closes',
    () async {
      final calls = <String>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('xendirekt/screen_security'),
            (call) async {
              calls.add(call.method);
              return null;
            },
          );

      await ScreenSecurity.enable(); // payment screen
      await ScreenSecurity.enable(); // PIN sheet on top
      await ScreenSecurity.disable(); // sheet closes: still secure
      expect(calls, ['enable']);
      await ScreenSecurity.disable(); // payment screen closes
      await ScreenSecurity.disable(); // extra call is harmless
      expect(calls, ['enable', 'disable']);
    },
  );
}
