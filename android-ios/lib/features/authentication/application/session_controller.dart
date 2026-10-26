import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/api_failure.dart';
import '../../../shared/models/app_client_config.dart';
import '../../../shared/models/user_profile.dart';
import '../data/auth_models.dart';

enum SessionPhase { restoring, signedOut, signedIn }

class SessionState {
  const SessionState({
    required this.phase,
    this.profile,
    this.locked = false,
    this.clientConfig,
    this.offline = false,
  });

  final SessionPhase phase;
  final UserProfile? profile;

  /// Signed in but the app must be unlocked (cold start or 5 min in background).
  final bool locked;
  final AppClientConfig? clientConfig;

  /// Restored from storage while the API was unreachable.
  final bool offline;

  bool get needsProfile =>
      phase == SessionPhase.signedIn && profile?.profileComplete != true;
  bool get needsPin =>
      phase == SessionPhase.signedIn &&
      profile?.profileComplete == true &&
      profile?.pinSet != true;
  bool get isSandbox => clientConfig?.isSandbox ?? false;

  SessionState copyWith({
    UserProfile? profile,
    bool? locked,
    AppClientConfig? clientConfig,
    bool? offline,
  }) => SessionState(
    phase: phase,
    profile: profile ?? this.profile,
    locked: locked ?? this.locked,
    clientConfig: clientConfig ?? this.clientConfig,
    offline: offline ?? this.offline,
  );
}

/// Owns the signed-in state. The server is the authority: the profile is always
/// what /v1/me returned, never client-side guesses.
class SessionController extends Notifier<SessionState> {
  StreamSubscription<void>? _revocations;

  @override
  SessionState build() {
    final tokens = ref.watch(tokenStoreProvider);
    _revocations = tokens.sessionRevoked.listen((_) => _signedOutLocally());
    ref.onDispose(() => _revocations?.cancel());
    unawaited(_restore());
    return const SessionState(phase: SessionPhase.restoring);
  }

  Future<void> _restore() async {
    final auth = ref.read(authApiProvider);
    final tokens = ref.read(tokenStoreProvider);
    AppClientConfig? clientConfig;
    try {
      clientConfig = await auth.appConfig();
    } on ApiFailure {
      clientConfig = null;
    }
    if (!await tokens.hasRefreshToken()) {
      state = SessionState(
        phase: SessionPhase.signedOut,
        clientConfig: clientConfig,
      );
      return;
    }
    try {
      final fresh = await tokens.refreshAccessToken();
      if (fresh == null) {
        state = SessionState(
          phase: SessionPhase.signedOut,
          clientConfig: clientConfig,
        );
        return;
      }
      final profile = await auth.me();
      state = SessionState(
        phase: SessionPhase.signedIn,
        profile: profile,
        clientConfig: clientConfig,
        locked: profile.pinSet,
      );
    } on ApiFailure catch (failure) {
      if (failure.isConnectivity) {
        // Keep the session; the lock screen and offline banner handle the rest.
        state = SessionState(
          phase: SessionPhase.signedIn,
          clientConfig: clientConfig,
          locked: true,
          offline: true,
        );
      } else {
        await tokens.clear();
        state = SessionState(
          phase: SessionPhase.signedOut,
          clientConfig: clientConfig,
        );
      }
    }
  }

  Future<void> retryRestore() async {
    state = SessionState(
      phase: SessionPhase.restoring,
      clientConfig: state.clientConfig,
    );
    await _restore();
  }

  Future<void> signedIn(SignInResult result) async {
    await ref.read(tokenStoreProvider).save(result.tokens);
    state = SessionState(
      phase: SessionPhase.signedIn,
      profile: result.user,
      clientConfig: state.clientConfig,
    );
  }

  void profileUpdated(UserProfile profile) =>
      state = state.copyWith(profile: profile, offline: false);

  Future<void> reloadProfile() async {
    profileUpdated(await ref.read(authApiProvider).me());
  }

  void lock() {
    if (state.phase == SessionPhase.signedIn && state.profile?.pinSet == true) {
      state = state.copyWith(locked: true);
    }
  }

  Future<void> unlocked() async {
    state = state.copyWith(locked: false);
    if (state.profile == null || state.offline) {
      await reloadProfile();
    }
  }

  Future<void> signOut() async {
    try {
      await ref.read(authApiProvider).logout();
    } on ApiFailure {
      // Signing out locally must always work, even offline.
    }
    await ref.read(deviceKeyServiceProvider).deleteKey();
    await ref.read(preferencesProvider).setBiometricsEnabled(false);
    await _signedOutLocally();
  }

  Future<void> _signedOutLocally() async {
    await ref.read(tokenStoreProvider).clear();
    state = SessionState(
      phase: SessionPhase.signedOut,
      clientConfig: state.clientConfig,
    );
  }
}

final sessionControllerProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);
