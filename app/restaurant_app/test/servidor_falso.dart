import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:restaurant_app/services/api.dart';

/// API simulada: responde por "MÉTODO ruta" (sin /api) y guarda lo que recibió.
class ServidorFalso {
  final rutas = <String, http.Response Function(http.Request)>{};
  final recibidas = <http.Request>[];

  void responder(String clave, Object? cuerpo, {int status = 200}) =>
      rutas[clave] = (_) => http.Response.bytes(utf8.encode(cuerpo == null ? '' : json.encode(cuerpo)), status,
          headers: {'content-type': 'application/json; charset=utf-8'});

  Api api() => Api(
        cliente: MockClient((req) async {
          recibidas.add(req);
          final clave = '${req.method} ${req.url.path.replaceFirst('/api/', '')}';
          final r = rutas[clave];
          return r != null ? r(req) : http.Response('{"message":"Ruta no simulada: $clave"}', 404);
        }),
      );

  /// Cuerpo JSON de la última petición a esa ruta.
  Map<String, dynamic> cuerpo(String clave) {
    final req = recibidas.lastWhere((r) => '${r.method} ${r.url.path.replaceFirst('/api/', '')}' == clave);
    return json.decode(req.body) as Map<String, dynamic>;
  }

  int veces(String clave) => recibidas.where((r) => '${r.method} ${r.url.path.replaceFirst('/api/', '')}' == clave).length;
}
