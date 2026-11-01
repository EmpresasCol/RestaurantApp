import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../models/domicilio_domiciliario.dart';
import '../../providers/domiciliario_provider.dart';
import '../../services/api.dart';
import '../../theme/qpro_theme.dart';
import '../../utils/formato.dart';
import '../../widgets/q.dart';

/// Cómo pagó el cliente del domicilio, con los valores de la API.
const metodosEntrega = [
  ('Efectivo', 'Efectivo', Icons.payments_outlined),
  ('Nequi', 'Nequi', Icons.phone_iphone_rounded),
  ('Daviplata', 'Daviplata', Icons.phone_iphone_rounded),
  ('Transferencia', 'Transferencia', Icons.account_balance_outlined),
  ('Tarjeta', 'Tarjeta (datáfono)', Icons.credit_card_rounded),
];

bool esTransferencia(String metodo) => metodo == 'Nequi' || metodo == 'Daviplata' || metodo == 'Transferencia';

/// Al entregar: cómo pagó de verdad el cliente (puede no ser lo que dijo al pedir), el cambio si es
/// efectivo y la foto del comprobante si transfirió. La API emite la factura.
Future<bool?> mostrarCobroEntrega(BuildContext context, DomicilioDomiciliario domicilio) => showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => ChangeNotifierProvider.value(
        value: context.read<DomiciliarioProvider>(),
        child: CobroEntregaSheet(domicilio: domicilio),
      ),
    );

class CobroEntregaSheet extends StatefulWidget {
  const CobroEntregaSheet({super.key, required this.domicilio, this.selector});

  final DomicilioDomiciliario domicilio;
  /// Para pruebas: reemplaza la cámara.
  final Future<XFile?> Function(ImageSource origen)? selector;

  @override
  State<CobroEntregaSheet> createState() => _CobroEntregaSheetState();
}

class _CobroEntregaSheetState extends State<CobroEntregaSheet> {
  late String _metodo;
  Uint8List? _foto;
  String _tipoFoto = 'image/jpeg';
  bool _enviando = false;

  @override
  void initState() {
    super.initState();
    _metodo = metodosEntrega.any((m) => m.$1 == widget.domicilio.metodoPago) ? widget.domicilio.metodoPago : 'Efectivo';
  }

  Future<void> _tomarFoto(ImageSource origen) async {
    try {
      final archivo = await (widget.selector?.call(origen) ??
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

  bool get _listo => !esTransferencia(_metodo) || _foto != null;

  Future<void> _entregar() async {
    setState(() => _enviando = true);
    try {
      await context.read<DomiciliarioProvider>().entregar(
            widget.domicilio.id,
            metodoPago: _metodo,
            comprobante: esTransferencia(_metodo) && _foto != null ? 'data:$_tipoFoto;base64,${base64Encode(_foto!)}' : null,
          );
      HapticFeedback.mediumImpact();
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) avisar(context, e.mensaje, error: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.domicilio;
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Cobrar ${pesos(d.total)}', style: t.headlineSmall?.copyWith(fontFeatures: tabular)),
          const SizedBox(height: 4),
          Text('¿Cómo pagó el cliente? Si cambió de idea, elige lo que pagó de verdad.', style: t.bodyMedium),
          const SizedBox(height: 14),
          for (final (api, nombre, icono) in metodosEntrega) ...[
            Material(
              color: _metodo == api ? QColors.espresso : QColors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(QRadius.control),
                side: BorderSide(color: _metodo == api ? QColors.espresso : QColors.stone200),
              ),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => setState(() => _metodo = api),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  child: Row(children: [
                    Icon(icono, color: _metodo == api ? QColors.caramel : QColors.caramelDeep),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(nombre, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: _metodo == api ? QColors.white : QColors.espresso)),
                    ),
                    if (_metodo == api) const Icon(Icons.check_circle_rounded, color: QColors.caramel),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 6),
          ],
          const SizedBox(height: 8),
          if (_metodo == 'Efectivo' && d.cambio != null)
            QChip('Paga con ${pesos(d.pagaCon!)}: entrega ${pesos(d.cambio!)} de cambio', tono: QTono.aviso, icono: Icons.payments_outlined),
          if (_metodo == 'Efectivo')
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('Este efectivo lo entregas en caja al volver.', style: t.bodySmall),
            ),
          if (esTransferencia(_metodo)) ...[
            if (_foto != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(QRadius.surface),
                child: Image.memory(_foto!, height: 200, fit: BoxFit.contain, semanticLabel: 'Foto del comprobante'),
              ),
            const SizedBox(height: 8),
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
          QBoton(
            texto: _listo ? 'Entregado y cobrado' : 'Toma la foto de la transferencia',
            alto: 56,
            expandir: true,
            cargando: _enviando,
            onPressed: _listo ? _entregar : null,
          ),
        ]),
      ),
    );
  }
}
