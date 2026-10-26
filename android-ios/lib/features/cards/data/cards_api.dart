import '../../../core/network/api_client.dart';
import '../../../shared/models/json.dart';
import 'card_models.dart';

class CardsApi {
  CardsApi(this._api);

  final ApiClient _api;

  Future<CardSetupSession> startSetup() async =>
      CardSetupSession.fromJson(await _api.post('/v1/cards/setup'));

  Future<PaymentCard> completeSetup(String setupId) async =>
      PaymentCard.fromJson(
        await _api.post('/v1/cards', body: {'setupId': setupId}),
      );

  Future<List<PaymentCard>> list() async => readObjectList(
    await _api.get('/v1/cards'),
    'cards',
  ).map(PaymentCard.fromJson).toList();

  Future<PaymentCard> makeDefault(String cardId) async => PaymentCard.fromJson(
    await _api.patch('/v1/cards/$cardId', body: {'isDefault': true}),
  );

  Future<void> remove(String cardId) => _api.delete('/v1/cards/$cardId');
}
