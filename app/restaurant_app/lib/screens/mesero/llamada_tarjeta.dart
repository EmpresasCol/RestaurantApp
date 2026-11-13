import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/llamada.dart';
import '../../providers/auth_provider.dart';
import '../../providers/salon_provider.dart';
import '../../services/api.dart';
import '../../theme/qpro_theme.dart';
import '../../utils/formato.dart';
import '../../widgets/q.dart';

/// Un comensal llamó desde el QR. "Voy" la toma (los demás meseros ven quién va) y
/// "Atendida" la cierra. Si dos meseros tocan a la vez, la API deja pasar a uno y al otro
/// le dice quién va.
class TarjetaLlamada extends StatefulWidget {
  const TarjetaLlamada({super.key, required this.llamada, this.onAbrir});

  final Llamada llamada;
  final VoidCallback? onAbrir;

  @override
  State<TarjetaLlamada> createState() => _TarjetaLlamadaState();
}

class _TarjetaLlamadaState extends State<TarjetaLlamada> {
  bool _enviando = false;

  Future<void> _hacer(Future<void> Function(SalonProvider salon) accion, String hecho) async {
    if (_enviando) return;
    setState(() => _enviando = true);
    try {
      await accion(context.read<SalonProvider>());
      if (mounted) avisar(context, hecho);
    } on ApiException catch (e) {
      if (mounted) avisar(context, e.mensaje, error: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.llamada;
    final t = Theme.of(context).textTheme;
    final yo = context.select<AuthProvider?, int?>((a) => a?.usuario?.id);
    final mia = l.tomada && l.meseroId != null && l.meseroId == yo;
    final quien = !l.tomada ? 'Esperando mesero' : mia ? 'Vas tú' : '${l.meseroNombre ?? 'Otro mesero'} va';

    return Semantics(
      container: true,
      label: 'Mesa ${l.mesaNumero} llama al mesero. $quien',
      child: QTarjeta(
        onTap: widget.onAbrir,
        borde: QColors.caramel,
        color: QColors.caramelWash,
        child: Row(children: [
          const Icon(Icons.notifications_active_rounded, color: QColors.caramelDeep),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Mesa ${l.mesaNumero} te llama', style: t.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text('$quien · ${hora(l.fecha)}', style: t.bodySmall?.copyWith(fontFeatures: tabular)),
            ]),
          ),
          const SizedBox(width: 8),
          if (!l.tomada)
            QBoton(
              texto: 'Voy',
              icono: Icons.directions_walk_rounded,
              cargando: _enviando,
              onPressed: () => _hacer((s) => s.tomarLlamada(l.id), 'Mesa ${l.mesaNumero}: vas tú'),
            )
          else
            QBoton(
              texto: 'Atendida',
              icono: Icons.check_rounded,
              variante: mia ? QVariante.primario : QVariante.secundario,
              cargando: _enviando,
              onPressed: () => _hacer((s) => s.atenderLlamada(l.id), 'Mesa ${l.mesaNumero}: atendida'),
            ),
        ]),
      ),
    );
  }
}
