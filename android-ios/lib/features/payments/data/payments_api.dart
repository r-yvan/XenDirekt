import '../../../core/network/api_client.dart';
import 'payment_models.dart';

class PaymentsApi {
  PaymentsApi(this._api);

  final ApiClient _api;

  /// Idempotent: resending with the same key returns the original payment and
  /// never creates a second charge (FR-EXE-01).
  Future<Payment> create({
    required String quoteId,
    required String idempotencyKey,
    String? stepUpToken,
    String? note,
  }) async => Payment.fromJson(
    await _api.post(
      '/v1/payments',
      body: {'quoteId': quoteId, 'note': ?note},
      headers: {
        'Idempotency-Key': idempotencyKey,
        'X-Step-Up-Token': ?stepUpToken,
      },
    ),
  );

  Future<Payment> get(String id) async =>
      Payment.fromJson(await _api.get('/v1/payments/$id'));

  Future<PaymentPage> list({
    String status = 'ALL',
    String? cursor,
    int limit = 20,
  }) async => PaymentPage.fromJson(
    await _api.get(
      '/v1/payments',
      query: {'status': status, 'limit': limit, 'cursor': ?cursor},
    ),
  );
}
