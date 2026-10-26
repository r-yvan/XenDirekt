import 'json.dart';

/// Mirrors `GET /v1/me` (contracts/fixtures/me_profile_active.json).
class UserProfile {
  const UserProfile({
    required this.id,
    required this.status,
    required this.profileComplete,
    required this.pinSet,
    required this.biometricKeyRegistered,
    required this.preferredLanguage,
    required this.kycLevel,
    this.fullName,
    this.email,
    this.phone,
    this.countryOfResidence,
    this.dateOfBirth,
  });

  factory UserProfile.fromJson(Json json) => UserProfile(
    id: readString(json, 'id'),
    status: readString(json, 'status'),
    profileComplete: readBool(json, 'profileComplete'),
    pinSet: readBool(json, 'pinSet'),
    biometricKeyRegistered: readBool(json, 'biometricKeyRegistered'),
    preferredLanguage: readString(json, 'preferredLanguage'),
    kycLevel: readString(json, 'kycLevel'),
    fullName: readStringOrNull(json, 'fullName'),
    email: readStringOrNull(json, 'email'),
    phone: readStringOrNull(json, 'phone'),
    countryOfResidence: readStringOrNull(json, 'countryOfResidence'),
    dateOfBirth: readStringOrNull(json, 'dateOfBirth'),
  );

  final String id;
  final String status;
  final bool profileComplete;
  final bool pinSet;
  final bool biometricKeyRegistered;
  final String preferredLanguage;
  final String kycLevel;
  final String? fullName;
  final String? email;
  final String? phone;
  final String? countryOfResidence;
  final String? dateOfBirth;

  String? get firstName => fullName?.trim().split(RegExp(r'\s+')).first;
}
