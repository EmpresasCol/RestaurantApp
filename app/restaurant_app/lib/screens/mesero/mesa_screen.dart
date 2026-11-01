import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/cuenta.dart';
import '../../models/pedido.dart';
import '../../providers/salon_provider.dart';
import '../../services/api.dart';
import '../../theme/qpro_theme.dart';
import '../../utils/formato.dart';
import '../../widgets/q.dart';
import 'carta_screen.dart';
import 'pago_sheet.dart';
import 'salon_screen.dart' show servirPedido;

/// La cuenta de una mesa: sus pedidos, lo que se puede cambiar y el cobro.
///
/// Como en el salón real: el mesero edita o cancela solo lo que la cocina no ha
/// empezado; lo que se pide después va como pedido nuevo de la misma mesa.
/// Para cobrar pide la cuenta a caja (la imprime), la lleva a la mesa y luego
/// avisa cómo pagó el cliente: la caja hace el cobro y la factura.
class MesaScreen extends StatelessWidget {
  const MesaScreen({super.key, required this.mesaId});

  final int mesaId;

  @override
  Widget build(BuildContext context) {
    final salon = context.watch<SalonProvider>();
    final cuenta = salon.cuenta(mesaId);
    final t = Theme.of(context).textTheme;

    if (cuenta == null) {
      return Scaffold(appBar: AppBar(), body: const Vacio(icono: Icons.table_restaurant_outlined, titulo: 'Esta mesa ya no existe'));
    }

    void tomarPedido() => Navigator.of(context).push(MaterialPageRoute(builder: (_) => CartaScreen(mesa: cuenta.mesa)));

    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Mesa ${cuenta.mesa.numero}'),
          Text(
            cuenta.libre ? 'Libre' : 'Desde las ${hora(cuenta.desde!)} · ${plural(cuenta.pedidos.length, 'pedido')}',
            style: t.bodySmall,
          ),
        ]),
      ),
      body: RefreshIndicator(
        color: QColors.espresso,
        onRefresh: salon.cargar,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            if (cuenta.solicitud != null) ...[_AvisoCuenta(solicitud: cuenta.solicitud!), const SizedBox(height: 12)],
            if (cuenta.libre)
              Vacio(
                icono: Icons.table_restaurant_outlined,
                titulo: 'Mesa libre',
                texto: 'Toma el pedido y envíalo a cocina.',
                accion: QBoton(texto: 'Tomar pedido', icono: Icons.add_rounded, alto: 56, onPressed: tomarPedido),
              )
            else
              for (final p in cuenta.pedidos) ...[_TarjetaPedido(pedido: p, mesa: cuenta), const SizedBox(height: 12)],
          ],
        ),
      ),
      bottomNavigationBar: cuenta.libre ? null : _BarraCuenta(cuenta: cuenta, onAgregar: tomarPedido),
    );
  }
}

class _AvisoCuenta extends StatelessWidget {
  const _AvisoCuenta({required this.solicitud});

  final SolicitudCuenta solicitud;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
      decoration: BoxDecoration(color: QColors.tealWash, borderRadius: BorderRadius.circular(QRadius.surface)),
      child: Row(children: [
        const Icon(Icons.receipt_long_rounded, color: QColors.tealDeep),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(solicitud.texto, style: const TextStyle(color: QColors.tealDeep, fontWeight: FontWeight.w800)),
            Text(
              solicitud.metodo == null
                  ? 'Recoge la cuenta impresa en caja · ${hora(solicitud.fecha)}'
                  : 'Avisado a las ${hora(solicitud.fechaPago ?? solicitud.fecha)}${solicitud.tieneComprobante ? ' · con foto' : ''}',
              style: const TextStyle(color: QColors.tealDeep, fontSize: 13, fontFeatures: tabular),
            ),
          ]),
        ),
        TextButton(
          onPressed: () async {
            try {
              await context.read<SalonProvider>().anularSolicitud(solicitud.id);
              if (context.mounted) avisar(context, 'Solicitud de cuenta anulada');
            } on ApiException catch (e) {
              if (context.mounted) avisar(context, e.mensaje, error: true);
            }
          },
          style: TextButton.styleFrom(foregroundColor: QColors.tealDeep),
          child: const Text('Anular'),
        ),
      ]),
    );
  }
}

class _TarjetaPedido extends StatelessWidget {
  const _TarjetaPedido({required this.pedido, required this.mesa});

  final Pedido pedido;
  final CuentaMesa mesa;

  QTono get _tono => switch (pedido.estado) {
        EstadoPedido.listo || EstadoPedido.entregado => QTono.ok,
        EstadoPedido.enProceso => QTono.aviso,
        _ => QTono.neutro,
      };

