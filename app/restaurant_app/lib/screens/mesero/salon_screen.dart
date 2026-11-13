import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/cuenta.dart';
import '../../models/pedido.dart';
import '../../providers/auth_provider.dart';
import '../../providers/notificacion_provider.dart';
import '../../providers/salon_provider.dart';
import '../../services/api.dart';
import '../../theme/qpro_theme.dart';
import '../../utils/formato.dart';
import '../../widgets/q.dart';
import 'avisos_screen.dart';
import 'llamada_tarjeta.dart';
import 'mesa_screen.dart';

enum _Filtro { todas, ocupadas, libres }

/// Inicio del mesero: lo que hay que servir primero y el salón por mesas.
class SalonScreen extends StatefulWidget {
  const SalonScreen({super.key});

  @override
  State<SalonScreen> createState() => _SalonScreenState();
}

class _SalonScreenState extends State<SalonScreen> {
  _Filtro _filtro = _Filtro.todas;

  void _abrirMesa(int mesaId) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MesaScreen(mesaId: mesaId)));

  @override
  Widget build(BuildContext context) {
    final salon = context.watch<SalonProvider>();
    final usuario = context.select<AuthProvider, String>((a) => a.usuario?.primerNombre ?? '');
    final noLeidas = context.select<NotificacionProvider, int>((n) => n.noLeidas);
    final t = Theme.of(context).textTheme;

    final cuentas = salon.cuentas;
    final ocupadas = cuentas.where((c) => !c.libre).length;
    final porServir = salon.porServir;
    final llamadas = salon.llamadas;
    final visibles = switch (_filtro) {
      _Filtro.todas => cuentas,
      _Filtro.ocupadas => cuentas.where((c) => !c.libre).toList(),
      _Filtro.libres => cuentas.where((c) => c.libre).toList(),
    };

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: const Row(children: [LogoQpro(tamano: 36), SizedBox(width: 10), Text('Qpro')]),
        actions: [
          IconButton(
            tooltip: noLeidas > 0 ? '$noLeidas avisos sin leer' : 'Avisos',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AvisosScreen())),
            icon: Badge(
              isLabelVisible: noLeidas > 0,
              label: Text('$noLeidas'),
              backgroundColor: QColors.caramel,
              textColor: QColors.espresso,
              child: const Icon(Icons.notifications_none_rounded),
            ),
          ),
          const _MenuUsuario(),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: QColors.espresso,
        onRefresh: () => salon.cargar(),
        child: !salon.cargado
            ? ListView(children: [
                SizedBox(
                  height: MediaQuery.sizeOf(context).height * 0.6,
                  child: salon.error != null
                      ? Center(child: ErrorCarga(mensaje: salon.error!, onReintentar: salon.cargar))
                      : const Center(child: CircularProgressIndicator()),
                ),
              ])
            : CustomScrollView(slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                  sliver: SliverToBoxAdapter(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(usuario.isEmpty ? 'Salón' : 'Hola, $usuario', style: t.headlineSmall),
                      const SizedBox(height: 4),
                      Text(
                        '${plural(ocupadas, 'mesa ocupada', 'mesas ocupadas')} · ${plural(porServir.length, 'pedido para servir', 'pedidos para servir')}',
                        style: t.bodyMedium,
                      ),
                      if (salon.error != null) ...[
                        const SizedBox(height: 10),
                        const QChip('Sin conexión: mostrando lo último que cargó', tono: QTono.peligro, icono: Icons.wifi_off_rounded),
                      ],
                    ]),
                  ),
                ),
                if (llamadas.isNotEmpty) ...[
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                    sliver: SliverToBoxAdapter(child: Text('Te llaman', style: t.titleLarge)),
                  ),
                  SliverList.separated(
                    itemCount: llamadas.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: TarjetaLlamada(llamada: llamadas[i], onAbrir: () => _abrirMesa(llamadas[i].mesaId)),
                    ),
                  ),
                ],
                if (porServir.isNotEmpty) ...[
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                    sliver: SliverToBoxAdapter(child: Text('Para servir', style: t.titleLarge)),
                  ),
                  SliverList.separated(
                    itemCount: porServir.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: _PedidoParaServir(pedido: porServir[i], onAbrir: () => _abrirMesa(porServir[i].mesaId)),
                    ),
                  ),
                ],
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
                  sliver: SliverToBoxAdapter(
                    child: Row(children: [
                      Expanded(child: Text('Mesas', style: t.titleLarge)),
                      for (final f in _Filtro.values) ...[
                        const SizedBox(width: 6),
                        _Pildora(
                          texto: switch (f) { _Filtro.todas => 'Todas', _Filtro.ocupadas => 'Ocupadas', _Filtro.libres => 'Libres' },
                          activa: _filtro == f,
                          onTap: () => setState(() => _filtro = f),
                        ),
                      ],
                    ]),
                  ),
                ),
                if (visibles.isEmpty)
                  SliverToBoxAdapter(
                    child: Vacio(
                      icono: Icons.table_restaurant_outlined,
                      titulo: cuentas.isEmpty ? 'No hay mesas' : 'Ninguna mesa en este filtro',
                      texto: cuentas.isEmpty ? 'El administrador crea las mesas desde Códigos QR en la web.' : null,
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                    sliver: SliverGrid.builder(
                      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                        maxCrossAxisExtent: 180,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        mainAxisExtent: 128,
                      ),
                      itemCount: visibles.length,
                      itemBuilder: (_, i) => _TarjetaMesa(
                        cuenta: visibles[i],
                        llama: salon.llamadaDe(visibles[i].mesa.id) != null,
                        onTap: () => _abrirMesa(visibles[i].mesa.id),
                      ),
                    ),
                  ),
              ]),
      ),
    );
  }
}

