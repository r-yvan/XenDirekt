/// Defensive JSON readers: API payloads are untrusted input, so a missing or
/// wrongly typed field becomes a FormatException instead of a runtime cast error.
typedef Json = Map<String, Object?>;

T _read<T>(Json json, String key) {
  final value = json[key];
  if (value is T) {
    return value;
  }
  throw FormatException('Field "$key" missing or not ${T.toString()}');
}

String readString(Json json, String key) => _read<String>(json, key);
String? readStringOrNull(Json json, String key) =>
    json[key] is String ? json[key]! as String : null;
int readInt(Json json, String key) => _read<num>(json, key).toInt();
int? readIntOrNull(Json json, String key) =>
    json[key] is num ? (json[key]! as num).toInt() : null;
bool readBool(Json json, String key) => _read<bool>(json, key);
Json readObject(Json json, String key) =>
    _read<Map<String, Object?>>(json, key);
Json? readObjectOrNull(Json json, String key) =>
    json[key] is Map<String, Object?> ? json[key]! as Json : null;
List<Json> readObjectList(Json json, String key) =>
    _read<List<Object?>>(json, key).whereType<Map<String, Object?>>().toList();
DateTime readDate(Json json, String key) =>
    DateTime.parse(readString(json, key));
DateTime? readDateOrNull(Json json, String key) {
  final value = readStringOrNull(json, key);
  return value == null ? null : DateTime.parse(value);
}
