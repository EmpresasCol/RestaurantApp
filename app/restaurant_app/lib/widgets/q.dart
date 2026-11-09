import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/platillo.dart';
import '../theme/qpro_theme.dart';

// Piezas compartidas de la app, equivalentes a components/inventario/ui.js de la web.

enum QVariante { primario, secundario, peligro, fantasma }

ButtonStyle _estilo(QVariante v, double alto) {
  final forma = RoundedRectangleBorder(borderRadius: BorderRadius.circular(alto >= 56 ? QRadius.surface : QRadius.control));
  const texto = TextStyle(fontFamily: 'Manrope', fontSize: 15, fontWeight: FontWeight.w700);
  final tam = Size(alto, alto);
  return switch (v) {
    QVariante.primario => FilledButton.styleFrom(minimumSize: tam, shape: forma, textStyle: texto, padding: const EdgeInsets.symmetric(horizontal: 18)),
    QVariante.secundario => OutlinedButton.styleFrom(
        minimumSize: tam, shape: forma, textStyle: texto, backgroundColor: QColors.white, padding: const EdgeInsets.symmetric(horizontal: 16)),
    QVariante.peligro => OutlinedButton.styleFrom(
        minimumSize: tam,
        shape: forma,
        textStyle: texto,
        foregroundColor: QColors.dangerDeep,
        backgroundColor: QColors.white,
        side: const BorderSide(color: Color(0xFFFECACA)),
        padding: const EdgeInsets.symmetric(horizontal: 16)),
    QVariante.fantasma => TextButton.styleFrom(
        minimumSize: tam, shape: forma, textStyle: texto, foregroundColor: QColors.espresso, padding: const EdgeInsets.symmetric(horizontal: 12)),
  };
}

/// Botón de la app. Primario = espresso (La Regla del Espresso que Actúa).
class QBoton extends StatelessWidget {
  const QBoton({
    super.key,
    required this.texto,
    required this.onPressed,
    this.icono,
    this.variante = QVariante.primario,
    this.alto = 48,
    this.cargando = false,
    this.expandir = false,
  });

  final String texto;
  final VoidCallback? onPressed;
  final IconData? icono;
  final QVariante variante;
  final double alto;
  final bool cargando;
  final bool expandir;

  @override
  Widget build(BuildContext context) {
    final contenido = cargando
        ? SizedBox.square(
            dimension: 20,
            child: CircularProgressIndicator(strokeWidth: 2.4, color: variante == QVariante.primario ? QColors.white : QColors.espresso),
          )
        : Row(mainAxisSize: MainAxisSize.min, children: [
            if (icono != null) ...[Icon(icono, size: 20), const SizedBox(width: 8)],
            Flexible(child: Text(texto, overflow: TextOverflow.ellipsis)),
          ]);
    final accion = cargando ? null : onPressed;
    final estilo = _estilo(variante, alto);
    final boton = switch (variante) {
      QVariante.primario => FilledButton(onPressed: accion, style: estilo, child: contenido),
      QVariante.fantasma => TextButton(onPressed: accion, style: estilo, child: contenido),
      _ => OutlinedButton(onPressed: accion, style: estilo, child: contenido),
    };
    return expandir ? SizedBox(width: double.infinity, child: boton) : boton;
  }
}

/// Acción con doble toque en lugar de un diálogo: el primer toque pide confirmar
/// y vuelve solo a los 3 s (DESIGN.md: confirmaciones dentro del flujo).
class BotonConfirmar extends StatefulWidget {
  const BotonConfirmar({
    super.key,
    required this.texto,
    required this.onConfirmar,
    this.confirmar = 'Toca otra vez para confirmar',
    this.icono,
    this.variante = QVariante.primario,
    this.alto = 48,
    this.expandir = false,
  });

  final String texto;
  final String confirmar;
  final Future<void> Function() onConfirmar;
  final IconData? icono;
  final QVariante variante;
  final double alto;
  final bool expandir;

  @override
  State<BotonConfirmar> createState() => _BotonConfirmarState();
}

class _BotonConfirmarState extends State<BotonConfirmar> {
  bool _confirmando = false;
  bool _enviando = false;
  Timer? _temporizador;

