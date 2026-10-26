import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Dark-first theme (PRD §9). Text sizes come from the theme so they scale with
/// the system font size (NFR-QA-02); nothing here pins a text scale factor.
abstract final class AppTheme {
  static const String fontFamily = 'Satoshi';

  static ThemeData dark() {
    const scheme = ColorScheme.dark(
      primary: AppColors.brandOrange,
      onPrimary: AppColors.brandBlack,
      secondary: AppColors.brandOrange,
      onSecondary: AppColors.brandBlack,
      surface: AppColors.brandBlack,
      onSurface: AppColors.brandWhite,
      surfaceContainerLowest: AppColors.brandBlack,
      surfaceContainerLow: AppColors.surface1,
      surfaceContainer: AppColors.surface1,
      surfaceContainerHigh: AppColors.surface2,
      surfaceContainerHighest: AppColors.surface2,
      onSurfaceVariant: AppColors.textSecondary,
      outline: AppColors.divider,
      error: AppColors.statusErrorText,
      onError: AppColors.brandBlack,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: AppColors.brandBlack,
    );

    final text = base.textTheme.apply(
      bodyColor: AppColors.brandWhite,
      displayColor: AppColors.brandWhite,
      fontFamily: fontFamily,
    );

    return base.copyWith(
      textTheme: text.copyWith(
        // Amounts: large and bold (PRD §9: 32–40 pt on confirmation/success).
        displaySmall: text.displaySmall?.copyWith(
          fontSize: 36,
          fontWeight: FontWeight.w900,
          letterSpacing: -0.5,
        ),
        headlineSmall: text.headlineSmall?.copyWith(
          fontWeight: FontWeight.w700,
        ),
        titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        bodyMedium: text.bodyMedium?.copyWith(height: 1.4),
        labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.brandBlack,
        foregroundColor: AppColors.brandWhite,
        elevation: 0,
        centerTitle: false,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.brandOrange,
          foregroundColor: AppColors.brandBlack,
          disabledBackgroundColor: AppColors.surface2,
          disabledForegroundColor: AppColors.textSecondary,
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.brandWhite,
          minimumSize: const Size.fromHeight(56),
          side: const BorderSide(color: AppColors.divider),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.brandOrange),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface1,
        hintStyle: const TextStyle(color: AppColors.textSecondary),
        labelStyle: const TextStyle(color: AppColors.textSecondary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.brandOrange, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(
            color: AppColors.statusErrorText,
            width: 2,
          ),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(
            color: AppColors.statusErrorText,
            width: 2,
          ),
        ),
        errorStyle: const TextStyle(color: AppColors.statusErrorText),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: AppColors.surface1,
        selectedColor: AppColors.brandOrange,
        labelStyle: const TextStyle(
          fontFamily: fontFamily,
          color: AppColors.brandWhite,
          fontWeight: FontWeight.w500,
        ),
        secondaryLabelStyle: const TextStyle(
          fontFamily: fontFamily,
          color: AppColors.brandBlack,
          fontWeight: FontWeight.w700,
        ),
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.brandBlack,
        indicatorColor: AppColors.brandOrange,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? AppColors.brandBlack
                : AppColors.textSecondary,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontFamily: fontFamily,
            fontWeight: FontWeight.w700,
            color: states.contains(WidgetState.selected)
                ? AppColors.brandOrange
                : AppColors.textSecondary,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface1,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.divider, space: 1),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.surface2,
        contentTextStyle: TextStyle(
          fontFamily: fontFamily,
          color: AppColors.brandWhite,
        ),
        behavior: SnackBarBehavior.floating,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface1,
        showDragHandle: true,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.brandOrange,
      ),
    );
  }
}
