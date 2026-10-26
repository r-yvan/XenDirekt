import '../../features/authentication/data/auth_models.dart';

abstract final class Routes {
  static const splash = '/splash';
  static const welcome = '/welcome';
  static const signInEmail = '/sign-in/email';
  static const signInPhone = '/sign-in/phone';
  static const verifyOtp = '/sign-in/verify';
  static const completeProfile = '/onboarding/profile';
  static const setPin = '/onboarding/pin';
  static const biometrics = '/onboarding/biometrics';
  static const lock = '/lock';
  static const pay = '/pay';
  static const history = '/history';
  static const profile = '/profile';

  static const publicRoutes = {welcome, signInEmail, signInPhone, verifyOtp};
}

class OtpRouteArgs {
  const OtpRouteArgs({
    required this.channel,
    required this.destination,
    required this.challenge,
  });

  final String channel;
  final String destination;
  final OtpChallenge challenge;
}
