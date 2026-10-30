import 'dart:async';

import '../errors/api_failure.dart';
import '../network/api_client.dart';

/// Product analytics (PRD §10.1): allowlisted event names with non-personal
/// properties only, batched and sent best-effort. Never blocks the UI and never
/// retries forever; losing an analytics event is acceptable, leaking data is not.
class Analytics {
  Analytics(ApiClient api, {Duration flushAfter = const Duration(seconds: 10)})
    : this.withSender(
        (body) => api.post('/v1/analytics/events', body: body),
        flushAfter: flushAfter,
      );

  /// For tests and alternative transports.
  Analytics.withSender(
    this._send, {
    this.flushAfter = const Duration(seconds: 10),
  });

  final Future<Object?> Function(Map<String, Object?> body) _send;
  final Duration flushAfter;
  final List<Map<String, Object?>> _queue = [];

  /// Events before sign-in (app_installed, signup_started) wait for a session,
  /// bounded so a never-signed-in device cannot grow memory.
  static const maxQueued = 50;
  Timer? _timer;

  void track(String name, [Map<String, Object?> properties = const {}]) {
    _queue.add({
      'name': name,
      'occurredAt': DateTime.now().toUtc().toIso8601String(),
      'properties': properties,
    });
    if (_queue.length >= 20) {
      unawaited(flush());
    } else {
      _timer ??= Timer(flushAfter, () => unawaited(flush()));
    }
  }

  /// Sends what is queued without waiting for the timer (after sign-in).
  void flushSoon() => unawaited(flush());

  /// PRD §5.0: every flow logs how many taps it took.
  void taps(String flow, int taps) =>
      track('taps_to_complete', {'flow': flow, 'taps': taps});

  Future<void> flush() async {
    _timer?.cancel();
    _timer = null;
    if (_queue.isEmpty) {
      return;
    }
    final batch = List<Map<String, Object?>>.of(_queue);
    _queue.clear();
    try {
      await _send({'events': batch});
    } on ApiFailure catch (failure) {
      if (failure.statusCode == 401 || failure.statusCode == 403) {
        // Not signed in yet: keep the newest events for the next flush.
        _queue.insertAll(0, batch);
        if (_queue.length > maxQueued) {
          _queue.removeRange(0, _queue.length - maxQueued);
        }
      }
    } on Object {
      // Best effort only.
    }
  }
}
