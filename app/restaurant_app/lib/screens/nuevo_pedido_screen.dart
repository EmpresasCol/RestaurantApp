import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/mesa.dart';
import '../models/platillo.dart';
import '../models/categoria.dart';
import '../services/mesa_service.dart';
import '../services/platillo_service.dart';
import '../providers/auth_provider.dart';
import '../providers/pedido_provider.dart';
import '../widgets/mesa_card.dart';
import '../widgets/platillo_card.dart';

class NuevoPedidoScreen extends StatefulWidget {
  const NuevoPedidoScreen({super.key});

  @override
  State<NuevoPedidoScreen> createState() => _NuevoPedidoScreenState();
}

class _ItemPedidoLocal {
  final int platilloId;
  final String nombre;
  final double precio;
  int cantidad;
  String nota;

  _ItemPedidoLocal({
    required this.platilloId,
    required this.nombre,
    required this.precio,
    this.cantidad = 1,
    this.nota = '',
  });
}

class _NuevoPedidoScreenState extends State<NuevoPedidoScreen> {
  final MesaService _mesaService = MesaService();
  final PlatilloService _platilloService = PlatilloService();
  
  List<Mesa> _mesas = [];
  List<Platillo> _platillos = [];
  List<Categoria> _categorias = Categoria.obtenerCategorias();
  
  Mesa? _mesaSeleccionada;
  Categoria? _categoriaSeleccionada;
  final List<_ItemPedidoLocal> _itemsPedido = [];
  
  bool _cargando = true;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _cargarDatos();
    _categorias.first.estaSeleccionada = true;
    _categoriaSeleccionada = _categorias.first;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _cargarDatos() async {
    try {
      print('📡 Iniciando carga de datos...');
      
      final mesas = await _mesaService.obtenerTodas();
      print('✅ Mesas cargadas: ${mesas.length}');
      
      final platillos = await _platilloService.obtenerTodos();
      print('✅ Platillos cargados: ${platillos.length}');
      
      setState(() {
        _mesas = mesas;
        _platillos = platillos;
        _cargando = false;
      });
    } catch (e, stackTrace) {
      print('❌ Error cargando datos: $e');
      print('Stack trace: $stackTrace');
      
      setState(() => _cargando = false);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al cargar datos: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
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

  void _seleccionarMesa(Mesa mesa) {
    setState(() {
      _mesaSeleccionada?.estaSeleccionada = false;
      mesa.estaSeleccionada = true;
      _mesaSeleccionada = mesa;
    });
  }

  void _seleccionarCategoria(Categoria categoria) {
    setState(() {
      _categoriaSeleccionada?.estaSeleccionada = false;
      categoria.estaSeleccionada = true;
      _categoriaSeleccionada = categoria;
    });
  }

  Future<void> _agregarProducto(Platillo platillo) async {
    final existe = _itemsPedido.firstWhere(
      (p) => p.platilloId == platillo.id,
      orElse: () => _ItemPedidoLocal(platilloId: -1, nombre: '', precio: 0),
    );
    
    if (existe.platilloId != -1) {
      // Ya existe, mostrar diálogo para editar
      await _mostrarDialogoNota(existe);
    } else {
      // Nuevo item, mostrar diálogo para agregar
      final nota = await _mostrarDialogoNotaNuevo(platillo);
      if (nota != null) {
        setState(() {
          _itemsPedido.add(_ItemPedidoLocal(
            platilloId: platillo.id,
            nombre: platillo.nombre,
            precio: platillo.precio,
            cantidad: 1,
            nota: nota,
          ));
        });
      }
    }
  }

  Future<String?> _mostrarDialogoNotaNuevo(Platillo platillo) async {
    final notaController = TextEditingController();
    
    return await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(platillo.nombre),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(platillo.precio),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFFFF6B35),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: notaController,
              decoration: const InputDecoration(
                labelText: 'Nota (opcional)',
                hintText: 'Ej: Sin cebolla',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, notaController.text),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF28A745),
            ),
            child: const Text('Agregar'),
          ),
        ],
      ),
    );
  }

  Future<void> _mostrarDialogoNota(_ItemPedidoLocal item) async {
    final notaController = TextEditingController(text: item.nota);
    
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(item.nombre),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(item.precio),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFFFF6B35),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: notaController,
              decoration: const InputDecoration(
                labelText: 'Nota (opcional)',
                hintText: 'Ej: Sin cebolla',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              setState(() {
                item.nota = notaController.text;
                item.cantidad++;  // ✅ Incrementar cantidad
              });
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF28A745),
            ),
            child: const Text('Actualizar'),
          ),
        ],
      ),
    );
  }

  void _cambiarCantidad(_ItemPedidoLocal item, int delta) {
    setState(() {
      item.cantidad += delta;
      if (item.cantidad <= 0) {
        _itemsPedido.remove(item);
      }
    });
  }

  double get _total => _itemsPedido.fold(0, (sum, p) => sum + (p.precio * p.cantidad));

  Future<void> _confirmarPedido() async {
    if (_mesaSeleccionada == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona una mesa')),
      );
      return;
    }

    if (_itemsPedido.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agrega al menos un producto')),
      );
      return;
    }

    final auth = context.read<AuthProvider>();
    final pedidoProvider = context.read<PedidoProvider>();

    try {
      await pedidoProvider.crearPedido({
        'mesaId': _mesaSeleccionada!.id,
        'usuarioId': auth.usuario!.id,
        'detalles': _itemsPedido.map((p) => {
          'platilloId': p.platilloId,
          'cantidad': p.cantidad,
          'nota': p.nota,
        }).toList(),
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Pedido creado exitosamente'),
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
        title: const Text('Nuevo Pedido'),
      ),
      body: _cargando
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSeccionMesas(),
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

  // ... _buildSeccionMesas igual

  Widget _buildSeccionMesas() {
    return Container(
      color: Colors.grey[100],
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Selecciona una Mesa',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 100,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _mesas.length,
              itemBuilder: (context, index) {
                return Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: MesaCard(
                    mesa: _mesas[index],
                    onTap: () => _seleccionarMesa(_mesas[index]),
                  ),
                );
              },
            ),
          ),
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
            'Selecciona Productos',
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
              const Text(
                'Resumen del Pedido',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(Icons.expand_less),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (context) => _buildDetallesPedido(),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
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
              onPressed: _confirmarPedido,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF28A745),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Confirmar Pedido',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetallesPedido() {
    return Container(
      padding: const EdgeInsets.all(16),
      height: MediaQuery.of(context).size.height * 0.7,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Detalles del Pedido',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const Divider(),
          Expanded(
            child: ListView.builder(
              itemCount: _itemsPedido.length,
              itemBuilder: (context, index) {
                final item = _itemsPedido[index];
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  child: ListTile(
                    title: Text(item.nombre),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          NumberFormat.currency(symbol: '\$', decimalDigits: 0)
                              .format(item.precio),
                        ),
                        if (item.nota.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.blue[50],
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '📝 ${item.nota}',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.blue[900],
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline),
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
                          icon: const Icon(Icons.add_circle_outline),
                          onPressed: () => _cambiarCantidad(item, 1),
                        ),
                        IconButton(
                          icon: const Icon(Icons.edit, size: 20),
                          onPressed: () => _mostrarDialogoNota(item),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}