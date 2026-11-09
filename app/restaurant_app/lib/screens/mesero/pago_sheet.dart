import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../models/cuenta.dart';
import '../../providers/salon_provider.dart';
import '../../services/api.dart';
import '../../theme/qpro_theme.dart';
import '../../utils/formato.dart';
import '../../widgets/q.dart';

/// Hoja "¿Cómo pagó la mesa?": la propina y uno o varios pagos (cada persona con su método,
/// partes iguales, efectivo + tarjeta). Cada transferencia lleva la foto de su comprobante.
/// Si lo avisado cubre toda la cuenta, la caja solo confirma y no puede cambiar nada.
Future<void> mostrarPago(BuildContext context, CuentaMesa cuenta) => showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => ChangeNotifierProvider.value(value: context.read<SalonProvider>(), child: PagoSheet(cuenta: cuenta)),
    );

enum _Propina { ninguna, sugerida, otra }

/// Un pago en edición: método, valor y foto.
class _Pago {
  _Pago({this.metodo = MetodoPago.efectivo, double monto = 0}) : monto = TextEditingController(text: monto > 0 ? monto.round().toString() : '');

  MetodoPago metodo;
  final TextEditingController monto;
  Uint8List? foto;
  String tipoFoto = 'image/jpeg';

  double get valor => double.tryParse(monto.text.replaceAll(RegExp(r'[^\d]'), '')) ?? 0;
}

class PagoSheet extends StatefulWidget {
  const PagoSheet({super.key, required this.cuenta, this.selector});

  final CuentaMesa cuenta;
  /// Para pruebas: reemplaza la cámara.
  final Future<XFile?> Function(ImageSource origen)? selector;

  @override
  State<PagoSheet> createState() => _PagoSheetState();
}

class _PagoSheetState extends State<PagoSheet> {
  _Propina _propina = _Propina.ninguna;
  final _otraPropina = TextEditingController();
  late final List<_Pago> _pagos;
  bool _enviando = false;

  double get _consumo => widget.cuenta.total;
  double get _valorPropina => switch (_propina) {
        _Propina.ninguna => 0,
        _Propina.sugerida => propinaSugerida(_consumo),
        _Propina.otra => double.tryParse(_otraPropina.text.replaceAll(RegExp(r'[^\d]'), '')) ?? 0,
      };
  double get _total => _consumo + _valorPropina;
  double get _pagado => _pagos.fold(0, (t, p) => t + p.valor);

  @override
  void initState() {
    super.initState();
    _pagos = [_Pago(metodo: widget.cuenta.solicitud?.metodo ?? MetodoPago.efectivo, monto: _consumo)];
  }

  @override
  void dispose() {
    _otraPropina.dispose();
    for (final p in _pagos) {
      p.monto.dispose();
    }
    super.dispose();
  }

  /// Con un solo pago, su valor sigue al total (el cliente paga todo de una vez).
  void _ajustarUnico() {
    if (_pagos.length == 1) _pagos.single.monto.text = _total.round().toString();
  }

  void _cambiarPropina(_Propina p) => setState(() {
        _propina = p;
        _ajustarUnico();
      });

  void _agregarPago() => setState(() {
        final falta = _total - _pagado;
        _pagos.add(_Pago(monto: falta > 0 ? falta : 0));
      });

