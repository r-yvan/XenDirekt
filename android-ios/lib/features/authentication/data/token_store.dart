import 'dart:async';

import '../../../core/errors/api_failure.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_store.dart';
import 'auth_api.dart';
import 'auth_models.dart';

/// Access token in memory only; refresh token in secure storage. Implements the
/// API client's [AccessTokenSource] so expired tokens refresh transparently.
class TokenStore implements AccessTokenSource {
  TokenStore({
    required SecureStore secureStore,
    required AuthApi Function() authApi,
  }) : _secure = secureStore,
       _authApi = authApi; // ignore: prefer_initializing_formals

  final SecureStore _secure;
  final AuthApi Function() _authApi;
  String? _accessToken;
  Future<String?>? _refreshing;
  final _revoked = StreamController<void>.broadcast();

  /// Fires when the server ends the session (revoked, blocked, refresh rejected).
  Stream<void> get sessionRevoked => _revoked.stream;

  Future<void> save(TokenPair tokens) async {
    _accessToken = tokens.accessToken;
    await _secure.write(SecureKeys.refreshToken, tokens.refreshToken);
  }

  Future<bool> hasRefreshToken() async =>
      (await _secure.read(SecureKeys.refreshToken)) != null;

  Future<void> clear() async {
    _accessToken = null;
    await _secure.delete(SecureKeys.refreshToken);
  }

  @override
  Future<String?> accessToken() async => _accessToken;

  @override
  Future<String?> refreshAccessToken() {
    // Concurrent 401s share one refresh: the server rotates refresh tokens.
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<String?> _doRefresh() async {
    final refreshToken = await _secure.read(SecureKeys.refreshToken);
    if (refreshToken == null) {
      return null;
    }
    try {
      final pair = await _authApi().refresh(refreshToken);
      await save(pair);
      return pair.accessToken;
    } on ApiFailure catch (failure) {
      if (failure.isConnectivity) {
        // Keep the refresh token: we may simply be offline.
        rethrow;
      }
      await clear();
      return null;
    }
  }

  @override
  Future<void> onSessionRevoked() async {
    await clear();
    _revoked.add(null);
  }
}
