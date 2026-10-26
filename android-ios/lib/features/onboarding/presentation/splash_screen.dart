import 'package:flutter/material.dart';

import '../../../core/widgets/xd_logo.dart';

/// Logo on black while the session is restored (FR-ONB-01: under 2 s, no carousel).
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: XdLogo(size: 96)));
}