  // El campo se desmonta en este cuadro: su controlador se libera después.
  void _soltar(Iterable<_Pago> pagos) {
    final controladores = pagos.map((p) => p.monto).toList();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final c in controladores) {
        c.dispose();
      }
    });
  }

  void _quitarPago(_Pago p) => setState(() {
        _pagos.remove(p);
        _soltar([p]);
        _ajustarUnico();
      });

  Future<void> _dividir() async {
    final personas = await showDialog<int>(
      context: context,
      builder: (contexto) => SimpleDialog(
        title: const Text('¿Entre cuántas personas?'),
        children: [
          for (var n = 2; n <= 8; n++)
            SimpleDialogOption(onPressed: () => Navigator.of(contexto).pop(n), child: Text('$n personas · ${pesos(_total / n)} c/u')),
        ],
      ),
    );
    if (personas == null || !mounted) return;
    setState(() {
      _soltar(List.of(_pagos));
      _pagos
        ..clear()
        ..addAll(partesIguales(_total, personas).map((m) => _Pago(monto: m)));
    });
  }

  Future<void> _tomarFoto(_Pago pago, ImageSource origen) async {
    try {
      final archivo = await (widget.selector?.call(origen) ??
          // Reducida a 1280 px: se lee bien el comprobante y pesa ~200 KB.
          ImagePicker().pickImage(source: origen, maxWidth: 1280, maxHeight: 1280, imageQuality: 70));
      if (archivo == null) return;
      final bytes = await archivo.readAsBytes();
      setState(() {
        pago.foto = bytes;
        pago.tipoFoto = archivo.mimeType ?? (archivo.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      });
    } catch (_) {
      if (mounted) avisar(context, 'No se pudo abrir la cámara. Revisa el permiso en Ajustes.', error: true);
    }
  }

  /// Lo que impide avisar, en palabras del mesero; null si se puede enviar.
  String? get _problema {
    if (_pagos.isEmpty) return 'Agrega al menos un pago';
    if (_valorPropina > _consumo) return 'La propina no puede ser mayor que la cuenta';
    if (_pagos.any((p) => p.valor <= 0)) return 'Cada pago debe tener su valor';
    if (_pagos.any((p) => p.metodo == MetodoPago.qr && p.foto == null)) return 'Falta la foto de una transferencia';
    if (_pagado - _total >= 1) return 'Los pagos se pasan por ${pesos(_pagado - _total)}: súmalo a la propina';
    return null;
  }

  Future<void> _enviar() async {
    setState(() => _enviando = true);
    try {
      await context.read<SalonProvider>().pedirCuenta(
            widget.cuenta.mesa.id,
            propina: _valorPropina,
            pagos: [
              for (final p in _pagos)
                PagoNuevo(
                  metodo: p.metodo,
                  monto: p.valor,
                  comprobante: p.metodo == MetodoPago.qr && p.foto != null ? 'data:${p.tipoFoto};base64,${base64Encode(p.foto!)}' : null,
                ),
            ],
          );
      if (!mounted) return;
      final falta = _total - _pagado;
      Navigator.of(context).pop();
      avisar(context, falta >= 1 ? 'Avisado: caja cobra los ${pesos(falta)} que faltan' : 'Pago completo avisado a caja');
    } on ApiException catch (e) {
      if (mounted) avisar(context, e.mensaje, error: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final falta = _total - _pagado;
    final problema = _problema;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('¿Cómo pagó la mesa ${widget.cuenta.mesa.numero}?', style: t.headlineSmall),
          const SizedBox(height: 4),
          Text('Cuenta ${pesos(_consumo)} · la caja confirma y emite la factura.', style: t.bodyMedium?.copyWith(fontFeatures: tabular)),
          const SizedBox(height: 16),
          Text('Propina voluntaria', style: t.titleSmall),
          const SizedBox(height: 8),
          SegmentedButton<_Propina>(
            showSelectedIcon: false,
            style: SegmentedButton.styleFrom(
              selectedBackgroundColor: QColors.espresso,
              selectedForegroundColor: QColors.white,
              side: const BorderSide(color: QColors.stone200),
              minimumSize: const Size(0, 44),
            ),
            segments: [
              const ButtonSegment(value: _Propina.ninguna, label: Text('Sin propina')),
              ButtonSegment(value: _Propina.sugerida, label: Text('10 % ${pesos(propinaSugerida(_consumo))}')),
              const ButtonSegment(value: _Propina.otra, label: Text('Otra')),
            ],
            selected: {_propina},
            onSelectionChanged: (s) => _cambiarPropina(s.first),
          ),
          if (_propina == _Propina.otra) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _otraPropina,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(labelText: 'Valor de la propina'),
              onChanged: (_) => setState(_ajustarUnico),
            ),
          ],
          const SizedBox(height: 20),
          Row(children: [
            Expanded(child: Text('Pagos', style: t.titleSmall)),
            TextButton.icon(onPressed: _dividir, icon: const Icon(Icons.groups_outlined), label: const Text('Partes iguales')),
          ]),
          for (final (i, p) in _pagos.indexed) ...[
            _FilaPago(
              numero: i + 1,
              pago: p,
              unico: _pagos.length == 1,
              onMetodo: (m) => setState(() => p.metodo = m),
              onMonto: () => setState(() {}),
              onFoto: (origen) => _tomarFoto(p, origen),
              onQuitar: _pagos.length > 1 ? () => _quitarPago(p) : null,
            ),
            const SizedBox(height: 10),
          ],
          QBoton(texto: 'Agregar otro pago', icono: Icons.add_rounded, variante: QVariante.secundario, onPressed: _agregarPago),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: QColors.stone100, borderRadius: BorderRadius.circular(QRadius.surface)),
            child: Column(children: [
              _Linea('Cuenta', pesos(_consumo)),
              if (_valorPropina > 0) _Linea('Propina', pesos(_valorPropina)),
              _Linea('Total', pesos(_total), fuerte: true),
              _Linea('Pagado', pesos(_pagado)),
              const SizedBox(height: 6),
              QChip(
                falta >= 1 ? 'Faltan ${pesos(falta)}: caja los cobra' : falta <= -1 ? 'Se pasa por ${pesos(-falta)}' : 'Cubre toda la cuenta',
                tono: falta >= 1 ? QTono.aviso : falta <= -1 ? QTono.peligro : QTono.ok,
              ),
            ]),
          ),
          const SizedBox(height: 16),
          if (problema != null) ...[
            Text(problema, textAlign: TextAlign.center, style: const TextStyle(color: QColors.dangerDeep, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
          ],
          QBoton(texto: 'Avisar a caja', alto: 56, expandir: true, cargando: _enviando, onPressed: problema == null ? _enviar : null),
        ]),
      ),
    );
  }
}

