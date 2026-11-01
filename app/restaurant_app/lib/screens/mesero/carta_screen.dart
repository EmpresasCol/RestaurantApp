import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../models/mesa.dart';
import '../../models/pedido.dart';
import '../../models/platillo.dart';
import '../../providers/salon_provider.dart';
import '../../services/api.dart';
import '../../theme/qpro_theme.dart';
import '../../utils/formato.dart';
import '../../widgets/q.dart';

/// Mismas notas rápidas que la carta del comensal (MenuQR.js).
const notasRapidas = ['Sin cebolla', 'Sin salsas', 'Bien cocido', 'Término medio', 'Sin picante'];

/// Carta para tomar un pedido nuevo o editar uno que la cocina no ha empezado.
/// La disponibilidad viene del inventario: lo agotado no se pide y la cantidad no
/// pasa de las porciones que alcanzan.
class CartaScreen extends StatefulWidget {
  const CartaScreen({super.key, required this.mesa, this.editar});

  final Mesa mesa;
  final Pedido? editar;

  @override
  State<CartaScreen> createState() => _CartaScreenState();
}

class _CartaScreenState extends State<CartaScreen> {
  final List<LineaPedido> _lineas = [];
  final _busqueda = TextEditingController();
  String? _categoria;
  bool _cargandoCarta = false;
  String? _errorCarta;
  bool _enviando = false;
  DateTime? _avisoSalir;

  bool get _editando => widget.editar != null;

