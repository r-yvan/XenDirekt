import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';

HttpClientAdapter? pinnedAdapter(List<String> pemCertificates) {
  return IOHttpClientAdapter(
    createHttpClient: () {
      // Only chains ending in a pinned certificate are trusted (NFR-SEC-02).
      final context = SecurityContext(withTrustedRoots: false);
      for (final pem in pemCertificates) {
        context.setTrustedCertificatesBytes(pem.codeUnits);
      }
      return HttpClient(context: context);
    },
  );
}

bool isSocketException(Object? error) => error is SocketException;
