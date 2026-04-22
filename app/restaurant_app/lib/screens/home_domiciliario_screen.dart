// app/restaurant_app/lib/screens/domiciliario/home_domiciliario_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../../models/domicilio_domiciliario.dart';
import '../../providers/domiciliario_provider.dart';
import 'detalle_domicilio_screen.dart';
import 'login_domiciliario_screen.dart';

class HomeDomiciliarioScreen extends StatefulWidget {
  const HomeDomiciliarioScreen({super.key});

  @override
  State<HomeDomiciliarioScreen> createState() => _HomeDomiciliarioScreenState();
}

class _HomeDomiciliarioScreenState extends State<HomeDomiciliarioScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<DomiciliarioProvider>();
      p.cargarPedidos();
      p.refrescarEstadisticas();
      p.iniciarPolling();
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _confirmarLogout() async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Seguro que deseas cerrar sesión?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Cerrar sesión')),
        ],
      ),
    );

    if (confirmar != true) return;
    if (!mounted) return;

    await context.read<DomiciliarioProvider>().logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginDomiciliarioScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DomiciliarioProvider>(
      builder: (context, p, _) {
        return Scaffold(
          appBar: AppBar(
            backgroundColor: const Color(0xFF3F291A),
            foregroundColor: Colors.white,
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.nombre ?? 'Domiciliario',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                Text('${p.entregasHoy} hoy · ${p.entregasTotales} totales',
                    style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(.85))),
              ],
            ),
            actions: [
              IconButton(
                tooltip: 'Actualizar',
                icon: const Icon(Icons.refresh),
                onPressed: () => p.cargarPedidos(),
              ),
              IconButton(
                tooltip: 'Cerrar sesión',
                icon: const Icon(Icons.logout),
                onPressed: _confirmarLogout,
              ),
            ],
            bottom: TabBar(
              controller: _tabs,
              indicatorColor: const Color(0xFFE28D41),
              tabs: [
                Tab(text: 'Disponibles (${p.pedidosLibres.length})'),
                Tab(text: 'En curso (${p.pedidosMios.length})'),
              ],
            ),
          ),
          body: p.cargando && p.pedidos.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : p.error != null
                  ? _buildError(p)
                  : TabBarView(
                      controller: _tabs,
                      children: [
                        _buildLista(context, p.pedidosLibres, vacio: 'Sin pedidos disponibles'),
                        _buildLista(context, p.pedidosMios, vacio: 'No tienes pedidos en curso'),
                      ],
                    ),
        );
      },
    );
  }

  Widget _buildError(DomiciliarioProvider p) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(p.error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => p.cargarPedidos(),
                icon: const Icon(Icons.refresh),
                label: const Text('Reintentar'),
              ),
            ],
          ),
        ),
      );

  Widget _buildLista(BuildContext context, List<DomicilioDomiciliario> pedidos,
      {required String vacio}) {
    if (pedidos.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => context.read<DomiciliarioProvider>().cargarPedidos(),
        child: ListView(
          padding: const EdgeInsets.only(top: 120),
          children: [
            Column(
              children: [
                Icon(Icons.inbox_outlined, size: 64, color: Colors.grey.shade400),
                const SizedBox(height: 12),
                Text(vacio, style: TextStyle(color: Colors.grey.shade600)),
              ],
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => context.read<DomiciliarioProvider>().cargarPedidos(),
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: pedidos.length,
        itemBuilder: (_, i) => _buildCard(context, pedidos[i]),
      ),
    );
  }

  Widget _buildCard(BuildContext context, DomicilioDomiciliario d) {
    final fmt = NumberFormat.currency(locale: 'es_CO', symbol: r'$', decimalDigits: 0);
    final (color, icon, etiqueta) = _estadoInfo(d.estado);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => DetalleDomicilioScreen(domicilioId: d.id)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              color: color,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  Icon(icon, color: Colors.white, size: 18),
                  const SizedBox(width: 6),
                  Text(etiqueta,
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  Text('Pedido #${d.id}',
                      style: const TextStyle(color: Colors.white)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.person, size: 16, color: Color(0xFF73563D)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(d.clienteNombre,
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                      ),
                      Text(fmt.format(d.total),
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFE28D41))),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined,
                          size: 16, color: Color(0xFF73563D)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          [d.direccionCompleta, if (d.barrio?.isNotEmpty == true) d.barrio]
                              .whereType<String>()
                              .join(' · '),
                          style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.fastfood, size: 16, color: Colors.grey.shade600),
                      const SizedBox(width: 6),
                      Text(
                          '${d.detalles.length} ${d.detalles.length == 1 ? 'producto' : 'productos'}'),
                      const Spacer(),
                      Icon(
                          d.pagadoAnticipado
                              ? Icons.check_circle
                              : Icons.payments_outlined,
                          size: 16,
                          color: d.pagadoAnticipado
                              ? Colors.green
                              : Colors.orange),
                      const SizedBox(width: 4),
                      Text(d.pagadoAnticipado ? 'Pagado' : 'Cobrar: ${d.metodoPago}',
                          style: const TextStyle(fontSize: 12)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  (Color, IconData, String) _estadoInfo(String estado) {
    switch (estado) {
      case 'Listo':
        return (Colors.green.shade600, Icons.check_circle, 'Listo para recoger');
      case 'Recogido':
        return (Colors.orange.shade700, Icons.inventory_2, 'Recogido');
      case 'EnCamino':
        return (Colors.blue.shade600, Icons.directions_bike, 'En camino');
      default:
        return (Colors.grey.shade600, Icons.help_outline, estado);
    }
  }
}
