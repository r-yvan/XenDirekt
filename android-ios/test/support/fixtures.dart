import 'dart:convert';
import 'dart:io';

import 'package:xendirekt/shared/models/json.dart';

/// Loads a response body recorded by the API e2e suite (/contracts/fixtures).
Json contractFixture(String name) {
  final file = File('../contracts/fixtures/$name.json');
  return (jsonDecode(file.readAsStringSync()) as Map).cast<String, Object?>();
}
