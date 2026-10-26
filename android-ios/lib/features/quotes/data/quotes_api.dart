import '../../../core/network/api_client.dart';
import 'quote_models.dart';

class QuotesApi {
  QuotesApi(this._api);

  final ApiClient _api;

  Future<Quote> create({
    required String payeeId,
    required String cardId,
    required int amountRwf,
  }) async => Quote.fromJson(
    await _api.post(
      '/v1/quotes',
      body: {'payeeId': payeeId, 'cardId': cardId, 'amountRwf': amountRwf},
    ),
  );
}
