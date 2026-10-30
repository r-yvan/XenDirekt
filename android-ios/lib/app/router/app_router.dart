import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/authentication/application/session_controller.dart';
import '../../features/authentication/presentation/biometric_offer_screen.dart';
import '../../features/authentication/presentation/lock_screen.dart';
import '../../features/authentication/presentation/otp_screen.dart';
import '../../features/authentication/presentation/pin_setup_screen.dart';
import '../../features/authentication/presentation/sign_in_screen.dart';
import '../../features/history/presentation/history_screen.dart';
import '../../features/onboarding/presentation/splash_screen.dart';
import '../../features/onboarding/presentation/welcome_screen.dart';
import '../../features/payments/presentation/pay_screen.dart';
import '../../features/profile/presentation/complete_profile_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../providers.dart';
import 'home_shell.dart';
import 'routes.dart';

/// Pure redirect rule, unit-tested: the session decides where the user may be.
String? redirectFor(
  SessionState session,
  String location, {
  required bool biometricsOffered,
}) {
  switch (session.phase) {
    case SessionPhase.restoring:
      return location == Routes.splash ? null : Routes.splash;
    case SessionPhase.signedOut:
      return Routes.publicRoutes.contains(location) ? null : Routes.welcome;
    case SessionPhase.signedIn:
      if (session.locked) {
        return location == Routes.lock ? null : Routes.lock;
      }
      if (session.needsProfile) {
        return location == Routes.completeProfile
            ? null
            : Routes.completeProfile;
      }
      if (session.needsPin) {
        return location == Routes.setPin ? null : Routes.setPin;
      }
      final onboardingOrPublic =
          Routes.publicRoutes.contains(location) ||
          {
            Routes.splash,
            Routes.lock,
            Routes.completeProfile,
            Routes.setPin,
          }.contains(location);
      if (onboardingOrPublic) {
        return biometricsOffered ? Routes.pay : Routes.biometrics;
      }
      return null;
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(sessionControllerProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: Routes.pay,
    refreshListenable: refresh,
    redirect: (context, state) => redirectFor(
      ref.read(sessionControllerProvider),
      state.matchedLocation,
      biometricsOffered: ref.read(preferencesProvider).biometricsOffered,
    ),
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.welcome, builder: (_, _) => const WelcomeScreen()),
      GoRoute(
        path: Routes.signInEmail,
        builder: (_, _) => const SignInScreen(channel: 'EMAIL'),
      ),
      GoRoute(
        path: Routes.signInPhone,
        builder: (_, _) => const SignInScreen(channel: 'SMS'),
      ),
      GoRoute(
        path: Routes.verifyOtp,
        // No pending challenge (e.g. the app was restarted on this screen):
        // start sign-in again instead of crashing.
        redirect: (_, _) =>
            ref.read(pendingOtpProvider) == null ? Routes.welcome : null,
        builder: (_, _) {
          final args = ref.read(pendingOtpProvider);
          return args == null ? const WelcomeScreen() : OtpScreen(args: args);
        },
      ),
      GoRoute(
        path: Routes.completeProfile,
        builder: (_, _) => const CompleteProfileScreen(),
      ),
      GoRoute(path: Routes.setPin, builder: (_, _) => const PinSetupScreen()),
      GoRoute(
        path: Routes.biometrics,
        builder: (_, _) => const BiometricOfferScreen(),
      ),
      GoRoute(path: Routes.lock, builder: (_, _) => const LockScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: Routes.pay, builder: (_, _) => const PayScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.history,
                builder: (_, _) => const HistoryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.profile,
                builder: (_, _) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
