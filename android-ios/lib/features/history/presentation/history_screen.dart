import 'package:flutter/material.dart';

import '../../../app/localization/generated/app_localizations.dart';

/// Phase 5 replaces this with the payment history list.
class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(AppLocalizations.of(context).historyTitle)),
    body: const SizedBox.shrink(),
  );
}
