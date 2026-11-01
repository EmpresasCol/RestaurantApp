import 'package:intl/intl.dart';

// El patrón de moneda de intl para es_CO pone el signo al final; la web (Intl de JS) lo pone adelante.
final _miles = NumberFormat('#,##0', 'es_CO');

/// Pesos colombianos sin decimales, igual que la web: $ 56.000
String pesos(num valor) => '\$ ${_miles.format(valor.round())}';

/// Hora local corta en formato colombiano: 7:05 p. m.
String hora(DateTime fecha) {
  final local = fecha.toLocal();
  final h = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final m = local.minute.toString().padLeft(2, '0');
  return '$h:$m ${local.hour < 12 ? 'a. m.' : 'p. m.'}';
}

/// "hace 3 min", "hace 1 h 5 min": cuánto lleva esperando un pedido.
String hace(DateTime fecha, [DateTime? ahora]) {
  final min = (ahora ?? DateTime.now()).difference(fecha).inMinutes;
  if (min < 1) return 'ahora';
  if (min < 60) return 'hace $min min';
  final h = min ~/ 60, resto = min % 60;
  return resto == 0 ? 'hace $h h' : 'hace $h h $resto min';
}

/// "1 plato" / "3 platos".
String plural(int n, String singular, [String? pluralForma]) => '$n ${n == 1 ? singular : pluralForma ?? '${singular}s'}';
