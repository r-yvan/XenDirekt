import '../../../core/network/api_client.dart';
import '../../../shared/models/json.dart';

/// Mirrors contracts/fixtures/notifications_inbox.json.
class InboxItem {
  const InboxItem({
    required this.id,
    required this.kind,
    required this.title,
    required this.body,
    required this.read,
    required this.createdAt,
    this.paymentId,
  });

  factory InboxItem.fromJson(Json json) => InboxItem(
    id: readString(json, 'id'),
    kind: readString(json, 'kind'),
    title: readStringOrNull(json, 'title') ?? '',
    body: readStringOrNull(json, 'body') ?? '',
    read: readBool(json, 'read'),
    createdAt: readDate(json, 'createdAt'),
    paymentId: readStringOrNull(json, 'paymentId'),
  );

  final String id;
  final String kind;
  final String title;
  final String body;
  final bool read;
  final DateTime createdAt;
  final String? paymentId;
}

class Inbox {
  const Inbox({required this.items, required this.unread});

  factory Inbox.fromJson(Json json) => Inbox(
    items: readObjectList(
      json,
      'notifications',
    ).map(InboxItem.fromJson).toList(),
    unread: readInt(json, 'unread'),
  );

  final List<InboxItem> items;
  final int unread;
}

class NotificationsApi {
  NotificationsApi(this._api);

  final ApiClient _api;

  Future<Inbox> inbox() async =>
      Inbox.fromJson(await _api.get('/v1/notifications'));

  Future<void> markRead(String id) => _api.post('/v1/notifications/$id/read');
}
