import 'package:dio/dio.dart';

import 'pinned_adapter_stub.dart'
    if (dart.library.io) 'pinned_adapter_io.dart'
    as impl;

/// An adapter that trusts only [pemCertificates] (NFR-SEC-02), or null where
/// the platform cannot pin (web: the browser owns TLS).
HttpClientAdapter? pinnedAdapter(List<String> pemCertificates) =>
    impl.pinnedAdapter(pemCertificates);

/// True for an OS-level socket failure (no network). Always false on web,
/// where the browser reports these as connection errors instead.
bool isSocketException(Object? error) => impl.isSocketException(error);