  Future<void> _cancelar(BuildContext context) async {
    try {
      await context.read<SalonProvider>().cancelar(pedido.id);
      if (context.mounted) avisar(context, 'Pedido #${pedido.id} cancelado');
    } on ApiException catch (e) {
      if (context.mounted) avisar(context, e.mensaje, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return QTarjeta(
      borde: pedido.porServir ? const Color(0xFF86EFAC) : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('Pedido #${pedido.id}', style: t.titleMedium?.copyWith(fontWeight: FontWeight.w800, fontFeatures: tabular))),
          QChip(pedido.etapa, tono: _tono),
        ]),
        const SizedBox(height: 2),
        Text(
          '${hora(pedido.fecha)}${pedido.meseroNombre.isNotEmpty ? ' · ${pedido.meseroNombre}' : ''}',
          style: t.bodySmall?.copyWith(fontFeatures: tabular),
        ),
        const SizedBox(height: 10),
        for (final d in pedido.detalles)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(
                width: 30,
                child: Text('${d.cantidad}×', style: t.titleSmall?.copyWith(color: QColors.caramelDeep, fontFeatures: tabular)),
              ),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(d.platilloNombre, style: t.titleSmall),
                  if ((d.nota ?? '').isNotEmpty) Text(d.nota!, style: t.bodySmall?.copyWith(color: QColors.stone600)),
                ]),
              ),
              Text(pesos(d.subtotal), style: t.bodyMedium?.copyWith(fontFeatures: tabular)),
            ]),
          ),
        const Divider(height: 20),
        if (pedido.editable)
          Row(children: [
            Expanded(
              child: QBoton(
                texto: 'Editar',
                icono: Icons.edit_outlined,
                variante: QVariante.secundario,
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => CartaScreen(mesa: mesa.mesa, editar: pedido))),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: BotonConfirmar(
                texto: 'Cancelar',
                confirmar: '¿Cancelar?',
                icono: Icons.close_rounded,
                variante: QVariante.peligro,
                onConfirmar: () => _cancelar(context),
              ),
            ),
          ])
        else if (pedido.porServir)
          BotonConfirmar(
            texto: 'Marcar servido',
            icono: Icons.room_service_outlined,
            expandir: true,
            onConfirmar: () => servirPedido(context, pedido),
          )
        else if (pedido.estado == EstadoPedido.enProceso)
          Text('La cocina ya lo está preparando. Si piden algo más, agrégalo como pedido nuevo.', style: t.bodySmall)
        else
          Row(children: [
            Text('Total del pedido', style: t.bodySmall),
            const Spacer(),
            Text(pesos(pedido.total), style: t.titleSmall?.copyWith(fontFeatures: tabular)),
          ]),
      ]),
    );
  }
}

class _BarraCuenta extends StatefulWidget {
  const _BarraCuenta({required this.cuenta, required this.onAgregar});

  final CuentaMesa cuenta;
  final VoidCallback onAgregar;

  @override
  State<_BarraCuenta> createState() => _BarraCuentaState();
}

class _BarraCuentaState extends State<_BarraCuenta> {
  bool _enviando = false;

  Future<void> _pedirCuenta() async {
    setState(() => _enviando = true);
    try {
      await context.read<SalonProvider>().pedirCuenta(widget.cuenta.mesa.id);
      if (mounted) {
        avisar(context, widget.cuenta.enCocina > 0 ? 'Cuenta pedida. Caja cobra cuando cocina termine.' : 'Cuenta pedida: recógela en caja');
      }
    } on ApiException catch (e) {
      if (mounted) avisar(context, e.mensaje, error: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cuenta = widget.cuenta;
    final t = Theme.of(context).textTheme;
    final pedida = cuenta.solicitud != null;
    return Container(
      decoration: const BoxDecoration(color: QColors.white, border: Border(top: BorderSide(color: QColors.stone200))),
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          Expanded(child: Text('Total de la mesa', style: t.bodyMedium, overflow: TextOverflow.ellipsis)),
          Text(pesos(cuenta.total), style: t.headlineSmall?.copyWith(fontFeatures: tabular)),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
            flex: 2,
            child: QBoton(texto: 'Agregar', icono: Icons.add_rounded, variante: QVariante.secundario, alto: 56, onPressed: widget.onAgregar),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 3,
            child: pedida
                ? QBoton(
                    texto: cuenta.solicitud!.metodo == null ? 'Registrar pago' : 'Cambiar pago',
                    icono: Icons.payments_outlined,
                    alto: 56,
                    variante: cuenta.solicitud!.metodo == null ? QVariante.primario : QVariante.secundario,
                    onPressed: () => mostrarPago(context, cuenta),
                  )
                : QBoton(texto: 'Pedir la cuenta', icono: Icons.receipt_long_outlined, alto: 56, cargando: _enviando, onPressed: _pedirCuenta),
          ),
        ]),
      ]),
    );
  }
}
