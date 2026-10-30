import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:xendirekt/app/theme/app_colors.dart';

/// NFR-QA-02: every text/background pair the app uses meets WCAG AA (4.5:1),
/// in both the light and the dark palette.
void main() {
  for (final (mode, c) in [
    ('dark', XdColors.dark),
    ('light', XdColors.light),
  ]) {
    group('$mode palette', () {
      final pairs = <String, (Color, Color)>{
        'primary text on canvas': (c.textPrimary, c.canvas),
        'primary text on surface1': (c.textPrimary, c.surface1),
        'primary text on surface3': (c.textPrimary, c.surface3),
        'secondary on canvas': (c.textSecondary, c.canvas),
        'secondary on surface1': (c.textSecondary, c.surface1),
        'secondary on surface2': (c.textSecondary, c.surface2),
        'tertiary on canvas': (c.textTertiary, c.canvas),
        'tertiary on surface1': (c.textTertiary, c.surface1),
        'tertiary on surface2': (c.textTertiary, c.surface2),
        'orange text on canvas': (c.accentText, c.canvas),
        'orange text on surface1': (c.accentText, c.surface1),
        'success text on canvas': (c.statusSuccessText, c.canvas),
        'success text on surface1': (c.statusSuccessText, c.surface1),
        'warning text on canvas (sandbox strip)': (c.statusWarning, c.canvas),
        'warning text on surface1': (c.statusWarning, c.surface1),
        'error text on canvas': (c.statusErrorText, c.canvas),
        'error text on surface1': (c.statusErrorText, c.surface1),
        'error text on surface2': (c.statusErrorText, c.surface2),
        'info text on surface1': (c.statusInfo, c.surface1),
      };
      for (final entry in pairs.entries) {
        test('${entry.key} meets 4.5:1', () {
          final (foreground, background) = entry.value;
          expect(
            contrastRatio(foreground, background),
            greaterThanOrEqualTo(4.5),
          );
        });
      }
    });
  }

  test('black text on the orange primary button meets 4.5:1', () {
    expect(
      contrastRatio(AppColors.brandBlack, AppColors.brandOrange),
      greaterThanOrEqualTo(4.5),
    );
  });

  test('bright orange is never text in light mode (PRD §9)', () {
    // #FF640A only reaches ~3:1 on white, so light mode uses a deeper orange.
    expect(
      contrastRatio(AppColors.brandOrange, XdColors.light.surface1),
      lessThan(4.5),
    );
    expect(XdColors.light.accentText, isNot(AppColors.brandOrange));
  });

  test('the PRD error red fails on raised dark surfaces, so text uses statusErrorText', () {
    expect(
      contrastRatio(XdColors.dark.statusError, XdColors.dark.surface2),
      lessThan(4.5),
    );
  });
}
