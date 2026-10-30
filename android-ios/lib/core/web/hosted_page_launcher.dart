import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
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
    // Root navigator: the partner page covers the tab bar like a real modal.
    return Navigator.of(context, rootNavigator: true).push<Uri>(
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

/// Web preview only: browsers have no embeddable WebView, so the partner page
/// opens in a new tab and the user comes back here when done. The server, not
/// this dialog, decides whether the card was added or the payment approved.
class BrowserTabHostedPageLauncher implements HostedPageLauncher {
  @override
  Future<Uri?> open(
    BuildContext context,
    Uri url, {
    required String returnPrefix,
    required String title,
  }) async {
    final opened = await launchUrl(url, webOnlyWindowName: '_blank');
    if (!opened || !context.mounted) {
      return null;
    }
    final l10n = AppLocalizations.of(context);
    final done = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(l10n.hostedPageInNewTab),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.continueLabel),
          ),
        ],
      ),
    );
    return done == true ? Uri.parse(returnPrefix) : null;
  }
}
