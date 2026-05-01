// app/restaurant_app/lib/screens/domiciliario/detalle_domicilio_screen.dart
// Vista de detalle del pedido: datos completos, llamada al cliente,
// apertura de Google Maps nativo, y botones para "recogido" / "entregado".
//
// REQUIERE agregar al pubspec.yaml:
//   url_launcher: ^6.2.5
//   flutter_platform_maps: ^1.0.3   (opcional: alternativa pura)
// Aquí usamos sólo url_launcher con esquemas estándar:
//   · tel:<telefono>                        → llamada
//   · geo:0,0?q=<dir url-encoded>           → Maps nativo en Android
//   · https://www.google.com/maps/dir/?...  → fallback universal (Play Store/iOS)

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../models/domicilio_domiciliario.dart';
import '../../providers/domiciliario_provider.dart';

class DetalleDomicilioScreen extends StatelessWidget {
  final int domicilioId;
  const DetalleDomicilioScreen({super.key, required this.domicilioId});

  @override
  Widget build(BuildContext context) {
    return Consumer<DomiciliarioProvider>(
      builder: (context, p, _) {
        final d = p.pedidos.firstWhere(
          (x) => x.id == domicilioId,
          orElse: () => throw StateError('Domicilio no encontrado'),
        );
        return _buildUI(context, p, d);
      },
    );
  }

  Widget _buildUI(BuildContext ctx, DomiciliarioProvider p, DomicilioDomiciliario d) {
    final fmt = NumberFormat.currency(locale: 'es_CO', symbol: r'$', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        title: Text('Pedido #${d.id}'),
        backgroundColor: const Color(0xFF3F291A),
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _EstadoChip(estado: d.estado),
          const SizedBox(height: 16),

          _Seccion(
            titulo: 'Cliente',
            icon: Icons.person,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(d.clienteNombre,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.phone),
                        label: Text(d.clienteTelefono),
                        onPressed: () => _llamar(ctx, d.clienteTelefono),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filledTonal(
                      tooltip: 'Copiar teléfono',
                      icon: const Icon(Icons.copy),
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: d.clienteTelefono));
                        if (!ctx.mounted) return;
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('Teléfono copiado')),
                        );
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),

          _Seccion(
            titulo: 'Dirección',
            icon: Icons.location_on,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(d.direccionCompleta,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
                if ((d.barrio ?? '').isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text('Barrio: ${d.barrio}',
                      style: TextStyle(color: Colors.grey.shade700)),
                ],
                if ((d.referenciasAdicionales ?? '').isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF5E6),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE28D41).withOpacity(.4)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.info_outline, size: 18, color: Color(0xFFE28D41)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text('Punto de referencia: ${d.referenciasAdicionales}',
                              style: const TextStyle(fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    icon: const Icon(Icons.map),
                    label: const Text('Abrir en Google Maps'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1976D2),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: () => _abrirMaps(ctx, d),
                  ),
                ),
              ],
            ),
          ),

          _Seccion(
            titulo: 'Productos',
            icon: Icons.fastfood,
            child: Column(
              children: d.detalles
                  .map((i) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Container(
                              width: 28,
                              height: 28,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: const Color(0xFFC79B64),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text('${i.cantidad}',
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold)),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(i.platilloNombre),
                                  if (i.nota.isNotEmpty)
                                    Text('Nota: ${i.nota}',
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.grey.shade600)),
                                ],
                              ),
                            ),
                            Text(fmt.format(i.subtotal)),
                          ],
                        ),
                      ))
                  .toList(),
            ),
          ),

          _Seccion(
            titulo: 'Pago',
            icon: Icons.payments,
            child: Column(
              children: [
                _fila('Subtotal', fmt.format(d.subtotal)),
                _fila('Envío', fmt.format(d.costoEnvio)),
                const Divider(),
                _fila('Total', fmt.format(d.total), destacado: true),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(
                        d.pagadoAnticipado
                            ? Icons.check_circle
                            : Icons.attach_money,
                        color: d.pagadoAnticipado ? Colors.green : Colors.orange),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        d.pagadoAnticipado
                            ? 'Ya pagado anticipadamente'
                            : 'Cobrar al cliente con: ${d.metodoPago}',
                        style: TextStyle(
                            color: d.pagadoAnticipado
                                ? Colors.green.shade800
                                : Colors.orange.shade800,
                            fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          if ((d.notasCliente ?? '').isNotEmpty)
            _Seccion(
              titulo: 'Notas del cliente',
              icon: Icons.sticky_note_2,
              child: Text(d.notasCliente!),
            ),

          const SizedBox(height: 16),
          _Acciones(domicilio: d, provider: p),
        ],
      ),
    );
  }

  // ── acciones de URL ───────────────────────────────────────────────────

  Future<void> _llamar(BuildContext ctx, String telefono) async {
    final uri = Uri(scheme: 'tel', path: telefono.replaceAll(RegExp(r'[^0-9+]'), ''));
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (ctx.mounted) {
      ScaffoldMessenger.of(ctx).showSnackBar(
        const SnackBar(content: Text('No se pudo iniciar la llamada')),
      );
    }
  }

  Future<void> _abrirMaps(BuildContext ctx, DomicilioDomiciliario d) async {
    final direccion = [d.direccionCompleta, d.barrio ?? '', 'Sincelejo, Sucre, Colombia']
        .where((e) => e.trim().isNotEmpty)
        .join(', ');
    final encoded = Uri.encodeComponent(direccion);

    // Preferimos el esquema "google.navigation" de Google Maps (turn-by-turn);
    // si falla caemos al esquema web universal que abre Maps nativo cuando existe.
    final intents = [
      Uri.parse('google.navigation:q=$encoded'),
      Uri.parse('geo:0,0?q=$encoded'),
      Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$encoded'),
    ];

    for (final uri in intents) {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
    }

    if (ctx.mounted) {
      ScaffoldMessenger.of(ctx).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir Google Maps')),
      );
    }
  }

  Widget _fila(String label, String valor, {bool destacado = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            Expanded(
                child: Text(label,
                    style: TextStyle(
                        fontWeight: destacado ? FontWeight.bold : FontWeight.normal))),
            Text(valor,
                style: TextStyle(
                    fontWeight: destacado ? FontWeight.bold : FontWeight.w500,
                    color: destacado ? const Color(0xFFE28D41) : null,
                    fontSize: destacado ? 18 : 14)),
          ],
        ),
      );
}

