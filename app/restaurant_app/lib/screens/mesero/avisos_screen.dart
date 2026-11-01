import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/notificacion_provider.dart';
import '../../providers/salon_provider.dart';
import '../../theme/qpro_theme.dart';
import '../../utils/formato.dart';
import '../../widgets/q.dart';
import 'mesa_screen.dart';

/// Avisos de "pedido listo" que llegaron por push.
class AvisosScreen extends StatelessWidget {
  const AvisosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final avisos = context.watch<NotificacionProvider>();
    final t = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Avisos'),
        actions: [
          if (avisos.noLeidas > 0) TextButton(onPressed: avisos.marcarTodasLeidas, child: const Text('Marcar leídos')),
          if (avisos.notificaciones.isNotEmpty && avisos.noLeidas == 0) TextButton(onPressed: avisos.limpiar, child: const Text('Borrar todo')),
        ],
      ),
      body: avisos.notificaciones.isEmpty
          ? const Center(
              child: Vacio(
                icono: Icons.notifications_none_rounded,
                titulo: 'Sin avisos',
                texto: 'Aquí llega cada pedido que la cocina marca como listo.',
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: avisos.notificaciones.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final n = avisos.notificaciones[i];
                return QTarjeta(
                  color: n.leida ? QColors.white : QColors.caramelWash,
                  onTap: () {
                    avisos.marcarLeida(n.id);
                    final mesa = context.read<SalonProvider>().mesaPorNumero(n.mesaNumero);
                    if (mesa != null) Navigator.of(context).push(MaterialPageRoute(builder: (_) => MesaScreen(mesaId: mesa.id)));
                  },
                  child: Row(children: [
                    Icon(Icons.room_service_outlined, color: n.leida ? QColors.stone400 : QColors.caramelDeep),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(n.titulo, style: t.titleSmall),
                        if (n.mensaje.isNotEmpty) Text(n.mensaje, style: t.bodyMedium),
                      ]),
                    ),
                    Text(hora(n.fecha), style: t.bodySmall?.copyWith(fontFeatures: tabular)),
                  ]),
                );
              },
            ),
    );
  }
}
