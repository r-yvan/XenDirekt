import 'dart:convert';

import 'package:cryptography/cryptography.dart';

import '../storage/secure_store.dart';

/// Ed25519 key that biometrics unlock for step-up (ADR 0005). The private seed
/// stays in secure storage and is used only after a successful biometric check;
/// the server stores only the public key and verifies signatures over its nonce.
///
/// Hardening path (docs/security.md): move to a hardware-backed key that the OS
/// releases only after biometric authentication (Keystore / Secure Enclave).
class DeviceKeyService {
  DeviceKeyService(this._store, {Ed25519? algorithm})
    : _algorithm = algorithm ?? Ed25519();

  final SecureStore _store;
  final Ed25519 _algorithm;

  Future<bool> hasKey() async =>
      (await _store.read(SecureKeys.deviceKeySeed)) != null;

  /// Creates a new key, replacing any previous one; returns the raw public key, base64.
  Future<String> createKey() async {
    final keyPair = await _algorithm.newKeyPair();
    final seed = await keyPair.extractPrivateKeyBytes();
    final publicKey = await keyPair.extractPublicKey();
    await _store.write(SecureKeys.deviceKeySeed, base64Encode(seed));
    return base64Encode(publicKey.bytes);
  }

  Future<String> sign(String message) async {
    final seed = await _store.read(SecureKeys.deviceKeySeed);
    if (seed == null) {
      throw StateError('No device key');
    }
    final keyPair = await _algorithm.newKeyPairFromSeed(base64Decode(seed));
    final signature = await _algorithm.sign(
      utf8.encode(message),
      keyPair: keyPair,
    );
    return base64Encode(signature.bytes);
  }

  Future<void> deleteKey() => _store.delete(SecureKeys.deviceKeySeed);
}
