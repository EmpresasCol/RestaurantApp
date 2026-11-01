import 'dart:io';

/// WebSocket de dart:io (Android, iOS y escritorio).
class CanalTiempoReal {
  CanalTiempoReal._(this._ws);
  final WebSocket _ws;

  Stream<dynamic> get mensajes => _ws;
  void enviar(String texto) => _ws.add(texto);
  void cerrar() => _ws.close();
}

Future<CanalTiempoReal> abrirCanal(String url) async =>
    CanalTiempoReal._(await WebSocket.connect(url).timeout(const Duration(seconds: 15)));