  @override
  void initState() {
    super.initState();
    _busqueda.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargarCarta());
  }

  @override
  void dispose() {
    _busqueda.dispose();
    super.dispose();
  }

  Future<void> _cargarCarta() async {
    final salon = context.read<SalonProvider>();
    setState(() {
      _cargandoCarta = salon.carta.isEmpty;
      _errorCarta = null;
    });
    try {
      await salon.cargarCarta();
      if (_editando && _lineas.isEmpty) _precargar(salon);
    } on ApiException catch (e) {
      _errorCarta = e.mensaje;
    }
    if (mounted) setState(() => _cargandoCarta = false);
  }

  /// El pedido a editar entra con sus platos y notas.
  void _precargar(SalonProvider salon) {
    for (final d in widget.editar!.detalles) {
      final platillo = salon.platillo(d.platilloId) ?? Platillo(id: d.platilloId, nombre: d.platilloNombre, precio: d.precio);
      _lineas.add(LineaPedido(platillo: platillo, cantidad: d.cantidad, nota: d.nota ?? ''));
    }
  }

  int _cantidad(int platilloId) => _lineas.where((l) => l.platillo.id == platilloId).fold(0, (n, l) => n + l.cantidad);

  /// Al editar, las porciones de este mismo pedido ya están descontadas del inventario.
  int _tope(Platillo p) {
    final propias = widget.editar?.detalles.where((d) => d.platilloId == p.id).fold<int>(0, (n, d) => n + d.cantidad) ?? 0;
    if (propias == 0) return p.tope;
    return (p.agotado ? propias : p.tope + propias).clamp(0, Platillo.maximoPorPlato);
  }

  void _cambiar(Platillo p, int nueva) {
    setState(() {
      final actual = _cantidad(p.id);
      if (nueva > actual) {
        final linea = _lineas.where((l) => l.platillo.id == p.id && l.nota.isEmpty).firstOrNull;
        if (linea != null) {
          linea.cantidad += nueva - actual;
        } else {
          _lineas.add(LineaPedido(platillo: p, cantidad: nueva - actual));
        }
      } else {
        // Se quita de la última línea de ese plato.
        var quitar = actual - nueva;
        for (final l in _lineas.reversed.where((l) => l.platillo.id == p.id).toList()) {
          final menos = quitar.clamp(0, l.cantidad);
          l.cantidad -= menos;
          quitar -= menos;
        }
        _lineas.removeWhere((l) => l.cantidad <= 0);
      }
    });
  }

  double get _total => _lineas.fold(0, (t, l) => t + l.subtotal);
  int get _unidades => _lineas.fold(0, (n, l) => n + l.cantidad);

  Future<void> _enviar(BuildContext hoja) async {
    if (_lineas.isEmpty || _enviando) return;
    setState(() => _enviando = true);
    final salon = context.read<SalonProvider>();
    final navegador = Navigator.of(context);
    try {
      if (_editando) {
        await salon.editarPedido(widget.editar!.id, _lineas);
      } else {
        await salon.crearPedido(widget.mesa.id, _lineas);
      }
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      navegador.pop(); // hoja del carrito
      navegador.pop(); // carta
      avisar(context, _editando ? 'Pedido #${widget.editar!.id} actualizado' : 'Pedido enviado a cocina · Mesa ${widget.mesa.numero}');
    } on ApiException catch (e) {
      if (mounted) avisar(hoja.mounted ? hoja : context, e.mensaje, error: true);
      // La disponibilidad pudo cambiar (otro mesero, el QR o la cocina).
      try {
        await salon.cargarCarta();
      } catch (_) {}
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  void _verPedido() => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (hoja) => StatefulBuilder(builder: (hoja, refrescar) {
          void cambio(VoidCallback f) {
            setState(f);
            refrescar(() {});
            if (_lineas.isEmpty) Navigator.of(hoja).pop();
          }

          return _HojaPedido(
            titulo: _editando ? 'Pedido #${widget.editar!.id}' : 'Mesa ${widget.mesa.numero}',
            lineas: _lineas,
            total: _total,
            enviando: _enviando,
            textoEnviar: _editando ? 'Guardar cambios' : 'Enviar a cocina',
            tope: _tope,
            cantidadPlato: _cantidad,
            onCantidad: (l, n) => cambio(() {
              l.cantidad = n;
              _lineas.removeWhere((x) => x.cantidad <= 0);
            }),
            onNota: (l, nota) => cambio(() => l.nota = nota),
            onEnviar: () async {
              refrescar(() {});
              await _enviar(hoja);
              if (hoja.mounted) refrescar(() {});
            },
          );
        }),
      );

  @override
  Widget build(BuildContext context) {
    final salon = context.watch<SalonProvider>();
    final t = Theme.of(context).textTheme;
    final filtro = _busqueda.text.trim().toLowerCase();
    final platos = salon.carta
        .where((p) => _categoria == null || p.categoria == _categoria)
        .where((p) => filtro.isEmpty || p.nombre.toLowerCase().contains(filtro) || p.descripcion.toLowerCase().contains(filtro))
        .toList();

    return PopScope(
      canPop: _lineas.isEmpty || _editando,
      onPopInvokedWithResult: (salio, _) {
        if (salio) return;
        final ahora = DateTime.now();
        if (_avisoSalir != null && ahora.difference(_avisoSalir!) < const Duration(seconds: 3)) {
          setState(_lineas.clear);
          Navigator.of(context).pop();
        } else {
          _avisoSalir = ahora;
          avisar(context, 'Toca atrás otra vez para descartar el pedido');
        }
      },
      child: Scaffold(
        backgroundColor: QColors.white,
        appBar: AppBar(
          title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Mesa ${widget.mesa.numero}'),
            Text(_editando ? 'Editar pedido #${widget.editar!.id}' : 'Nuevo pedido', style: t.bodySmall),
          ]),
        ),
        body: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _busqueda,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Buscar plato',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _busqueda.text.isEmpty ? null : IconButton(tooltip: 'Borrar búsqueda', icon: const Icon(Icons.close_rounded), onPressed: _busqueda.clear),
                fillColor: QColors.stone100,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(QRadius.surface), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(QRadius.surface), borderSide: const BorderSide(color: QColors.caramelLight, width: 2)),
              ),
            ),
          ),
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: [
                for (final c in [null, ...salon.categorias])
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(
                      label: Text(c ?? 'Todo'),
                      selected: _categoria == c,
                      onSelected: (_) => setState(() => _categoria = c),
                      showCheckmark: false,
                      shape: const StadiumBorder(),
                      side: BorderSide.none,
                      backgroundColor: QColors.white,
                      selectedColor: QColors.espresso,
                      labelStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: _categoria == c ? QColors.white : QColors.stone600),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(),
          Expanded(
            child: _cargandoCarta
                ? const Center(child: CircularProgressIndicator())
                : _errorCarta != null && salon.carta.isEmpty
                    ? Center(child: ErrorCarga(mensaje: _errorCarta!, onReintentar: _cargarCarta))
                    : platos.isEmpty
                        ? const Vacio(icono: Icons.search_off_rounded, titulo: 'No hay platos con ese nombre')
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                            itemCount: platos.length,
                            separatorBuilder: (_, __) => const Divider(height: 1),
                            itemBuilder: (_, i) {
                              final p = platos[i];
                              return _FilaPlato(
                                platillo: p,
                                cantidad: _cantidad(p.id),
                                tope: _tope(p),
                                onCambio: (n) => _cambiar(p, n),
                              );
                            },
                          ),
          ),
        ]),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
        floatingActionButton: AnimatedSwitcher(
          duration: QMotion.layout,
          switchInCurve: QMotion.curve,
          transitionBuilder: (hijo, anim) => SlideTransition(position: Tween(begin: const Offset(0, 1.5), end: Offset.zero).animate(anim), child: hijo),
          child: _lineas.isEmpty
              ? const SizedBox.shrink()
              : _BarraCarrito(key: const ValueKey('carrito'), unidades: _unidades, total: _total, onTap: _verPedido),
        ),
      ),
    );
  }
}