class _MenuUsuario extends StatelessWidget {
  const _MenuUsuario();

  @override
  Widget build(BuildContext context) {
    final usuario = context.read<AuthProvider>().usuario;
    return PopupMenuButton<String>(
      tooltip: 'Tu cuenta',
      position: PopupMenuPosition.under,
      onSelected: (_) => context.read<AuthProvider>().cerrarSesion(),
      itemBuilder: (_) => [
        PopupMenuItem(
          enabled: false,
          child: Text('${usuario?.nombre ?? ''}\nMesero', style: const TextStyle(color: QColors.espresso, fontWeight: FontWeight.w700)),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem(value: 'salir', child: Row(children: [Icon(Icons.logout_rounded, size: 20), SizedBox(width: 10), Text('Cerrar sesión')])),
      ],
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: CircleAvatar(
          radius: 18,
          backgroundColor: QColors.espresso,
          child: Text(usuario?.iniciales ?? '?', style: const TextStyle(color: QColors.white, fontSize: 13, fontWeight: FontWeight.w800)),
        ),
      ),
    );
  }
}

class _Pildora extends StatelessWidget {
  const _Pildora({required this.texto, required this.activa, required this.onTap});

  final String texto;
  final bool activa;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        selected: activa,
        button: true,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(999),
          child: AnimatedContainer(
            duration: QMotion.micro,
            curve: QMotion.curve,
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: activa ? QColors.espresso : Colors.transparent, borderRadius: BorderRadius.circular(999)),
            child: Text(texto, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: activa ? QColors.white : QColors.stone600)),
          ),
        ),
      );
}

class _PedidoParaServir extends StatelessWidget {
  const _PedidoParaServir({required this.pedido, required this.onAbrir});

  final Pedido pedido;
  final VoidCallback onAbrir;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final resumen = pedido.detalles.map((d) => '${d.cantidad} × ${d.platilloNombre}').join(' · ');
    return QTarjeta(
      onTap: onAbrir,
      borde: const Color(0xFF86EFAC),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('Mesa ${pedido.mesaNumero}', style: t.titleLarge),
              const SizedBox(width: 8),
              const QChip('Listo', tono: QTono.ok, icono: Icons.check_rounded),
            ]),
            const SizedBox(height: 4),
            Text(resumen, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.bodyMedium),
            const SizedBox(height: 2),
            Text('Pedido #${pedido.id} · ${hora(pedido.fecha)}', style: t.bodySmall?.copyWith(fontFeatures: tabular)),
          ]),
        ),
        const SizedBox(width: 12),
        BotonConfirmar(
          texto: 'Servido',
          confirmar: '¿Servido?',
          icono: Icons.room_service_outlined,
          onConfirmar: () => servirPedido(context, pedido),
        ),
      ]),
    );
  }
}

/// Marca el pedido como servido (Entregado) y avisa el resultado.
Future<void> servirPedido(BuildContext context, Pedido pedido) async {
  try {
    await context.read<SalonProvider>().servir(pedido.id);
    if (context.mounted) avisar(context, 'Mesa ${pedido.mesaNumero}: pedido servido');
  } on ApiException catch (e) {
    if (context.mounted) avisar(context, e.mensaje, error: true);
  }
}

class _TarjetaMesa extends StatelessWidget {
  const _TarjetaMesa({required this.cuenta, required this.onTap, this.llama = false});

  final CuentaMesa cuenta;
  final bool llama;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final (color, borde) = cuenta.libre
        ? (QColors.stone500, null)
        : cuenta.porServir > 0
            ? (QColors.success, const Color(0xFF86EFAC))
            : cuenta.solicitud != null
                ? (QColors.tealDeep, QColors.tealLight)
                : cuenta.enCocina > 0
                    ? (QColors.warningText, null)
                    : (QColors.stone600, null);

    return Semantics(
      button: true,
      label: 'Mesa ${cuenta.mesa.numero}${llama ? ', llama al mesero' : ''}, ${cuenta.resumen}${cuenta.libre ? '' : ', ${pesos(cuenta.total)}'}',
      excludeSemantics: true,
      child: QTarjeta(
        onTap: onTap,
        borde: llama ? QColors.caramel : borde,
        color: cuenta.libre ? QColors.stone50 : QColors.white,
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
            Text('${cuenta.mesa.numero}', style: t.headlineMedium?.copyWith(fontSize: 30, fontFeatures: tabular)),
            const Spacer(),
            if (llama)
              const Icon(Icons.notifications_active_rounded, size: 20, color: QColors.caramelDeep)
            else if (!cuenta.libre)
              Text(plural(cuenta.platos, 'plato'), style: t.bodySmall),
          ]),
          const Spacer(),
          Row(children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Expanded(
              child: Text(cuenta.resumen, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
            ),
          ]),
          if (!cuenta.libre) ...[
            const SizedBox(height: 2),
            Text(pesos(cuenta.total), style: t.titleSmall?.copyWith(fontWeight: FontWeight.w800, fontFeatures: tabular)),
          ],
        ]),
      ),
    );
  }
}
