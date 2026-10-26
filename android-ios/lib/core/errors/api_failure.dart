/// Every failure surfaced to the UI. The server's stable `code` drives the
/// message shown (see error_messages.dart), never the server's English text.
class ApiFailure implements Exception {
  const ApiFailure({
    required this.code,
    this.message,
    this.statusCode,
    this.requestId,
    this.details = const {},
    this.kind = FailureKind.server,
  });

  /// No response at all: offline, DNS failure, connection refused.
  const ApiFailure.network()
    : code = 'NETWORK_UNAVAILABLE',
      message = null,
      statusCode = null,
      requestId = null,
      details = const {},
      kind = FailureKind.network;

  /// The request may or may not have reached the server (timeout after send).
  /// Never auto-retry a money-moving request on this; resume by reference.
  const ApiFailure.timeout()
    : code = 'TIMEOUT',
      message = null,
      statusCode = null,
      requestId = null,
      details = const {},
      kind = FailureKind.timeout;

  final String code;
  final String? message;
  final int? statusCode;
  final String? requestId;
  final Map<String, Object?> details;
  final FailureKind kind;

  bool get isConnectivity =>
      kind == FailureKind.network || kind == FailureKind.timeout;

  int? get retryAfterSeconds {
    final value = details['retryAfterSeconds'];
    return value is int ? value : null;
  }

  @override
  String toString() =>
      'ApiFailure($code, status: $statusCode, request: $requestId)';
}

enum FailureKind { server, network, timeout }
