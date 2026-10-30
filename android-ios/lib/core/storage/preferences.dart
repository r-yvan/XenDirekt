import 'package:shared_preferences/shared_preferences.dart';

/// Non-secret, per-device preferences.
class Preferences {
  Preferences(this._prefs);

  final SharedPreferences _prefs;

  static const _biometrics = 'xd.biometrics_enabled';
  static const _biometricsOffered = 'xd.biometrics_offered';
  static const _language = 'xd.language';
  static const _themeMode = 'xd.theme_mode';

  bool get biometricsEnabled => _prefs.getBool(_biometrics) ?? false;
  Future<void> setBiometricsEnabled(bool value) =>
      _prefs.setBool(_biometrics, value);

  bool get biometricsOffered => _prefs.getBool(_biometricsOffered) ?? false;
  Future<void> setBiometricsOffered() =>
      _prefs.setBool(_biometricsOffered, true);

  /// null = follow the device language (FR-ONB-05).
  String? get language => _prefs.getString(_language);
  Future<void> setLanguage(String? code) => code == null
      ? _prefs.remove(_language)
      : _prefs.setString(_language, code);

  /// 'light' | 'dark'; null = follow the device setting.
  String? get themeMode => _prefs.getString(_themeMode);
  Future<void> setThemeMode(String? mode) => mode == null
      ? _prefs.remove(_themeMode)
      : _prefs.setString(_themeMode, mode);
}
