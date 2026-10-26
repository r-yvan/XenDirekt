import '../../../core/network/api_client.dart';
import '../../../shared/models/json.dart';
import 'payee_models.dart';

class PayeesApi {
  PayeesApi(this._api);

  final ApiClient _api;

  Future<PayeeLookup> lookupPhone(String identifier) async =>
      PayeeLookup.fromJson(
        await _api.post(
          '/v1/payees/lookup',
          body: {'identifierType': 'PHONE', 'identifier': identifier},
        ),
      );

  Future<List<RecentPayee>> recent() async => readObjectList(
    await _api.get('/v1/payees/recent'),
    'payees',
  ).map(RecentPayee.fromJson).toList();
}

/// True once the input could be a complete Rwandan mobile number, so lookup
/// starts by itself with no Search button (FR-PAY-03). The server validates.
bool isCompleteRwandanNumber(String input) {
  final digits = input.replaceAll(RegExp(r'\D'), '');
  return (digits.length == 10 && digits.startsWith('07')) ||
      (digits.length == 12 && digits.startsWith('2507')) ||
      (digits.length == 14 && digits.startsWith('002507')) ||
      (digits.length == 9 && digits.startsWith('7'));
}
