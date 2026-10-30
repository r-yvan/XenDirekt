import '../../../core/network/api_client.dart';
import '../../../shared/models/json.dart';

/// Mirrors contracts/fixtures/ticket_created.json.
class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.reference,
    required this.category,
    required this.status,
    required this.createdAt,
    this.paymentReference,
    this.message,
  });

  factory SupportTicket.fromJson(Json json) => SupportTicket(
    id: readString(json, 'id'),
    reference: readString(json, 'reference'),
    category: readString(json, 'category'),
    status: readString(json, 'status'),
    createdAt: readDate(json, 'createdAt'),
    paymentReference: readStringOrNull(json, 'paymentReference'),
    message: readStringOrNull(json, 'message'),
  );

  final String id;
  final String reference;
  final String category;
  final String status;
  final DateTime createdAt;
  final String? paymentReference;
  final String? message;
}

class SupportApi {
  SupportApi(this._api);

  final ApiClient _api;

  Future<SupportTicket> reportPayment(
    String paymentId, {
    required String category,
    String? message,
  }) async => SupportTicket.fromJson(
    await _api.post(
      '/v1/payments/$paymentId/tickets',
      body: {'category': category, 'message': ?message},
    ),
  );

  Future<SupportTicket> report({
    required String category,
    String? message,
  }) async => SupportTicket.fromJson(
    await _api.post(
      '/v1/tickets',
      body: {'category': category, 'message': ?message},
    ),
  );

  Future<List<SupportTicket>> mine() async => readObjectList(
    await _api.get('/v1/tickets'),
    'tickets',
  ).map(SupportTicket.fromJson).toList();
}
