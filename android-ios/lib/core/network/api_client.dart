import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:uuid/uuid.dart';

import '../config/app_config.dart';
import '../errors/api_failure.dart';

/// Supplies the current access token and refreshes it when the server says it
/// has expired. Implemented by the session controller.
abstract interface class AccessTokenSource {
  Future<String?> accessToken();

  /// Returns a fresh token, or null when the session is gone (sign-in needed).
  Future<String?> refreshAccessToken();

  /// Called when the server rejects the session outright (revoked or blocked).
  Future<void> onSessionRevoked();
}

/// Thin typed wrapper over Dio. The app talks only to the XenDirekt API.
class ApiClient {
  ApiClient({
    required AppConfig config,
    required String installId,
    AccessTokenSource? tokens,
    Dio? dio,
  }) : _tokens = tokens, // ignore: prefer_initializing_formals
       _dio = dio ?? Dio() {
    _dio.options = BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      responseType: ResponseType.json,
      headers: {'Accept': 'application/json', 'X-Device-Id': installId},
    );
    if (config.certificatePinsPem.isNotEmpty) {
      _dio.httpClientAdapter = _pinnedAdapter(config.certificatePinsPem);
    }
    _dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onRequest: _attachHeaders,
        onError: _refreshOnExpiry,
      ),
    );
  }

  final Dio _dio;
  AccessTokenSource? _tokens;
  static const _uuid = Uuid();

  // ignore: use_setters_to_change_properties
  void attachTokenSource(AccessTokenSource tokens) => _tokens = tokens;

  Future<Map<String, Object?>> get(
    String path, {
    Map<String, Object?>? query,
    bool authenticated = true,
  }) => _send(
    () => _dio.get<Object?>(
      path,
      queryParameters: query,
      options: Options(extra: {'auth': authenticated}),
    ),
  );

  Future<Map<String, Object?>> post(
    String path, {
    Object? body,
    Map<String, String>? headers,
    bool authenticated = true,
  }) => _send(
    () => _dio.post<Object?>(
      path,
      data: body,
      options: Options(headers: headers, extra: {'auth': authenticated}),
    ),
  );

  Future<Map<String, Object?>> patch(String path, {Object? body}) => _send(
    () => _dio.patch<Object?>(
      path,
      data: body,
      options: Options(extra: {'auth': true}),
    ),
  );

  Future<Map<String, Object?>> delete(
    String path, {
    Map<String, String>? headers,
  }) => _send(
    () => _dio.delete<Object?>(
      path,
      options: Options(headers: headers, extra: {'auth': true}),
    ),
  );

  Future<Map<String, Object?>> _send(
    Future<Response<Object?>> Function() request,
  ) async {
    try {
      final response = await request();
      final data = response.data;
      if (data is Map<String, Object?>) {
        return data;
      }
      return const {};
    } on DioException catch (error) {
      throw mapDioError(error);
    }
  }

  void _attachHeaders(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    options.headers['X-Request-Id'] = _uuid.v4();
    final needsAuth = options.extra['auth'] != false;
    final tokens = _tokens;
    if (needsAuth && tokens != null) {
      final token = await tokens.accessToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  /// One refresh attempt per expired request; queued so concurrent 401s refresh once.
  void _refreshOnExpiry(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final tokens = _tokens;
    final response = error.response;
    final alreadyRetried = error.requestOptions.extra['retried'] == true;
    final code = _errorCode(response?.data);
    if (tokens == null || response?.statusCode != 401 || alreadyRetried) {
      return handler.next(error);
    }
    if (code == 'SESSION_REVOKED' || code == 'ACCOUNT_BLOCKED') {
      await tokens.onSessionRevoked();
      return handler.next(error);
    }
    if (code != 'UNAUTHENTICATED') {
      return handler.next(error);
    }
    final fresh = await tokens.refreshAccessToken();
    if (fresh == null) {
      await tokens.onSessionRevoked();
      return handler.next(error);
    }
    final retry = error.requestOptions
      ..headers['Authorization'] = 'Bearer $fresh'
      ..extra['retried'] = true;
    try {
      handler.resolve(await _dio.fetch<Object?>(retry));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  static String? _errorCode(Object? data) {
    if (data is Map && data['error'] is Map) {
      final code = (data['error'] as Map)['code'];
      return code is String ? code : null;
    }
    return null;
  }

  static IOHttpClientAdapter _pinnedAdapter(List<String> pemCertificates) {
    return IOHttpClientAdapter(
      createHttpClient: () {
        // Only chains ending in a pinned certificate are trusted (NFR-SEC-02).
        final context = SecurityContext(withTrustedRoots: false);
        for (final pem in pemCertificates) {
          context.setTrustedCertificatesBytes(pem.codeUnits);
        }
        return HttpClient(context: context);
      },
    );
  }
}

/// Maps transport errors to [ApiFailure]. Timeouts after the request was sent
/// are reported separately: the server may have acted on the request.
ApiFailure mapDioError(DioException error) {
  switch (error.type) {
    case DioExceptionType.connectionError:
    case DioExceptionType.connectionTimeout:
      return const ApiFailure.network();
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.transformTimeout:
      return const ApiFailure.timeout();
    case DioExceptionType.badCertificate:
      return const ApiFailure(
        code: 'INSECURE_CONNECTION',
        kind: FailureKind.network,
      );
    case DioExceptionType.cancel:
      return const ApiFailure(code: 'CANCELLED', kind: FailureKind.network);
    case DioExceptionType.badResponse:
    case DioExceptionType.unknown:
      final response = error.response;
      if (response == null) {
        return error.error is SocketException
            ? const ApiFailure.network()
            : const ApiFailure(code: 'INTERNAL_ERROR');
      }
      final data = response.data;
      if (data is Map && data['error'] is Map) {
        final body = (data['error'] as Map).cast<String, Object?>();
        final details = body['details'];
        return ApiFailure(
          code: body['code'] is String
              ? body['code']! as String
              : 'INTERNAL_ERROR',
          message: body['message'] is String
              ? body['message']! as String
              : null,
          statusCode: response.statusCode,
          requestId: body['requestId'] is String
              ? body['requestId']! as String
              : null,
          details: details is Map ? details.cast<String, Object?>() : const {},
        );
      }
      return ApiFailure(
        code: 'INTERNAL_ERROR',
        statusCode: response.statusCode,
      );
  }
}
