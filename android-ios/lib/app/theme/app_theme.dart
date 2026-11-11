import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';

/// Light and dark themes (PRD §9), built from the same component styles and a
/// semantic palette ([XdColors]). Text sizes come from the theme so they scale
/// with the system font size (NFR-QA-02).
///
/// Typography is Satoshi with gently tightened tracking: Material's default
/// positive letter spacing makes Satoshi look loose. Satoshi ships
/// 300/400/500/700/900; only 400/500/700 are used, for a calm, natural look.
abstract final class AppTheme {
  static const String fontFamily = 'Satoshi';

  static const TextTheme _type = TextTheme(
    displayLarge: TextStyle(
      fontSize: 52,
      fontWeight: FontWeight.w700,
      letterSpacing: -1.4,
      height: 1.05,
    ),
    displayMedium: TextStyle(
      fontSize: 42,
      fontWeight: FontWeight.w700,
      letterSpacing: -1.1,
      height: 1.08,
    ),
    // Amounts: large and bold (PRD §9: 32–40 pt on confirmation/success).
    displaySmall: TextStyle(
      fontSize: 34,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.9,
      height: 1.1,
    ),
    headlineLarge: TextStyle(
      fontSize: 28,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.7,
      height: 1.15,
    ),
    headlineMedium: TextStyle(
      fontSize: 25,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.6,
      height: 1.2,
    ),
    headlineSmall: TextStyle(
      fontSize: 21,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.4,
      height: 1.25,
    ),
    titleLarge: TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.3,
      height: 1.3,
    ),
    titleMedium: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.2,
      height: 1.35,
    ),
    titleSmall: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.1,
      height: 1.35,
    ),
    bodyLarge: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w500,
      letterSpacing: -0.15,
      height: 1.45,
    ),
    bodyMedium: TextStyle(
      fontSize: 14.5,
      fontWeight: FontWeight.w500,
      letterSpacing: -0.1,
      height: 1.45,
    ),
    bodySmall: TextStyle(
      fontSize: 12.5,
      fontWeight: FontWeight.w500,
      letterSpacing: 0,
      height: 1.4,
    ),
    labelLarge: TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.1,
      height: 1.2,
    ),
    labelMedium: TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w700,
      letterSpacing: 0,
      height: 1.2,
    ),
    labelSmall: TextStyle(
      fontSize: 11.5,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.2,
      height: 1.2,
    ),
  );

  static ThemeData dark() => _build(XdColors.dark, Brightness.dark);

  static ThemeData light() => _build(XdColors.light, Brightness.light);

  static ThemeData _build(XdColors c, Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final scheme = ColorScheme(
      brightness: brightness,
      primary: AppColors.brandOrange,
      onPrimary: AppColors.brandBlack,
      secondary: AppColors.brandOrange,
      onSecondary: AppColors.brandBlack,
      surface: c.canvas,
      onSurface: c.textPrimary,
      surfaceContainerLowest: c.canvas,
      surfaceContainerLow: c.surface1,
      surfaceContainer: c.surface1,
      surfaceContainerHigh: c.surface2,
      surfaceContainerHighest: c.surface3,
      onSurfaceVariant: c.textSecondary,
      outline: c.hairlineStrong,
      outlineVariant: c.hairline,
      error: c.statusErrorText,
      onError: isDark ? AppColors.brandBlack : AppColors.brandWhite,
      surfaceTint: Colors.transparent,
    );

    final text = _type.apply(
      fontFamily: fontFamily,
      bodyColor: c.textPrimary,
      displayColor: c.textPrimary,
    );

    InputBorder border(Color color, [double width = 1]) => RoundedFieldBorder(
      borderSide: BorderSide(color: color, width: width),
    );

    final overlay = isDark
        ? SystemUiOverlayStyle.light.copyWith(
            statusBarColor: Colors.transparent,
            systemNavigationBarColor: c.canvas,
          )
        : SystemUiOverlayStyle.dark.copyWith(
            statusBarColor: Colors.transparent,
            systemNavigationBarColor: c.surface1,
          );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      extensions: [c],
      fontFamily: fontFamily,
      textTheme: text,
      primaryTextTheme: text,
      scaffoldBackgroundColor: c.canvas,
      canvasColor: c.canvas,
      splashFactory: InkRipple.splashFactory,
      highlightColor: Colors.transparent,
      splashColor: c.textPrimary.withValues(alpha: 0.05),
      dividerColor: c.hairline,
      actionIconTheme: ActionIconThemeData(
        backButtonIconBuilder: (_) =>
            const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
        closeButtonIconBuilder: (_) => const Icon(Icons.close_rounded),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: c.canvas,
        foregroundColor: c.textPrimary,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleSpacing: 20,
        titleTextStyle: text.titleLarge,
        systemOverlayStyle: overlay,
      ),
      iconTheme: IconThemeData(color: c.textPrimary, size: 22),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: AppColors.brandOrange,
        selectionColor: AppColors.brandOrange.withValues(alpha: 0.3),
        selectionHandleColor: AppColors.brandOrange,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.brandOrange,
          foregroundColor: AppColors.brandBlack,
          disabledBackgroundColor: c.surface3,
          disabledForegroundColor: c.textTertiary,
          minimumSize: const Size.fromHeight(54),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: text.labelLarge?.copyWith(fontSize: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: c.textPrimary,
          minimumSize: const Size.fromHeight(54),
          side: BorderSide(color: c.hairlineStrong),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: text.labelLarge?.copyWith(fontSize: 16),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.accentText,
          textStyle: text.labelLarge,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: c.textPrimary),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surface1,
        hintStyle: text.bodyLarge?.copyWith(color: c.textTertiary),
        labelStyle: text.bodyLarge?.copyWith(color: c.textSecondary),
        floatingLabelStyle: WidgetStateTextStyle.resolveWith(
          (states) => text.labelMedium!.copyWith(
            color: states.contains(WidgetState.error)
                ? c.statusErrorText
                : states.contains(WidgetState.focused)
                ? c.accentText
                : c.textSecondary,
          ),
        ),
        prefixIconColor: WidgetStateColor.resolveWith(
          (states) => states.contains(WidgetState.focused)
              ? AppColors.brandOrange
              : c.textTertiary,
        ),
        suffixIconColor: c.textTertiary,
        border: border(c.hairline),
        enabledBorder: border(c.hairline),
        disabledBorder: border(c.hairline),
        focusedBorder: border(AppColors.brandOrange, 1.5),
        errorBorder: border(c.statusErrorText),
        focusedErrorBorder: border(c.statusErrorText, 1.5),
        errorStyle: text.bodySmall?.copyWith(color: c.statusErrorText),
        contentPadding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? AppColors.brandWhite
              : (isDark ? c.textSecondary : AppColors.brandWhite),
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? AppColors.brandOrange
              : c.surface3,
        ),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? AppColors.brandOrange
              : c.textTertiary,
        ),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: c.textSecondary,
        textColor: c.textPrimary,
        titleTextStyle: text.bodyLarge,
        subtitleTextStyle: text.bodyMedium?.copyWith(color: c.textSecondary),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20),
        minVerticalPadding: 12,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: c.surface1,
        selectedColor: AppColors.brandOrange.withValues(alpha: 0.14),
        labelStyle: text.labelMedium?.copyWith(color: c.textPrimary),
        side: BorderSide(color: c.hairlineStrong),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        showCheckmark: false,
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 66,
        backgroundColor: c.surface1,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        indicatorColor: AppColors.brandOrange.withValues(alpha: 0.14),
        indicatorShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 24,
            color: states.contains(WidgetState.selected)
                ? c.accentText
                : c.textTertiary,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => text.labelSmall!.copyWith(
            fontSize: 12,
            letterSpacing: 0,
            color: states.contains(WidgetState.selected)
                ? c.textPrimary
                : c.textTertiary,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: c.surface1,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: c.hairline),
        ),
      ),
      dividerTheme: DividerThemeData(color: c.hairline, space: 1, thickness: 1),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: isDark ? c.surface3 : const Color(0xFF1C1C1F),
        contentTextStyle: text.bodyMedium?.copyWith(
          color: isDark ? c.textPrimary : AppColors.brandWhite,
        ),
        actionTextColor: AppColors.brandOrange,
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surface1,
        surfaceTintColor: Colors.transparent,
        modalBarrierColor: Colors.black.withValues(alpha: isDark ? 0.7 : 0.4),
        showDragHandle: true,
        dragHandleColor: c.hairlineStrong,
        dragHandleSize: const Size(36, 4),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: c.surface1,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        titleTextStyle: text.titleLarge,
        contentTextStyle: text.bodyMedium?.copyWith(color: c.textSecondary),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: AppColors.brandOrange,
        linearTrackColor: c.surface2,
        circularTrackColor: Colors.transparent,
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: c.textPrimary,
          borderRadius: BorderRadius.circular(8),
        ),
        textStyle: text.bodySmall?.copyWith(color: c.canvas),
      ),
    );
  }
}

