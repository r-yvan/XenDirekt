import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Keychain (iOS) / Keystore-backed (Android) storage for secrets: refresh
/// token, install ID, device signing key. Abstracted so tests use memory.
abstract interface class SecureStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

abstract final class SecureKeys {
  static const refreshToken = 'xd.refresh_token';
  static const installId = 'xd.install_id';
  static const deviceKeySeed = 'xd.device_key_seed';
  static const deviceKeyId = 'xd.device_key_id';
}

class PlatformSecureStore implements SecureStore {
  PlatformSecureStore()
    : _storage = const FlutterSecureStorage(
        // Readable only after first unlock, never migrated to another device.
        iOptions: IOSOptions(
          accessibility: KeychainAccessibility.first_unlock_this_device,
        ),
      );

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

class MemorySecureStore implements SecureStore {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}
