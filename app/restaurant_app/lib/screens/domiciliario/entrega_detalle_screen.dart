import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/domicilio_domiciliario.dart';
import '../../providers/domiciliario_provider.dart';
import '../../services/api.dart';
import '../../theme/qpro_theme.dart';
import '../../utils/formato.dart';
import '../../widgets/q.dart';

/// Detalle de un domicilio con el siguiente paso de la entrega:
/// recoger en el restaurante → salir a entregar → entregado (y cobrado).
class EntregaDetalleScreen extends StatelessWidget {
  const EntregaDetalleScreen({super.key, required this.domicilioId});

  final int domicilioId;

  /// Teléfono colombiano para WhatsApp: solo dígitos y con 57 delante.
  static String telefonoWhatsApp(String telefono) {
    final digitos = telefono.replaceAll(RegExp(r'\D'), '');
    return digitos.length == 10 ? '57$digitos' : digitos;
  }

  Future<void> _abrir(BuildContext context, Uri uri) async {
    try {
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) throw Exception();
    } catch (_) {
      if (context.mounted) avisar(context, 'No se pudo abrir en este celular', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = context.watch<DomiciliarioProvider>().pedido(domicilioId);
    final t = Theme.of(context).textTheme;

    if (d == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Vacio(icono: Icons.task_alt_rounded, titulo: 'Este domicilio ya no está en tu lista', texto: 'Lo entregaste o lo tomó otro domiciliario.'),
      );
    }

    final direccion = [d.direccionCompleta, if ((d.barrio ?? '').isNotEmpty) d.barrio].join(', ');

    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Domicilio #${d.id}'),
          Text('${d.etapa} · pedido a las ${hora(d.fechaPedido)}', style: t.bodySmall),
        ]),
      ),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 24), children: [
        _Seccion(titulo: 'Cliente', children: [
          Text(d.clienteNombre, style: t.titleMedium),
          Text(d.clienteTelefono, style: t.bodyMedium?.copyWith(fontFeatures: tabular)),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: QBoton(
                texto: 'Llamar',
                icono: Icons.call_outlined,
                variante: QVariante.secundario,
                onPressed: () => _abrir(context, Uri(scheme: 'tel', path: d.clienteTelefono)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: QBoton(
                texto: 'WhatsApp',
                icono: Icons.chat_outlined,
                variante: QVariante.secundario,
                onPressed: () => _abrir(context, Uri.parse('https://wa.me/${telefonoWhatsApp(d.clienteTelefono)}')),
              ),
            ),
          ]),
        ]),
        _Seccion(titulo: 'Dirección', children: [
          Text(direccion, style: t.titleMedium),
          if ((d.referenciasAdicionales ?? '').isNotEmpty) ...[const SizedBox(height: 4), Text(d.referenciasAdicionales!, style: t.bodyMedium)],
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: QBoton(
                texto: 'Abrir en el mapa',
                icono: Icons.map_outlined,
                variante: QVariante.secundario,
                onPressed: () => _abrir(context, Uri.https('www.google.com', '/maps/search/', {'api': '1', 'query': direccion})),
              ),
            ),
            const SizedBox(width: 10),
            IconButton.outlined(
              tooltip: 'Copiar dirección',
              style: IconButton.styleFrom(fixedSize: const Size(48, 48), side: const BorderSide(color: QColors.stone300)),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: direccion));
                avisar(context, 'Dirección copiada');
              },
              icon: const Icon(Icons.copy_rounded),
            ),
          ]),
        ]),
        _Seccion(titulo: 'Productos', children: [
          for (final item in d.detalles)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(width: 30, child: Text('${item.cantidad}×', style: t.titleSmall?.copyWith(color: QColors.caramelDeep, fontFeatures: tabular))),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(item.platilloNombre, style: t.titleSmall),
                    if (item.nota.isNotEmpty) Text(item.nota, style: t.bodySmall),
                  ]),
                ),
                Text(pesos(item.subtotal), style: t.bodyMedium?.copyWith(fontFeatures: tabular)),
              ]),
            ),
        ]),
        _Seccion(titulo: 'Pago', children: [
          _Fila('Productos', pesos(d.subtotal)),
          _Fila('Envío', pesos(d.costoEnvio)),
          const Divider(height: 16),
          _Fila('Total', pesos(d.total), fuerte: true),
          const SizedBox(height: 10),
          d.pagadoAnticipado
              ? const QChip('Pagado por anticipado: no cobres', tono: QTono.ok, icono: Icons.check_rounded)
              : QChip('Cobra ${pesos(d.porCobrar)} · ${d.metodoPago}', tono: QTono.aviso, icono: Icons.payments_outlined),
        ]),
        if ((d.notasCliente ?? '').isNotEmpty)
          _Seccion(titulo: 'Notas del cliente', children: [Text(d.notasCliente!, style: t.bodyLarge)]),
      ]),
      bottomNavigationBar: _Accion(domicilio: d),
    );
  }
}

class _Seccion extends StatelessWidget {
  const _Seccion({required this.titulo, required this.children});

  final String titulo;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: QTarjeta(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(titulo, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            ...children,
          ]),
        ),
      );
}

class _Fila extends StatelessWidget {
  const _Fila(this.etiqueta, this.valor, {this.fuerte = false});

  final String etiqueta;
  final String valor;
  final bool fuerte;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final estilo = (fuerte ? t.titleMedium?.copyWith(fontWeight: FontWeight.w800) : t.bodyMedium)?.copyWith(fontFeatures: tabular);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(children: [Text(etiqueta, style: estilo), const Spacer(), Text(valor, style: estilo)]),
    );
  }
}

class _Accion extends StatelessWidget {
  const _Accion({required this.domicilio});

  final DomicilioDomiciliario domicilio;

  Future<void> _hacer(BuildContext context, Future<void> Function() accion, String exito) async {
    try {
      await accion();
      HapticFeedback.mediumImpact();
      if (context.mounted) avisar(context, exito);
    } on ApiException catch (e) {
      if (context.mounted) avisar(context, e.mensaje, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.read<DomiciliarioProvider>();
    final d = domicilio;
    final Widget boton = switch (d.estado) {
      'Listo' => BotonConfirmar(
          texto: 'Recoger en el restaurante',
          confirmar: 'Toca otra vez: lo llevo yo',
          icono: Icons.shopping_bag_outlined,
          alto: 56,
          expandir: true,
          onConfirmar: () => _hacer(context, () => p.recoger(d.id), 'Domicilio #${d.id} es tuyo'),
        ),
      'Recogido' => QBoton(
          texto: 'Salir a entregar',
          icono: Icons.delivery_dining_outlined,
          alto: 56,
          expandir: true,
          onPressed: () => _hacer(context, () => p.salir(d.id), 'En camino a ${d.barrio ?? 'la dirección'}'),
        ),
      'EnCamino' => BotonConfirmar(
          texto: d.pagadoAnticipado ? 'Entregado al cliente' : 'Entregado y cobrado ${pesos(d.porCobrar)}',
          confirmar: 'Toca otra vez para confirmar la entrega',
          icono: Icons.task_alt_rounded,
          alto: 56,
          expandir: true,
          onConfirmar: () async {
            await _hacer(context, () => p.entregar(d.id), 'Domicilio #${d.id} entregado');
            if (context.mounted && p.pedido(d.id) == null) Navigator.of(context).maybePop();
          },
        ),
      _ => const SizedBox.shrink(),
    };
    return Container(
      decoration: const BoxDecoration(color: QColors.white, border: Border(top: BorderSide(color: QColors.stone200))),
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
      child: boton,
    );
  }
}
