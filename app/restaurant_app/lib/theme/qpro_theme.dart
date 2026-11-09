import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Tokens de DESIGN.md ("La carta a un toque"), los mismos de la web.
/// Espresso actúa, caramelo marca conteos y foco, piedra cálida para lo demás.
/// Verde, ámbar y rojo solo significan estado.
abstract final class QColors {
  static const espresso = Color(0xFF2A1D15);
  static const espressoRaised = Color(0xFF3A2A20);
  static const caramel = Color(0xFFC8955E);
  static const caramelDeep = Color(0xFF865B35);
  static const caramelLight = Color(0xFFEBD3B6);
  static const caramelSoft = Color(0xFFF5E9DA);
  static const caramelWash = Color(0xFFFBF6F0);
  static const tealDeep = Color(0xFF1E505A);
  static const tealLight = Color(0xFF82BCC3);
  static const tealWash = Color(0xFFEFF7F7);
  static const white = Color(0xFFFFFFFF);
  static const stone50 = Color(0xFFFAFAF9);
  static const stone100 = Color(0xFFF5F5F4);
  static const stone200 = Color(0xFFE7E5E4);
  static const stone300 = Color(0xFFD6D3D1);
  static const stone400 = Color(0xFFA8A29E);
  static const stone500 = Color(0xFF78716C);
  static const stone600 = Color(0xFF57534E);
  static const stone900 = Color(0xFF1C1917);
  static const success = Color(0xFF15803D);
  static const successWash = Color(0xFFF0FDF4);
  static const warning = Color(0xFFFBBF24);
  static const warningText = Color(0xFF92400E);
  static const warningWash = Color(0xFFFFFBEB);
  static const danger = Color(0xFFDC2626);
  static const dangerDeep = Color(0xFFB91C1C);
  static const dangerWash = Color(0xFFFEF2F2);
}

abstract final class QRadius {
  static const control = 12.0;
  static const surface = 16.0;
  static const card = 20.0;
  static const ticket = 22.0;
  static const feature = 24.0;
  static const sheet = 28.0;
}

/// Solo existen `card` y `lift`, teñidas de espresso (La Regla de la Sombra Cálida).
abstract final class QShadows {
  static const card = [
    BoxShadow(color: Color(0x0F2A1D15), blurRadius: 2, offset: Offset(0, 1)),
    BoxShadow(color: Color(0x2E2A1D15), blurRadius: 24, spreadRadius: -12, offset: Offset(0, 8)),
  ];
  static const lift = [
    BoxShadow(color: Color(0x0F2A1D15), blurRadius: 4, offset: Offset(0, 2)),
    BoxShadow(color: Color(0x472A1D15), blurRadius: 40, spreadRadius: -16, offset: Offset(0, 18)),
  ];
}

/// Una sola curva de movimiento: cubic-bezier(0.16, 1, 0.3, 1).
abstract final class QMotion {
  static const curve = Cubic(0.16, 1, 0.3, 1);
  static const micro = Duration(milliseconds: 220);
  static const layout = Duration(milliseconds: 400);
}

/// Cifras que se comparan o se cobran llevan dígitos tabulares.
const tabular = [FontFeature.tabularFigures()];

ThemeData qproTheme() {
  const texto = TextTheme(
    headlineMedium: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5, height: 1.1, color: QColors.espresso),
    headlineSmall: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.4, height: 1.15, color: QColors.espresso),
    titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.4, color: QColors.espresso),
    titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: QColors.espresso),
    titleSmall: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: QColors.espresso),
    bodyLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, height: 1.5, color: QColors.espresso),
    bodyMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, height: 1.45, color: QColors.stone600),
    bodySmall: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: QColors.stone500),
    labelLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    labelMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
    labelSmall: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
  );

  final esquinas = RoundedRectangleBorder(borderRadius: BorderRadius.circular(QRadius.control));

  return ThemeData(
    useMaterial3: true,
    fontFamily: 'Manrope',
    textTheme: texto,
    scaffoldBackgroundColor: QColors.stone50,
    colorScheme: const ColorScheme.light(
      primary: QColors.espresso,
      onPrimary: QColors.white,
      secondary: QColors.caramel,
      onSecondary: QColors.espresso,
      surface: QColors.white,
      onSurface: QColors.espresso,
      onSurfaceVariant: QColors.stone500,
      error: QColors.dangerDeep,
      outline: QColors.stone300,
      outlineVariant: QColors.stone200,
    ),
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: const AppBarTheme(
      backgroundColor: QColors.white,
      foregroundColor: QColors.espresso,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
      shape: Border(bottom: BorderSide(color: QColors.stone200)),
      titleTextStyle: TextStyle(fontFamily: 'Manrope', fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: QColors.espresso),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: QColors.espresso,
        foregroundColor: QColors.white,
        disabledBackgroundColor: QColors.stone200,
        disabledForegroundColor: QColors.stone500,
        minimumSize: const Size(48, 48),
        textStyle: const TextStyle(fontFamily: 'Manrope', fontSize: 15, fontWeight: FontWeight.w700),
        shape: esquinas,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: QColors.espresso,
        minimumSize: const Size(48, 48),
        side: const BorderSide(color: QColors.stone300),
        textStyle: const TextStyle(fontFamily: 'Manrope', fontSize: 15, fontWeight: FontWeight.w700),
        shape: esquinas,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: QColors.caramelDeep,
        minimumSize: const Size(44, 44),
        textStyle: const TextStyle(fontFamily: 'Manrope', fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: QColors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      labelStyle: const TextStyle(color: QColors.stone600, fontWeight: FontWeight.w600),
      hintStyle: const TextStyle(color: QColors.stone500),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(QRadius.control), borderSide: const BorderSide(color: QColors.stone300)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(QRadius.control), borderSide: const BorderSide(color: QColors.stone300)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(QRadius.control), borderSide: const BorderSide(color: QColors.caramel, width: 2)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(QRadius.control), borderSide: const BorderSide(color: QColors.danger)),
    ),
    textSelectionTheme: const TextSelectionThemeData(cursorColor: QColors.caramel, selectionColor: QColors.caramelSoft, selectionHandleColor: QColors.caramel),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: QColors.caramel),
    dividerTheme: const DividerThemeData(color: QColors.stone200, thickness: 1, space: 1),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: QColors.white,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: QColors.stone300,
      dragHandleSize: Size(40, 6),
      modalBarrierColor: Color(0x8C2A1D15),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(QRadius.sheet))),
    ),
    dialogTheme: const DialogThemeData(backgroundColor: QColors.white, surfaceTintColor: Colors.transparent),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