  @override
  void dispose() {
    _temporizador?.cancel();
    super.dispose();
  }

  Future<void> _alTocar() async {
    if (!_confirmando) {
      HapticFeedback.selectionClick();
      setState(() => _confirmando = true);
      _temporizador = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => _confirmando = false);
      });
      return;
    }
    _temporizador?.cancel();
    setState(() {
      _confirmando = false;
      _enviando = true;
    });
    try {
      await widget.onConfirmar();
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: QBoton(
        texto: _confirmando ? widget.confirmar : widget.texto,
        icono: _confirmando ? null : widget.icono,
        onPressed: _alTocar,
        cargando: _enviando,
        alto: widget.alto,
        expandir: widget.expandir,
        variante: _confirmando ? QVariante.secundario : widget.variante,
      ),
    );
  }
}

enum QTono { neutro, ok, aviso, peligro, info, marca }

/// Chip de estado. Verde, ámbar y rojo solo significan estado.
class QChip extends StatelessWidget {
  const QChip(this.texto, {super.key, this.tono = QTono.neutro, this.icono});

  final String texto;
  final QTono tono;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    final (fondo, color) = switch (tono) {
      QTono.neutro => (QColors.stone100, QColors.stone600),
      QTono.ok => (QColors.successWash, const Color(0xFF166534)),
      QTono.aviso => (QColors.warningWash, QColors.warningText),
      QTono.peligro => (QColors.dangerWash, const Color(0xFF991B1B)),
      QTono.info => (QColors.tealWash, QColors.tealDeep),
      QTono.marca => (QColors.caramelSoft, QColors.caramelDeep),
    };
    return Container(
      height: 26,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(color: fondo, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icono != null) ...[Icon(icono, size: 14, color: color), const SizedBox(width: 4)],
        Text(texto, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
      ]),
    );
  }
}

/// Aviso flotante en píldora: blanco con check verde (éxito) o rojo (error).
void avisar(BuildContext context, String texto, {bool error = false}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      elevation: 0,
      backgroundColor: Colors.transparent,
      padding: EdgeInsets.zero,
      duration: Duration(milliseconds: error ? 3500 : 2000),
      content: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: error ? QColors.dangerDeep : QColors.white,
          borderRadius: BorderRadius.circular(999),
          boxShadow: QShadows.lift,
        ),
        child: Row(children: [
          Icon(error ? Icons.error_outline_rounded : Icons.check_circle_rounded, size: 20, color: error ? QColors.white : QColors.success),
          const SizedBox(width: 10),
          Expanded(
            child: Text(texto, style: TextStyle(fontFamily: 'Manrope', fontSize: 15, fontWeight: FontWeight.w700, color: error ? QColors.white : QColors.espresso)),
          ),
        ]),
      ),
    ));
}

/// Superficie del personal: blanca, borde piedra 200, radio 16.
class QTarjeta extends StatelessWidget {
  const QTarjeta({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(16), this.borde, this.color});

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? borde;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final radio = BorderRadius.circular(QRadius.surface);
    return Material(
      color: color ?? QColors.white,
      shape: RoundedRectangleBorder(borderRadius: radio, side: BorderSide(color: borde ?? QColors.stone200, width: borde == null ? 1 : 1.5)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
    );
  }
}

/// Estado vacío con ícono en caramelo lavado.
class Vacio extends StatelessWidget {
  const Vacio({super.key, required this.icono, required this.titulo, this.texto, this.accion});

  final IconData icono;
  final String titulo;
  final String? texto;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(color: QColors.caramelWash, borderRadius: BorderRadius.circular(QRadius.card)),
          child: Icon(icono, size: 30, color: QColors.caramelDeep),
        ),
        const SizedBox(height: 16),
        Text(titulo, style: t.titleMedium, textAlign: TextAlign.center),
        if (texto != null) ...[const SizedBox(height: 6), Text(texto!, style: t.bodyMedium, textAlign: TextAlign.center)],
        if (accion != null) ...[const SizedBox(height: 20), accion!],
      ]),
    );
  }
}

