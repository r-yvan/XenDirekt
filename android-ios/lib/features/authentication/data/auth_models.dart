import '../../../shared/models/json.dart';
import '../../../shared/models/user_profile.dart';

class OtpChallenge {
  const OtpChallenge({
    required this.challengeId,
    required this.destinationMasked,
    required this.expiresAt,
    required this.resendAvailableAt,
    required this.codeLength,
  });

  factory OtpChallenge.fromJson(Json json) => OtpChallenge(
    challengeId: readString(json, 'challengeId'),
    destinationMasked: readString(json, 'destinationMasked'),
    expiresAt: readDate(json, 'expiresAt'),
    resendAvailableAt: readDate(json, 'resendAvailableAt'),
    codeLength: readInt(json, 'codeLength'),
  );

  final String challengeId;
  final String destinationMasked;
  final DateTime expiresAt;
  final DateTime resendAvailableAt;
  final int codeLength;
}

class TokenPair {
  const TokenPair({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });

  factory TokenPair.fromJson(Json json) => TokenPair(
    accessToken: readString(json, 'accessToken'),
    refreshToken: readString(json, 'refreshToken'),
    expiresIn: readInt(json, 'accessTokenExpiresIn'),
  );

  final String accessToken;
  final String refreshToken;
  final int expiresIn;
}

class SignInResult {
  const SignInResult({
    required this.tokens,
    required this.user,
    required this.isNewUser,
  });

  factory SignInResult.fromJson(Json json) => SignInResult(
    tokens: TokenPair.fromJson(json),
    user: UserProfile.fromJson(readObject(json, 'user')),
    isNewUser: readBool(json, 'isNewUser'),
  );

  final TokenPair tokens;
  final UserProfile user;
  final bool isNewUser;
}

class StepUpChallenge {
  const StepUpChallenge({
    required this.challengeId,
    required this.signingMessage,
  });

  factory StepUpChallenge.fromJson(Json json) => StepUpChallenge(
    challengeId: readString(json, 'challengeId'),
    signingMessage: readString(json, 'signingMessage'),
  );

  final String challengeId;
  final String signingMessage;
}

/// Server-side step-up purposes (ADR 0005).
enum StepUpPurpose {
  payment('PAYMENT'),
  changePin('CHANGE_PIN'),
  deleteAccount('DELETE_ACCOUNT'),
  registerDeviceKey('REGISTER_DEVICE_KEY');

  const StepUpPurpose(this.wire);
  final String wire;
}
