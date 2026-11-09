/// Sin dart:io (vista previa web): no hay tiempo real y la app se queda con la recarga periódica.
class CanalTiempoReal {
  Stream<dynamic> get mensajes => const Stream.empty();
  void enviar(String texto) {}
  void cerrar() {}
}

Future<CanalTiempoReal> abrirCanal(String url) => Future.error(UnsupportedError('Tiempo real no disponible en web'));