/// Error de carga con reintento.
class ErrorCarga extends StatelessWidget {
  const ErrorCarga({super.key, required this.mensaje, required this.onReintentar});

  final String mensaje;
  final VoidCallback onReintentar;

  @override
  Widget build(BuildContext context) => Vacio(
        icono: Icons.wifi_off_rounded,
        titulo: 'No se pudo cargar',
        texto: mensaje,
        accion: QBoton(texto: 'Reintentar', icono: Icons.refresh_rounded, onPressed: onReintentar),
      );
}

/// Selector de cantidad − n + en píldora de 44 px.
class Cantidad extends StatelessWidget {
  const Cantidad({super.key, required this.valor, required this.onCambio, this.maximo = Platillo.maximoPorPlato, this.minimo = 0, this.oscuro = false});

  final int valor;
  final int maximo;
  final int minimo;
  final bool oscuro;
  final ValueChanged<int> onCambio;

  @override
  Widget build(BuildContext context) {
    final fg = oscuro ? QColors.white : QColors.espresso;
    Widget boton(IconData icono, String etiqueta, VoidCallback? accion) => IconButton(
          tooltip: etiqueta,
          onPressed: accion == null
              ? null
              : () {
                  HapticFeedback.selectionClick();
                  accion();
                },
          icon: Icon(icono, size: 20),
          color: fg,
          disabledColor: fg.withValues(alpha: 0.3),
          constraints: const BoxConstraints.tightFor(width: 44, height: 44),
        );
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: oscuro ? QColors.espresso : QColors.white,
        borderRadius: BorderRadius.circular(999),
        border: oscuro ? null : Border.all(color: QColors.stone200),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        boton(valor <= 1 && minimo == 0 ? Icons.delete_outline_rounded : Icons.remove_rounded, 'Quitar uno', valor > minimo ? () => onCambio(valor - 1) : null),
        SizedBox(
          width: 28,
          child: Text('$valor', textAlign: TextAlign.center, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: fg, fontFeatures: tabular)),
        ),
        boton(Icons.add_rounded, 'Agregar uno', valor < maximo ? () => onCambio(valor + 1) : null),
      ]),
    );
  }
}

/// Foto del plato (Base64 de la carta o URL); sin foto, caramelo lavado con cubiertos.
class FotoPlatillo extends StatelessWidget {
  const FotoPlatillo({super.key, required this.platillo, this.tamano = 64});

  final Platillo platillo;
  final double tamano;

  @override
  Widget build(BuildContext context) {
    final pixeles = (tamano * MediaQuery.devicePixelRatioOf(context)).round();
    final bytes = platillo.bytesFoto;
    Widget sinFoto() => const ColoredBox(
          color: QColors.caramelWash,
          child: Center(child: Icon(Icons.restaurant_rounded, color: QColors.caramelLight)),
        );
    final Widget imagen = bytes != null
        ? Image.memory(bytes, fit: BoxFit.cover, cacheWidth: pixeles, gaplessPlayback: true, errorBuilder: (_, __, ___) => sinFoto())
        : platillo.fotoEnRed
            ? Image.network(platillo.imagenUrl!, fit: BoxFit.cover, cacheWidth: pixeles, errorBuilder: (_, __, ___) => sinFoto())
            : sinFoto();
    return ClipRRect(
      borderRadius: BorderRadius.circular(QRadius.control),
      child: SizedBox.square(dimension: tamano, child: imagen),
    );
  }
}

/// Logo de Qpro en un cuadrado redondeado con anillo de piedra 200.
class LogoQpro extends StatelessWidget {
  const LogoQpro({super.key, this.tamano = 40});

  final double tamano;

  @override
  Widget build(BuildContext context) => Container(
        width: tamano,
        height: tamano,
        padding: EdgeInsets.all(tamano * 0.08),
        decoration: BoxDecoration(
          color: QColors.white,
          borderRadius: BorderRadius.circular(tamano * 0.3),
          border: Border.all(color: QColors.stone200),
        ),
        child: Image.asset('assets/splash/logo.png', fit: BoxFit.contain, cacheWidth: (tamano * 3).round()),
      );
}
