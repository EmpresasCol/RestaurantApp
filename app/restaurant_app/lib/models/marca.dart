import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/painting.dart';

/// Configuración del restaurante que fija el administrador en la web (GET api/configuracion):
/// nombre, logo, colores y la propina que sugiere el mesero. Sin nada guardado es la de Qpro.
class Marca {
  const Marca({
    this.nombre = 'Qpro',
    this.eslogan,
    this.logo,
    this.colorMarca = colorMarcaFabrica,
    this.colorAccion = colorAccionFabrica,
    this.propinaSugerida = 10,
    this.json = const {},
  });

  static const colorMarcaFabrica = Color(0xFFC8955E);
  static const colorAccionFabrica = Color(0xFF2A1D15);

  final String nombre;
  final String? eslogan;
  /// Bytes del logo (data URI de la API ya decodificado). Nulo: el logo de Qpro.
  final Uint8List? logo;
  final Color colorMarca;
  final Color colorAccion;
  /// Porcentaje entero (10 = 10 %). En 0 el mesero no ve propina sugerida.
  final int propinaSugerida;
  /// Lo que respondió la API, para guardarlo tal cual en el teléfono.
  final Map<String, dynamic> json;

  double get tasaPropina => propinaSugerida / 100;

  /// #RRGGBB → Color; null si no es un color válido.
  static Color? colorDe(Object? hex) {
    final t = '$hex';
    if (!RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(t)) return null;
    return Color(0xFF000000 | int.parse(t.substring(1), radix: 16));
  }

  /// Contraste WCAG 2 entre dos colores (1 a 21), igual que la API y la web.
  static double contraste(Color a, Color b) {
    final la = a.computeLuminance(), lb = b.computeLuminance();
    return ((la > lb ? la : lb) + 0.05) / ((la > lb ? lb : la) + 0.05);
  }

  static Uint8List? _bytesLogo(Object? dataUri) {
    final t = dataUri is String ? dataUri : '';
    final coma = t.indexOf(',');
    if (!t.startsWith('data:image/') || coma < 0) return null;
    try {
      return base64Decode(t.substring(coma + 1));
    } on FormatException {
      return null;
    }
  }

  factory Marca.fromJson(Map<String, dynamic> j) {
    final accion = colorDe(j['colorAccion']);
    final nombre = '${j['nombre'] ?? ''}'.trim();
    final eslogan = '${j['eslogan'] ?? ''}'.trim();
    return Marca(
      nombre: nombre.isEmpty ? 'Qpro' : nombre,
      eslogan: eslogan.isEmpty ? null : eslogan,
      logo: _bytesLogo(j['logo']),
      colorMarca: colorDe(j['colorMarca']) ?? colorMarcaFabrica,
      // El color de acciones lleva texto blanco encima: si no se leería, se queda el de fábrica.
      colorAccion: accion != null && contraste(accion, const Color(0xFFFFFFFF)) >= 4.5 ? accion : colorAccionFabrica,
      propinaSugerida: ((j['propinaSugerida'] as num?)?.round() ?? 10).clamp(0, 30),
      json: j,
    );
  }
}
