import 'package:xendirekt/core/analytics/analytics.dart';

/// Records events in memory instead of batching them to the API.
class RecordingAnalytics extends Analytics {
  RecordingAnalytics() : super.withSender((_) async => null);

  final List<(String, Map<String, Object?>)> events = [];

  Iterable<String> get names => events.map((event) => event.$1);

  @override
  void track(String name, [Map<String, Object?> properties = const {}]) =>
      events.add((name, properties));
}