class _Linea extends StatelessWidget {
  const _Linea(this.etiqueta, this.valor, {this.fuerte = false});

  final String etiqueta;
  final String valor;
  final bool fuerte;

  @override
  Widget build(BuildContext context) {
    final estilo = TextStyle(fontSize: fuerte ? 17 : 14, fontWeight: fuerte ? FontWeight.w800 : FontWeight.w500, color: QColors.espresso, fontFeatures: tabular);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(children: [Text(etiqueta, style: estilo), const Spacer(), Text(valor, style: estilo)]),
    );
  }
}

class _FilaPago extends StatelessWidget {
  const _FilaPago({
    required this.numero,
    required this.pago,
    required this.unico,
    required this.onMetodo,
    required this.onMonto,
    required this.onFoto,
    this.onQuitar,
  });

  final int numero;
  final _Pago pago;
  final bool unico;
  final ValueChanged<MetodoPago> onMetodo;
  final VoidCallback onMonto;
  final ValueChanged<ImageSource> onFoto;
  final VoidCallback? onQuitar;

  @override
  Widget build(BuildContext context) {
    return QTarjeta(
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (!unico)
          Row(children: [
            Text('Pago $numero', style: Theme.of(context).textTheme.titleSmall),
            const Spacer(),
            IconButton(tooltip: 'Quitar el pago $numero', onPressed: onQuitar, icon: const Icon(Icons.delete_outline_rounded)),
          ]),
        for (final m in MetodoPago.values) ...[
          _OpcionMetodo(metodo: m, activa: pago.metodo == m, onTap: () => onMetodo(m)),
          const SizedBox(height: 6),
        ],
        const SizedBox(height: 4),
        TextField(
          controller: pago.monto,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(labelText: unico ? 'Valor pagado' : 'Valor del pago $numero', prefixText: '\$ '),
          onChanged: (_) => onMonto(),
        ),
        if (pago.metodo == MetodoPago.qr) ...[
          const SizedBox(height: 10),
          if (pago.foto != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(QRadius.surface),
              child: Image.memory(
                pago.foto!,
                height: 180,
                fit: BoxFit.contain,
                semanticLabel: 'Foto del comprobante del pago $numero',
                errorBuilder: (_, __, ___) => const QChip('No se pudo mostrar la foto: tómala otra vez', tono: QTono.peligro),
              ),
            ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: QBoton(
                texto: pago.foto == null ? 'Tomar foto' : 'Repetir foto',
                icono: Icons.photo_camera_outlined,
                variante: pago.foto == null ? QVariante.primario : QVariante.secundario,
                onPressed: () => onFoto(ImageSource.camera),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: QBoton(texto: 'Galería', icono: Icons.photo_library_outlined, variante: QVariante.secundario, onPressed: () => onFoto(ImageSource.gallery)),
            ),
          ]),
        ],
      ]),
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
          borderRadius: BorderRadius.circular(QRadius.control),
          side: BorderSide(color: activa ? QColors.espresso : QColors.stone200),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(children: [
              Icon(icono, color: activa ? QColors.caramel : QColors.caramelDeep),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(metodo.nombre, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: activa ? QColors.white : QColors.espresso)),
                  Text(metodo.ayuda, style: TextStyle(fontSize: 12, color: activa ? QColors.caramelLight : QColors.stone500)),
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
