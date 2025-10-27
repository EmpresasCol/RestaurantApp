import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/pedido.dart';
import '../models/platillo.dart';
import '../models/categoria.dart';
import '../services/platillo_service.dart';
import '../providers/pedido_provider.dart';
import '../widgets/platillo_card.dart';

class EditarPedidoScreen extends StatefulWidget {
  final Pedido pedido;

  const EditarPedidoScreen({super.key, required this.pedido});

  @override
  State<EditarPedidoScreen> createState() => _EditarPedidoScreenState();
}

class _EditarPedidoScreenState extends State<EditarPedidoScreen> {
  final PlatilloService _platilloService = PlatilloService();
  
  List<Platillo> _platillos = [];
  List<Categoria> _categorias = Categoria.obtenerCategorias();
  Categoria? _categoriaSeleccionada;
  final List<ItemPedido> _itemsPedido = [];
  
  bool _cargando = true;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _cargarDatos();
    _categorias.first.estaSeleccionada = true;
    _categoriaSeleccionada = _categorias.first;
    
    // Copiar items del pedido original
    _itemsPedido.addAll(widget.pedido.detalles.map((d) => ItemPedido(
      id: d.id,
      platilloId: d.platilloId,
      platilloNombre: d.platilloNombre,
      cantidad: d.cantidad,
      precio: d.precio,
      nota: d.nota,
    )));
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _cargarDatos() async {
    try {
      final platillos = await _platilloService.obtenerTodos();
      setState(() {
        _platillos = platillos;
        _cargando = false;
      });
    } catch (e) {
      setState(() => _cargando = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  List<Platillo> get _platillosFiltrados {
    var filtrados = _platillos;
    
    if (_categoriaSeleccionada != null && _categoriaSeleccionada!.nombre != 'Todas') {
      filtrados = filtrados.where((p) => p.categoria == _categoriaSeleccionada!.nombre).toList();
    }
    
    final query = _searchController.text.toLowerCase();
    if (query.isNotEmpty) {
      filtrados = filtrados.where((p) => p.nombre.toLowerCase().contains(query)).toList();
    }
    
    return filtrados;
  }

  void _seleccionarCategoria(Categoria categoria) {
    setState(() {
      _categoriaSeleccionada?.estaSeleccionada = false;
      categoria.estaSeleccionada = true;
      _categoriaSeleccionada = categoria;
    });
  }

  void _agregarProducto(Platillo platillo) {
    setState(() {
      final existe = _itemsPedido.firstWhere(
        (p) => p.platilloId == platillo.id,
        orElse: () => ItemPedido(
          platilloId: -1,
          platilloNombre: '',
          cantidad: 0,
          precio: 0,
        ),
      );
      
      if (existe.platilloId != -1) {
        existe.cantidad++;
      } else {
        _itemsPedido.add(ItemPedido(
          platilloId: platillo.id,
          platilloNombre: platillo.nombre,
          cantidad: 1,
          precio: platillo.precio,
        ));
      }
    });
  }

  void _cambiarCantidad(ItemPedido item, int delta) {
    setState(() {
      item.cantidad += delta;
      if (item.cantidad <= 0) {
        _itemsPedido.remove(item);
      }
    });
  }

  double get _total => _itemsPedido.fold(0, (sum, p) => sum + (p.precio * p.cantidad));

  Future<void> _guardarCambios() async {
    if (_itemsPedido.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agrega al menos un producto')),
      );
      return;
    }

    final pedidoProvider = context.read<PedidoProvider>();

    try {
      await pedidoProvider.actualizarPedido(widget.pedido.id, {
        'detalles': _itemsPedido.map((p) => p.toJson()).toList(),
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Pedido actualizado exitosamente'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFFFF6B35),
        foregroundColor: Colors.white,
        title: Text('Editar Pedido #${widget.pedido.id}'),
      ),
      body: _cargando
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  color: Colors.blue[50],
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: Colors.blue),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Mesa ${widget.pedido.mesaNumero} - ${DateFormat('dd/MM/yyyy HH:mm').format(widget.pedido.fecha)}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSeccionProductos(),
                      ],
                    ),
                  ),
                ),
                if (_itemsPedido.isNotEmpty) _buildResumenPedido(),
              ],
            ),
    );
  }

  Widget _buildSeccionProductos() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Productos del Pedido',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          if (_itemsPedido.isNotEmpty) ...[
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _itemsPedido.length,
              itemBuilder: (context, index) {
                final item = _itemsPedido[index];
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  child: ListTile(
                    title: Text(item.platilloNombre),
                    subtitle: Text(
                      NumberFormat.currency(symbol: '\$', decimalDigits: 0)
                          .format(item.precio),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline, color: Colors.red),
                          onPressed: () => _cambiarCantidad(item, -1),
                        ),
                        Text(
                          '${item.cantidad}',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline, color: Colors.green),
                          onPressed: () => _cambiarCantidad(item, 1),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const Divider(height: 32),
          ],
          const Text(
            'Agregar Más Productos',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Buscar productos...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 50,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _categorias.length,
              itemBuilder: (context, index) {
                final cat = _categorias[index];
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text('${cat.icono} ${cat.nombre}'),
                    selected: cat.estaSeleccionada,
                    onSelected: (_) => _seleccionarCategoria(cat),
                    selectedColor: const Color(0xFFFF6B35).withOpacity(0.2),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _platillosFiltrados.length,
            itemBuilder: (context, index) {
              return PlatilloCard(
                platillo: _platillosFiltrados[index],
                onTap: () => _agregarProducto(_platillosFiltrados[index]),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildResumenPedido() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${_itemsPedido.length} productos',
                style: TextStyle(color: Colors.grey[600]),
              ),
              Text(
                NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(_total),
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFF6B35),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _guardarCambios,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF17A2B8),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Guardar Cambios',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}