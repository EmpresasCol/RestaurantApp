import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restaurant_app/models/cuenta.dart';
import 'package:restaurant_app/models/marca.dart';
import 'package:restaurant_app/providers/marca_provider.dart';
import 'package:restaurant_app/theme/qpro_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'servidor_falso.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  tearDown(() {
    QColors.aplicar(const Marca());
    MarcaProvider.actual = const Marca();
  });

  test('sin configuración la marca es la de Qpro', () {
    final m = Marca.fromJson(const {});
    expect(m.nombre, 'Qpro');
    expect(m.colorAccion, Marca.colorAccionFabrica);
    expect(m.propinaSugerida, 10);
    expect(m.logo, isNull);
  });

  test('lee nombre, colores, propina y el logo en data URI', () {
    final png = base64Encode([0x89, 0x50, 0x4E, 0x47]);
    final m = Marca.fromJson({
      'nombre': ' La Fonda ', 'colorMarca': '#4FA3AE', 'colorAccion': '#0F2F3A', 'propinaSugerida': 12, 'logo': 'data:image/png;base64,$png',
    });
    expect(m.nombre, 'La Fonda');
    expect(m.colorMarca, const Color(0xFF4FA3AE));
    expect(m.tasaPropina, closeTo(0.12, 1e-9));
    expect(m.logo, [0x89, 0x50, 0x4E, 0x47]);
  });

  test('un color de acciones ilegible con texto blanco vuelve al de fábrica', () {
    expect(Marca.fromJson(const {'colorAccion': '#F5E9DA'}).colorAccion, Marca.colorAccionFabrica);
    expect(Marca.fromJson(const {'colorAccion': 'rojo'}).colorAccion, Marca.colorAccionFabrica);
  });

  test('aplicar pinta espresso y la familia caramelo; la de fábrica conserva sus tonos', () {
    QColors.aplicar(Marca.fromJson(const {'colorMarca': '#4FA3AE', 'colorAccion': '#0F2F3A'}));
    expect(QColors.espresso, const Color(0xFF0F2F3A));
    expect(QColors.caramel, const Color(0xFF4FA3AE));
    expect(QColors.caramelWash.computeLuminance(), greaterThan(0.8));

    QColors.aplicar(const Marca());
    expect(QColors.caramelDeep, const Color(0xFF865B35));
  });

  test('la propina sugerida usa la tasa configurada', () {
    expect(propinaSugerida(56500), 5700);
    expect(propinaSugerida(50000, 0.12), 6000);
    expect(propinaSugerida(50000, 0), 0);
  });

  test('cuando el administrador guarda en la web, la app toma la marca nueva y la recuerda', () async {
    SharedPreferences.setMockInitialValues({});
    final servidor = ServidorFalso()..responder('GET configuracion', {'nombre': 'La Fonda', 'colorAccion': '#0F2F3A', 'propinaSugerida': 0});
    final cambios = StreamController<String>();
    final p = MarcaProvider(api: servidor.api(), cambios: cambios.stream);

    cambios.add('configuracion');
    await pumpEventQueue();

    expect(p.marca.nombre, 'La Fonda');
    expect(MarcaProvider.actual.propinaSugerida, 0);
    expect(QColors.espresso, const Color(0xFF0F2F3A));

    // Al abrir la app otra vez arranca con la guardada, antes de hablar con la API.
    MarcaProvider.actual = const Marca();
    final otra = MarcaProvider(api: ServidorFalso().api(), cambios: const Stream.empty());
    await otra.cargarGuardada();
    expect(otra.marca.nombre, 'La Fonda');

    p.dispose();
    otra.dispose();
    await cambios.close();
  });
}
