import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../models/cuenta.dart';
import '../../providers/salon_provider.dart';
import '../../services/api.dart';
import '../../theme/qpro_theme.dart';
import '../../utils/formato.dart';
import '../../widgets/q.dart';

/// Hoja "¿Cómo pagó la mesa?": efectivo que el mesero lleva a caja, tarjeta en el
/// datáfono o transferencia al QR del negocio con la foto del comprobante.
Future<void> mostrarPago(BuildContext context, CuentaMesa cuenta) => showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => ChangeNotifierProvider.value(value: context.read<SalonProvider>(), child: PagoSheet(cuenta: cuenta)),
    );

class PagoSheet extends StatefulWidget {
  const PagoSheet({super.key, required this.cuenta, this.selector});

  final CuentaMesa cuenta;
  /// Para pruebas: reemplaza la cámara.
  final Future<XFile?> Function(ImageSource origen)? selector;

  @override
  State<PagoSheet> createState() => _PagoSheetState();
}

class _PagoSheetState extends State<PagoSheet> {
  MetodoPago? _metodo;
  Uint8List? _foto;
  String _tipoFoto = 'image/jpeg';
  bool _enviando = false;

  @override
  void initState() {
    super.initState();
    _metodo = widget.cuenta.solicitud?.metodo;
  }

  Future<void> _tomarFoto(ImageSource origen) async {
    try {
      final archivo = await (widget.selector?.call(origen) ??
          // Reducida a 1280 px: se lee bien el comprobante y pesa ~200 KB.
          ImagePicker().pickImage(source: origen, maxWidth: 1280, maxHeight: 1280, imageQuality: 70));
      if (archivo == null) return;
      final bytes = await archivo.readAsBytes();
      setState(() {
        _foto = bytes;
        _tipoFoto = archivo.mimeType ?? (archivo.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      });
    } catch (_) {
      if (mounted) avisar(context, 'No se pudo abrir la cámara. Revisa el permiso en Ajustes.', error: true);
    }
  }

  bool get _listo => _metodo != null && (_metodo != MetodoPago.qr || _foto != null || (widget.cuenta.solicitud?.tieneComprobante ?? false));

  Future<void> _enviar() async {
    setState(() => _enviando = true);
    try {
      await context.read<SalonProvider>().pedirCuenta(
            widget.cuenta.mesa.id,
            metodo: _metodo,
            comprobante: _foto == null ? null : 'data:$_tipoFoto;base64,${base64Encode(_foto!)}',
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      avisar(context, switch (_metodo!) {
        MetodoPago.efectivo => 'Avisado. Lleva el dinero a caja.',
        MetodoPago.tarjeta => 'Avisado a caja: pago con tarjeta',
        MetodoPago.qr => 'Comprobante enviado a caja',
      });
    } on ApiException catch (e) {
      if (mounted) avisar(context, e.mensaje, error: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('¿Cómo pagó la mesa ${widget.cuenta.mesa.numero}?', style: t.headlineSmall),
          const SizedBox(height: 4),
          Text('Total ${pesos(widget.cuenta.total)} · la caja confirma el cobro y emite la factura.', style: t.bodyMedium?.copyWith(fontFeatures: tabular)),
          const SizedBox(height: 16),
          for (final m in MetodoPago.values) ...[
            _OpcionMetodo(metodo: m, activa: _metodo == m, onTap: () => setState(() => _metodo = m)),
            const SizedBox(height: 8),
          ],
          if (_metodo == MetodoPago.qr) ...[
            const SizedBox(height: 8),
            if (_foto != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(QRadius.surface),
                child: Image.memory(
                  _foto!,
                  height: 220,
                  fit: BoxFit.contain,
                  semanticLabel: 'Foto del comprobante',
                  errorBuilder: (_, __, ___) => const QChip('No se pudo mostrar la foto: tómala otra vez', tono: QTono.peligro),
                ),
              )
            else if (widget.cuenta.solicitud?.tieneComprobante ?? false)
              const QChip('Caja ya tiene la foto. Toma otra si quieres reemplazarla.', tono: QTono.info, icono: Icons.check_rounded),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: QBoton(
                  texto: _foto == null ? 'Tomar foto' : 'Repetir foto',
                  icono: Icons.photo_camera_outlined,
                  variante: _foto == null ? QVariante.primario : QVariante.secundario,
                  onPressed: () => _tomarFoto(ImageSource.camera),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: QBoton(texto: 'Galería', icono: Icons.photo_library_outlined, variante: QVariante.secundario, onPressed: () => _tomarFoto(ImageSource.gallery)),
              ),
            ]),
          ],
          const SizedBox(height: 20),
          QBoton(texto: 'Avisar a caja', alto: 56, expandir: true, cargando: _enviando, onPressed: _listo ? _enviar : null),
        ]),
      ),
    );
  }
}

class _OpcionMetodo extends StatelessWidget {
  const _OpcionMetodo({required this.metodo, required this.activa, required this.onTap});

  final MetodoPago metodo;
  final bool activa;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final icono = switch (metodo) {
      MetodoPago.efectivo => Icons.payments_outlined,
      MetodoPago.tarjeta => Icons.credit_card_rounded,
      MetodoPago.qr => Icons.qr_code_2_rounded,
    };
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: activa,
      button: true,
      child: Material(
        color: activa ? QColors.espresso : QColors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(QRadius.surface),
          side: BorderSide(color: activa ? QColors.espresso : QColors.stone200),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: activa ? QColors.espressoRaised : QColors.caramelWash, borderRadius: BorderRadius.circular(QRadius.control)),
                child: Icon(icono, color: activa ? QColors.caramel : QColors.caramelDeep),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(metodo.nombre, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: activa ? QColors.white : QColors.espresso)),
                  Text(metodo.ayuda, style: TextStyle(fontSize: 13, color: activa ? QColors.caramelLight : QColors.stone500)),
                ]),
              ),
              if (activa) const Icon(Icons.check_circle_rounded, color: QColors.caramel),
            ]),
          ),
        ),
      ),
    );
  }
}
