import 'package:flutter_test/flutter_test.dart';
import 'package:xendirekt/app/router/app_router.dart';
import 'package:xendirekt/app/router/routes.dart';
import 'package:xendirekt/features/authentication/application/session_controller.dart';

import '../support/fake_auth_api.dart';

void main() {
  String? go(SessionState state, String location, {bool offered = true}) =>
      redirectFor(state, location, biometricsOffered: offered);

  test('restoring always shows the splash', () {
    const state = SessionState(phase: SessionPhase.restoring);
    expect(go(state, Routes.pay), Routes.splash);
    expect(go(state, Routes.splash), isNull);
  });

  test('signed-out users only see public routes', () {
    const state = SessionState(phase: SessionPhase.signedOut);
    expect(go(state, Routes.pay), Routes.welcome);
    expect(go(state, Routes.profile), Routes.welcome);
    expect(go(state, Routes.signInEmail), isNull);
  });

  test('profile, then PIN, are required before the app', () {
    final pending = SessionState(
      phase: SessionPhase.signedIn,
      profile: fixtureNewUserSignIn().user,
    );
    expect(go(pending, Routes.pay), Routes.completeProfile);
    final noPin = SessionState(
      phase: SessionPhase.signedIn,
      profile: fixtureActiveProfile(),
    );
    expect(go(noPin, Routes.pay), Routes.setPin);
    final ready = SessionState(
      phase: SessionPhase.signedIn,
      profile: fixtureActiveProfile(pinSet: true),
    );
    expect(go(ready, Routes.pay), isNull);
    expect(go(ready, Routes.setPin), Routes.pay);
    expect(go(ready, Routes.setPin, offered: false), Routes.biometrics);
  });

  test('a locked session cannot reach any other screen', () {
    final locked = SessionState(
      phase: SessionPhase.signedIn,
      profile: fixtureActiveProfile(pinSet: true),
      locked: true,
    );
    expect(go(locked, Routes.pay), Routes.lock);
    expect(go(locked, Routes.history), Routes.lock);
    expect(go(locked, Routes.lock), isNull);
  });
}
