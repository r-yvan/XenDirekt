import 'package:flutter/material.dart';

import '../../../app/localization/generated/app_localizations.dart';

/// Phase 3 replaces this with payee lookup, live quote and Pay.
class PayScreen extends StatelessWidget {
  const PayScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(AppLocalizations.of(context).payTitle)),
    body: const SizedBox.shrink(),
  );
}
