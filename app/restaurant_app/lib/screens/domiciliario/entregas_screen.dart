import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/domicilio_domiciliario.dart';
import '../../providers/auth_provider.dart';
import '../../providers/domiciliario_provider.dart';
import '../../theme/qpro_theme.dart';
import '../../utils/formato.dart';
import '../../widgets/q.dart';
import 'entrega_detalle_screen.dart';

/// Inicio del domiciliario: sus entregas en curso y los domicilios listos para recoger.
class EntregasScreen extends StatefulWidget {
  const EntregasScreen({super.key});

  @override
  State<EntregasScreen> createState() => _EntregasScreenState();
}

class _EntregasScreenState extends State<EntregasScreen> {
  bool? _verMias;

  @override
  Widget build(BuildContext context) {
    final p = context.watch<DomiciliarioProvider>();
    final usuario = context.select<AuthProvider, String>((a) => a.usuario?.primerNombre ?? '');
    final t = Theme.of(context).textTheme;
    // Si tiene entregas en curso, empieza por ellas.
    final verMias = _verMias ?? p.mios.isNotEmpty;
    final lista = verMias ? p.mios : p.libres;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: const Row(children: [LogoQpro(tamano: 36), SizedBox(width: 10), Text('Entregas')]),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => context.read<AuthProvider>().cerrarSesion(),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: QColors.espresso,
        onRefresh: p.cargar,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
          children: [
            Row(children: [
              Expanded(child: Text(usuario.isEmpty ? 'Hola' : 'Hola, $usuario', style: t.headlineSmall)),
              QChip('${plural(p.entregasHoy, 'entrega', 'entregas')} hoy', tono: QTono.marca),
            ]),
            if (p.efectivoPorEntregar > 0) ...[
              const SizedBox(height: 12),
              QTarjeta(
                color: QColors.warningWash,
                child: Row(children: [
                  const Icon(Icons.payments_outlined, color: QColors.warningText),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Tienes ${pesos(p.efectivoPorEntregar)} en efectivo: entrégalo en caja',
                      style: const TextStyle(fontWeight: FontWeight.w800, color: QColors.warningText, fontFeatures: tabular),
                    ),
                  ),
                ]),
              ),
            ],
            const SizedBox(height: 16),
            SegmentedButton<bool>(
              showSelectedIcon: false,
              style: SegmentedButton.styleFrom(
                selectedBackgroundColor: QColors.espresso,
                selectedForegroundColor: QColors.white,
                foregroundColor: QColors.stone600,
                side: const BorderSide(color: QColors.stone200),
                minimumSize: const Size(0, 44),
                textStyle: const TextStyle(fontFamily: 'Manrope', fontWeight: FontWeight.w700),
              ),
              segments: [
                ButtonSegment(value: true, label: Text('Mis entregas (${p.mios.length})')),
                ButtonSegment(value: false, label: Text('Para recoger (${p.libres.length})')),
              ],
              selected: {verMias},
              onSelectionChanged: (s) => setState(() => _verMias = s.first),
            ),
            const SizedBox(height: 16),
            if (!p.cargado && p.cargando)
              const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))
            else if (!p.cargado && p.error != null)
              ErrorCarga(mensaje: p.error!, onReintentar: p.cargar)
            else if (lista.isEmpty)
              Vacio(
                icono: Icons.delivery_dining_outlined,
                titulo: verMias ? 'No tienes entregas en curso' : 'No hay domicilios listos',
                texto: verMias ? 'Recoge un domicilio de la lista "Para recoger".' : 'Te avisamos aquí apenas la cocina termine uno.',
              )
            else
              for (final d in lista) ...[_TarjetaDomicilio(domicilio: d), const SizedBox(height: 10)],
            if (p.error != null && p.cargado) ...[
              const SizedBox(height: 8),
              const Center(child: QChip('Sin conexión: mostrando lo último que cargó', tono: QTono.peligro, icono: Icons.wifi_off_rounded)),
            ],
          ],
        ),
      ),
    );
  }
}

class _TarjetaDomicilio extends StatelessWidget {
  const _TarjetaDomicilio({required this.domicilio});

  final DomicilioDomiciliario domicilio;

  @override
  Widget build(BuildContext context) {
    final d = domicilio;
    final t = Theme.of(context).textTheme;
    return QTarjeta(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => EntregaDetalleScreen(domicilioId: d.id))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text('Domicilio #${d.id}', style: t.titleMedium?.copyWith(fontWeight: FontWeight.w800, fontFeatures: tabular)),
          const SizedBox(width: 8),
          QChip(d.etapa, tono: d.estado == 'Listo' ? QTono.ok : d.enCocina ? QTono.aviso : QTono.info),
          const Spacer(),
          Text(hora(d.fechaPedido), style: t.bodySmall?.copyWith(fontFeatures: tabular)),
        ]),
        const SizedBox(height: 8),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.place_outlined, size: 18, color: QColors.tealDeep),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              [d.direccionCompleta, if ((d.barrio ?? '').isNotEmpty) d.barrio].join(' · '),
              style: t.bodyLarge,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Text(d.clienteNombre, style: t.bodyMedium),
          const Spacer(),
          if (d.pagadoAnticipado)
            const QChip('Pagado', tono: QTono.ok, icono: Icons.check_rounded)
          else
            Text('Cobrar ${pesos(d.porCobrar)}', style: t.titleSmall?.copyWith(fontWeight: FontWeight.w800, fontFeatures: tabular)),
        ]),
      ]),
    );
  }
}
