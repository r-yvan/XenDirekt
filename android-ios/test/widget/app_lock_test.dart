import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:xendirekt/core/security/app_lock_observer.dart';

void main() {
  testWidgets(
    'locks after 5 minutes in the background, not after a quick app switch',
    (tester) async {
      var now = DateTime(2026, 11, 2, 10);
      var locks = 0;
      await tester.pumpWidget(
        AppLockObserver(
          now: () => now,
          onLockRequired: () => locks++,
          child: const SizedBox.shrink(),
        ),
      );

      void lifecycle(AppLifecycleState state) =>
          tester.binding.handleAppLifecycleStateChanged(state);

      lifecycle(AppLifecycleState.inactive);
      lifecycle(AppLifecycleState.hidden);
      lifecycle(AppLifecycleState.paused);
      now = now.add(const Duration(minutes: 2));
      lifecycle(AppLifecycleState.hidden);
      lifecycle(AppLifecycleState.inactive);
      lifecycle(AppLifecycleState.resumed);
      await tester.pump();
      expect(locks, 0);

      lifecycle(AppLifecycleState.inactive);
      lifecycle(AppLifecycleState.hidden);
      lifecycle(AppLifecycleState.paused);
      now = now.add(const Duration(minutes: 5));
      lifecycle(AppLifecycleState.hidden);
      lifecycle(AppLifecycleState.inactive);
      lifecycle(AppLifecycleState.resumed);
      await tester.pump();
      expect(locks, 1);
    },
  );
}