class _FilaPlato extends StatelessWidget {
  const _FilaPlato({required this.platillo, required this.cantidad, required this.tope, required this.onCambio});

  final Platillo platillo;
  final int cantidad;
  final int tope;
  final ValueChanged<int> onCambio;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final sinStock = tope == 0 && cantidad == 0;
    final aviso = platillo.aviso;
    return Opacity(
      opacity: sinStock ? 0.5 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          FotoPlatillo(platillo: platillo),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(platillo.nombre, style: t.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
              if (platillo.descripcion.isNotEmpty)
                Text(platillo.descripcion, style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 4),
              Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                Text(pesos(platillo.precio), style: t.titleSmall?.copyWith(fontWeight: FontWeight.w800, fontFeatures: tabular)),
                if (aviso != null) QChip(aviso, tono: platillo.agotado ? QTono.neutro : QTono.aviso),
              ]),
            ]),
          ),
          const SizedBox(width: 8),
          if (cantidad == 0)
            IconButton.filled(
              tooltip: sinStock ? Platillo.noDisponible : 'Agregar ${platillo.nombre}',
              onPressed: sinStock
                  ? null
                  : () {
                      HapticFeedback.selectionClick();
                      onCambio(1);
                    },
              icon: const Icon(Icons.add_rounded),
              style: IconButton.styleFrom(
                backgroundColor: QColors.espresso,
                foregroundColor: QColors.white,
                disabledBackgroundColor: QColors.stone200,
                fixedSize: const Size(44, 44),
              ),
            )
          else
            Cantidad(valor: cantidad, maximo: tope, onCambio: onCambio, oscuro: true),
        ]),
      ),
    );
  }
}

class _BarraCarrito extends StatelessWidget {
  const _BarraCarrito({super.key, required this.unidades, required this.total, required this.onTap});

