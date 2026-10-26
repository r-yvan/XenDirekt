import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../app/localization/generated/app_localizations.dart';

/// Opens a partner-hosted page (card entry, 3-D Secure) and returns the URL the
/// partner redirected to once it reaches [returnPrefix], or null if the user closed it.
/// Card details are typed into the partner's page, never into XenDirekt's UI.
abstract interface class HostedPageLauncher {
  Future<Uri?> open(
    BuildContext context,
    Uri url, {
    required String returnPrefix,
    required String title,
  });
}

class WebViewHostedPageLauncher implements HostedPageLauncher {
  @override
  Future<Uri?> open(
    BuildContext context,
    Uri url, {
    required String returnPrefix,
    required String title,
  }) {
    return Navigator.of(context).push<Uri>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _HostedPageScreen(
          url: url,
          returnPrefix: returnPrefix,
          title: title,
        ),
      ),
    );
  }
}

class _HostedPageScreen extends StatefulWidget {
  const _HostedPageScreen({
    required this.url,
    required this.returnPrefix,
    required this.title,
  });

  final Uri url;
  final String returnPrefix;
  final String title;

  @override
  State<_HostedPageScreen> createState() => _HostedPageScreenState();
}

class _HostedPageScreenState extends State<_HostedPageScreen> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            if (request.url.startsWith(widget.returnPrefix)) {
              Navigator.of(context).pop(Uri.parse(request.url));
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
          onPageFinished: (_) {
            if (mounted) {
              setState(() => _loading = false);
            }
          },
        ),
      )
      ..loadRequest(widget.url);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        leading: IconButton(
          tooltip: AppLocalizations.of(context).close,
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading) const LinearProgressIndicator(),
        ],
      ),
    );
  }
}