/// A rounded, stroked field border that behaves like a *filled* field: the
/// label floats inside the field (as in [SelectField]) instead of cutting a
/// gap in the outline.
class RoundedFieldBorder extends InputBorder {
  const RoundedFieldBorder({
    super.borderSide = const BorderSide(color: Color(0x0DFFFFFF)),
    this.radius = 14,
  });

  final double radius;

  @override
  bool get isOutline => false;

  @override
  InputBorder copyWith({BorderSide? borderSide}) => RoundedFieldBorder(
    borderSide: borderSide ?? this.borderSide,
    radius: radius,
  );

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(borderSide.width);

  RRect _rrect(Rect rect) =>
      RRect.fromRectAndRadius(rect, Radius.circular(radius));

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) =>
      Path()..addRRect(_rrect(rect).deflate(borderSide.width));

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) =>
      Path()..addRRect(_rrect(rect));

  @override
  void paint(
    Canvas canvas,
    Rect rect, {
    double? gapStart,
    double gapExtent = 0.0,
    double gapPercentage = 0.0,
    TextDirection? textDirection,
  }) {
    if (borderSide.style == BorderStyle.none || borderSide.width == 0) {
      return;
    }
    canvas.drawRRect(
      _rrect(rect).deflate(borderSide.width / 2),
      borderSide.toPaint(),
    );
  }

  @override
  ShapeBorder scale(double t) =>
      RoundedFieldBorder(borderSide: borderSide.scale(t), radius: radius * t);

  @override
  ShapeBorder? lerpFrom(ShapeBorder? a, double t) => a is RoundedFieldBorder
      ? RoundedFieldBorder(
          borderSide: BorderSide.lerp(a.borderSide, borderSide, t),
          radius: radius,
        )
      : super.lerpFrom(a, t);

  @override
  ShapeBorder? lerpTo(ShapeBorder? b, double t) => b is RoundedFieldBorder
      ? RoundedFieldBorder(
          borderSide: BorderSide.lerp(borderSide, b.borderSide, t),
          radius: radius,
        )
      : super.lerpTo(b, t);

  @override
  bool operator ==(Object other) =>
      other is RoundedFieldBorder &&
      other.borderSide == borderSide &&
      other.radius == radius;

  @override
  int get hashCode => Object.hash(borderSide, radius);
}
