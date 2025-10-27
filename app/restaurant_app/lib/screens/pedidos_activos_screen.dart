import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/pedido.dart';
import '../providers/pedido_provider.dart';
import '../widgets/pedido_card.dart';
import 'editar_pedido_screen.dart';

class PedidosActivosScreen extends StatefulWidget {
  const PedidosActivosScreen({super.key});

  @override
  State<PedidosActivosScreen> createState() => _PedidosActivosScreenState();
}

class _PedidosActivosScreenState extends State<PedidosActivosScreen> {
  EstadoPedido? _filtroEstado;  // null = todos

  @override
  void initState() {
    super.initState();
    Future.microtask(() => context.read<PedidoProvider>().cargarPedidos());
  }

  Future<void> _refrescar() async {
    await context.read<PedidoProvider>().cargarPedidos();
  }

  List<Pedido> _filtrarPedidos(List<Pedido> pedidos) {
    var filtrados = pedidos.where(
      (p) => p.estado != EstadoPedido.pagado && p.estado != EstadoPedido.cancelado,
    ).toList();

    if (_filtroEstado != null) {
      filtrados = filtrados.where((p) => p.estado == _filtroEstado).toList();
    }

    return filtrados;
  }

  // ... métodos de entregar, cobrar, cancelar igual

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFFFF6B35),
        foregroundColor: Colors.white,
        title: const Text('Pedidos Activos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refrescar,
          ),
        ],
      ),
      body: Consumer<PedidoProvider>(
        builder: (context, provider, _) {
          if (provider.cargando) {
            return const Center(child: CircularProgressIndicator());
          }

          final pedidosActivos = _filtrarPedidos(provider.pedidos);

          return Column(
            children: [
              // Filtros de estado
              Container(
                padding: const EdgeInsets.all(16),
                color: Colors.grey[100],
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Filtrar por estado:',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _buildFiltroChip(
                            label: 'Todos',
                            count: provider.pedidos.where((p) => 
                              p.estado != EstadoPedido.pagado && 
                              p.estado != EstadoPedido.cancelado
                            ).length,
                            isSelected: _filtroEstado == null,
                            color: Colors.grey,
                            onTap: () => setState(() => _filtroEstado = null),
                          ),
                          const SizedBox(width: 8),
                          _buildFiltroChip(
                            label: 'En Proceso',
                            count: provider.pedidos.where((p) => p.estado == EstadoPedido.enProceso).length,
                            isSelected: _filtroEstado == EstadoPedido.enProceso,
                            color: Colors.blue,
                            onTap: () => setState(() => _filtroEstado = EstadoPedido.enProceso),
                          ),
                          const SizedBox(width: 8),
                          _buildFiltroChip(
                            label: 'Listo',
                            count: provider.pedidos.where((p) => p.estado == EstadoPedido.listo).length,
                            isSelected: _filtroEstado == EstadoPedido.listo,
                            color: Colors.orange,
                            onTap: () => setState(() => _filtroEstado = EstadoPedido.listo),
                          ),
                          const SizedBox(width: 8),
                          _buildFiltroChip(
                            label: 'Entregado',
                            count: provider.pedidos.where((p) => p.estado == EstadoPedido.entregado).length,
                            isSelected: _filtroEstado == EstadoPedido.entregado,
                            color: Colors.green,
                            onTap: () => setState(() => _filtroEstado = EstadoPedido.entregado),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Lista de pedidos
              Expanded(
                child: pedidosActivos.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.inbox, size: 64, color: Colors.grey[400]),
                            const SizedBox(height: 16),
                            Text(
                              _filtroEstado == null 
                                  ? 'No hay pedidos activos'
                                  : 'No hay pedidos en este estado',
                              style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _refrescar,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: pedidosActivos.length,
                          itemBuilder: (context, index) {
                            final pedido = pedidosActivos[index];
                            return PedidoCard(
                              pedido: pedido,
                              onEditar: pedido.puedeEditar
                                  ? () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => EditarPedidoScreen(pedido: pedido),
                                        ),
                                      ).then((_) => _refrescar());
                                    }
                                  : null,
                              onEntregar: pedido.puedeEntregar
                                  ? () => _entregarPedido(pedido)
                                  : null,
                              onCobrar: pedido.estado == EstadoPedido.entregado
                                  ? () => _cobrarPedido(pedido)
                                  : null,
                              onCancelar: () => _cancelarPedido(pedido),
                            );
                          },
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildFiltroChip({
    required String label,
    required int count,
    required bool isSelected,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: color,
            width: 2,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : color,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white.withOpacity(0.3) : color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  color: isSelected ? Colors.white : color,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ... resto de métodos (entregar, cobrar, cancelar) igual que antes
  Future<void> _entregarPedido(Pedido pedido) async {
    if (!pedido.puedeEntregar) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Deben pasar al menos 5 minutos desde la creación'),
        ),
      );
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar Entrega'),
        content: Text(
          '¿Confirmar que el pedido de la mesa ${pedido.mesaNumero} fue entregado?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Entregar'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      try {
        await context.read<PedidoProvider>().cambiarEstado(pedido.id, 'Entregado');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Pedido marcado como entregado'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _cobrarPedido(Pedido pedido) async {
    if (pedido.estado != EstadoPedido.entregado) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('El pedido debe estar entregado')),
      );
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar Cobro'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Mesa: ${pedido.mesaNumero}'),
            const SizedBox(height: 8),
            Text(
              'Total: ${NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(pedido.total)}',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cobrar'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      try {
        await context.read<PedidoProvider>().cambiarEstado(pedido.id, 'Pagado');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Pedido completado'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _cancelarPedido(Pedido pedido) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancelar Pedido'),
        content: const Text('¿Estás seguro? Esta acción no se puede deshacer.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Sí, Cancelar'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      try {
        await context.read<PedidoProvider>().cancelarPedido(pedido.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Pedido cancelado'),
              backgroundColor: Colors.orange,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }
}