// ═══════════════════════════════════════════════════════════════════════════
// Widgets auxiliares
// ═══════════════════════════════════════════════════════════════════════════

class _Seccion extends StatelessWidget {
  final String titulo;
  final IconData icon;
  final Widget child;
  const _Seccion({required this.titulo, required this.icon, required this.child});

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, color: const Color(0xFFC79B64)),
                  const SizedBox(width: 8),
                  Text(titulo,
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF3F291A))),
                ],
              ),
              const Divider(),
              child,
            ],
          ),
        ),
      );
}

class _EstadoChip extends StatelessWidget {
  final String estado;
  const _EstadoChip({required this.estado});

  @override
  Widget build(BuildContext context) {
    final (color, icon, label) = _info();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color),
      ),
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 8),
          Expanded(
              child: Text(label,
                  style: TextStyle(color: color, fontWeight: FontWeight.bold))),
        ],
      ),
    );
  }

  (Color, IconData, String) _info() {
    switch (estado) {
      case 'Listo':
        return (Colors.green.shade700, Icons.check_circle, 'Listo para recoger');
      case 'Recogido':
        return (Colors.orange.shade700, Icons.inventory_2, 'Recogido del restaurante');
      case 'EnCamino':
        return (Colors.blue.shade700, Icons.directions_bike, 'En camino al cliente');
      case 'Entregado':
        return (Colors.teal.shade700, Icons.done_all, 'Entregado');
      default:
        return (Colors.grey.shade700, Icons.help_outline, estado);
    }
  }
}

class _Acciones extends StatefulWidget {
  final DomicilioDomiciliario domicilio;
  final DomiciliarioProvider provider;
  const _Acciones({required this.domicilio, required this.provider});

  @override
  State<_Acciones> createState() => _AccionesState();
}

class _AccionesState extends State<_Acciones> {
  bool _procesando = false;

  Future<void> _ejecutar(Future<void> Function() accion, String exito) async {
    setState(() => _procesando = true);
    try {
      await accion();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(exito), backgroundColor: Colors.green.shade700),
      );

    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red.shade700),
      );
    } finally {
      if (mounted) setState(() => _procesando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.domicilio;
    final p = widget.provider;

    if (d.estado == 'Listo') {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: FilledButton.icon(
          onPressed: _procesando
              ? null
              : () => _ejecutar(() => p.marcarRecogido(d.id),
                  '📦 Pedido marcado como recogido'),
          icon: _procesando
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child:
                      CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.inventory_2),
          label: const Text('Recogí del restaurante',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          style: FilledButton.styleFrom(backgroundColor: Colors.orange.shade700),
        ),
      );
    }

    if (d.estado == 'Recogido' || d.estado == 'EnCamino') {
      return Column(
        children: [
          if (d.estado == 'Recogido')
            SizedBox(
              width: double.infinity,
              height: 46,
              child: OutlinedButton.icon(
                onPressed: _procesando
                    ? null
                    : () => _ejecutar(() => p.marcarEnCamino(d.id),
                        '🛵 En camino al cliente'),
                icon: const Icon(Icons.directions_bike),
                label: const Text('Marcar en camino'),
              ),
            ),
          if (d.estado == 'Recogido') const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton.icon(
              onPressed: _procesando
                  ? null
                  : () => _ejecutar(() => p.marcarEntregado(d.id),
                      '✅ Pedido entregado al cliente'),
              icon: _procesando
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.done_all),
              label: const Text('Entregado al cliente',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              style: FilledButton.styleFrom(backgroundColor: Colors.teal.shade700),
            ),
          ),
        ],
      );
    }

    return const SizedBox.shrink();
  }
}