  final int unidades;
  final double total;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 512),
        child: Material(
          color: QColors.espresso,
          borderRadius: BorderRadius.circular(QRadius.ticket),
          elevation: 0,
          child: InkWell(
            borderRadius: BorderRadius.circular(QRadius.ticket),
            onTap: onTap,
            child: Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(QRadius.ticket), boxShadow: QShadows.lift),
              child: Row(children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: QColors.caramel, borderRadius: BorderRadius.circular(QRadius.control)),
                  child: Text('$unidades', style: const TextStyle(color: QColors.espresso, fontWeight: FontWeight.w800, fontSize: 16, fontFeatures: tabular)),
                ),
                const SizedBox(width: 12),
                const Expanded(child: Text('Ver pedido', style: TextStyle(color: QColors.white, fontSize: 15, fontWeight: FontWeight.w700))),
                Text(pesos(total), style: const TextStyle(color: QColors.white, fontSize: 16, fontWeight: FontWeight.w800, fontFeatures: tabular)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _HojaPedido extends StatelessWidget {
  const _HojaPedido({
    required this.titulo,
    required this.lineas,
    required this.total,
    required this.enviando,
    required this.textoEnviar,
    required this.tope,
    required this.cantidadPlato,
    required this.onCantidad,
    required this.onNota,
    required this.onEnviar,
  });

  final String titulo;
  final List<LineaPedido> lineas;
  final double total;
  final bool enviando;
  final String textoEnviar;
  final int Function(Platillo) tope;
  final int Function(int platilloId) cantidadPlato;
  final void Function(LineaPedido, int) onCantidad;
  final void Function(LineaPedido, String) onNota;
  final Future<void> Function() onEnviar;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.92),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text(titulo, style: t.headlineSmall)),
        Flexible(
          child: ListView.separated(
            shrinkWrap: true,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: lineas.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final l = lineas[i];
              // Lo que esta línea puede crecer sin pasar el tope del plato.
              final maximo = tope(l.platillo) - cantidadPlato(l.platillo.id) + l.cantidad;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(l.platillo.nombre, style: t.titleSmall),
                      Text(pesos(l.subtotal), style: t.bodySmall?.copyWith(fontFeatures: tabular)),
                      const SizedBox(height: 6),
                      InkWell(
                        borderRadius: BorderRadius.circular(8),
                        onTap: () async {
                          final nota = await _pedirNota(context, l);
                          if (nota != null) onNota(l, nota);
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(l.nota.isEmpty ? Icons.add_comment_outlined : Icons.comment_outlined, size: 16, color: QColors.caramelDeep),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                l.nota.isEmpty ? 'Agregar nota' : l.nota,
                                style: const TextStyle(color: QColors.caramelDeep, fontWeight: FontWeight.w700, fontSize: 13),
                              ),
                            ),
                          ]),
                        ),
                      ),
                    ]),
                  ),
                  Cantidad(valor: l.cantidad, maximo: maximo.clamp(l.cantidad, Platillo.maximoPorPlato), onCambio: (n) => onCantidad(l, n)),
                ]),
              );
            },
          ),
        ),
        Container(
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: QColors.stone200))),
          padding: EdgeInsets.fromLTRB(20, 14, 20, 14 + MediaQuery.paddingOf(context).bottom),
          child: Column(children: [
            Row(children: [
              Text('Total', style: t.bodyLarge),
              const Spacer(),
              Text(pesos(total), style: t.headlineSmall?.copyWith(fontFeatures: tabular)),
            ]),
            const SizedBox(height: 12),
            QBoton(texto: textoEnviar, icono: Icons.send_rounded, alto: 56, expandir: true, cargando: enviando, onPressed: lineas.isEmpty ? null : onEnviar),
          ]),
        ),
      ]),
    );
  }

  Future<String?> _pedirNota(BuildContext context, LineaPedido linea) {
    final control = TextEditingController(text: linea.nota);
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (hoja) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(hoja).bottom),
        child: StatefulBuilder(builder: (hoja, refrescar) {
          return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Nota para ${linea.platillo.nombre}', style: Theme.of(hoja).textTheme.titleLarge),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final n in notasRapidas)
                FilterChip(
                  label: Text(n),
                  selected: control.text.contains(n),
                  showCheckmark: false,
                  shape: const StadiumBorder(),
                  side: const BorderSide(color: QColors.stone200),
                  selectedColor: QColors.espresso,
                  labelStyle: TextStyle(fontWeight: FontWeight.w600, color: control.text.contains(n) ? QColors.white : QColors.espresso),
                  onSelected: (activa) => refrescar(() {
                    final partes = control.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
                    activa ? partes.add(n) : partes.remove(n);
                    control.text = partes.join(', ');
                  }),
                ),
            ]),
            const SizedBox(height: 12),
            TextField(
              controller: control,
              maxLength: 200,
              minLines: 1,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(hintText: 'Ej.: sin tomate, para llevar'),
              onChanged: (_) => refrescar(() {}),
            ),
            const SizedBox(height: 8),
            QBoton(texto: 'Guardar nota', alto: 56, expandir: true, onPressed: () => Navigator.of(hoja).pop(control.text.trim())),
          ]);
        }),
      ),
    );
  }
}
