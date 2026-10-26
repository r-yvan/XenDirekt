import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:xendirekt/app/theme/app_colors.dart';

/// NFR-QA-02: every text/background pair the app uses meets WCAG AA (4.5:1).
void main() {
  const pairs = <String, (Color, Color)>{
    'white on black': (AppColors.brandWhite, AppColors.brandBlack),
    'white on surface': (AppColors.brandWhite, AppColors.surface1),
    'white on surface2': (AppColors.brandWhite, AppColors.surface2),
    'secondary on black': (AppColors.textSecondary, AppColors.brandBlack),
    'secondary on surface': (AppColors.textSecondary, AppColors.surface1),
    'orange on black (accent text)': (
      AppColors.brandOrange,
      AppColors.brandBlack,
    ),
    'black on orange (primary button)': (
      AppColors.brandBlack,
      AppColors.brandOrange,
    ),
    'black on success chip': (AppColors.brandBlack, AppColors.statusSuccess),
    'black on error chip': (AppColors.brandBlack, AppColors.statusError),
    'black on warning chip': (AppColors.brandBlack, AppColors.statusWarning),
    'error text on black': (AppColors.statusErrorText, AppColors.brandBlack),
    'success text on black': (AppColors.statusSuccess, AppColors.brandBlack),
    'error text on surface': (AppColors.statusErrorText, AppColors.surface1),
    'error text on surface2': (AppColors.statusErrorText, AppColors.surface2),
  };

  for (final entry in pairs.entries) {
    test('${entry.key} meets 4.5:1', () {
      final (foreground, background) = entry.value;
      expect(contrastRatio(foreground, background), greaterThanOrEqualTo(4.5));
    });
  }

  test('the PRD error red is not used for text on surfaces', () {
    expect(
      contrastRatio(AppColors.statusError, AppColors.surface1),
      lessThan(4.5),
    );
  });

  test('orange is never body text on white (PRD §9)', () {
    expect(
      contrastRatio(AppColors.brandOrange, AppColors.brandWhite),
      lessThan(4.5),
    );
  });
}
