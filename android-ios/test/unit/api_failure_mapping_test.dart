import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:xendirekt/core/errors/api_failure.dart';
import 'package:xendirekt/core/network/api_client.dart';

void main() {
  final request = RequestOptions(path: '/v1/payments');

  test('maps the server error envelope', () {
    final failure = mapDioError(
      DioException(
        requestOptions: request,
        type: DioExceptionType.badResponse,
        response: Response<Object?>(
          requestOptions: request,
          statusCode: 409,
          data: {
            'error': {
              'code': 'QUOTE_EXPIRED',
              'message': 'The price was updated.',
              'requestId': 'req-1',
              'details': {'retryAfterSeconds': 3},
            },
          },
        ),
      ),
    );
    expect(failure.code, 'QUOTE_EXPIRED');
    expect(failure.statusCode, 409);
    expect(failure.requestId, 'req-1');
    expect(failure.retryAfterSeconds, 3);
    expect(failure.isConnectivity, isFalse);
  });

  test('distinguishes no connection from a timeout after sending', () {
    final offline = mapDioError(
      DioException(
        requestOptions: request,
        type: DioExceptionType.connectionError,
      ),
    );
    final timeout = mapDioError(
      DioException(
        requestOptions: request,
        type: DioExceptionType.receiveTimeout,
      ),
    );
    expect(offline.kind, FailureKind.network);
    expect(timeout.kind, FailureKind.timeout);
    expect(offline.isConnectivity && timeout.isConnectivity, isTrue);
  });

  test('never trusts non-envelope error bodies', () {
    final failure = mapDioError(
      DioException(
        requestOptions: request,
        type: DioExceptionType.badResponse,
        response: Response<Object?>(
          requestOptions: request,
          statusCode: 502,
          data: '<html>',
        ),
      ),
    );
    expect(failure.code, 'INTERNAL_ERROR');
    expect(failure.statusCode, 502);
  });
}
