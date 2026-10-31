using Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace RestaurantApi.Controllers
{
    [Route("api/inventario")]
    [ApiController]
    [Authorize(Roles = "Administrador")]
    public class InventarioController : ControllerBase
    {
        private readonly RestauranteContext _context;
        private readonly IInventarioService _inventarioService;
        private readonly ILogger<InventarioController> _logger;

        public InventarioController(RestauranteContext context, IInventarioService inventarioService, ILogger<InventarioController> logger)
        {
            _context = context;
            _inventarioService = inventarioService;
            _logger = logger;
        }

        // ==================== CATEGORÍAS ====================

        /// <summary>
        /// Obtiene todas las categorías de inventario
        /// </summary>
        [HttpGet("categorias")]
        public async Task<ActionResult<IEnumerable<CategoriaInventario>>> GetCategorias()
        {
            try
            {
                var categorias = await _context.CategoriasInventario
                    .OrderBy(c => c.Nombre)
                    .ToListAsync();

                return Ok(categorias);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener categorías");
                return StatusCode(500, new { message = "Error al obtener categorías" });
            }
        }

        /// <summary>
        /// Obtiene una categoría por ID
        /// </summary>
        [HttpGet("categorias/{id}")]
        public async Task<ActionResult<CategoriaInventario>> GetCategoria(int id)
        {
            try
            {
                var categoria = await _context.CategoriasInventario.FindAsync(id);

                if (categoria == null)
                {
                    return NotFound($"Categoría con ID {id} no encontrada");
                }

                return Ok(categoria);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener categoría");
                return StatusCode(500, new { message = "Error al obtener categoría" });
            }
        }

        /// <summary>
        /// Crea una nueva categoría
        /// </summary>
        [HttpPost("categorias")]
        public async Task<ActionResult<CategoriaInventario>> CreateCategoria([FromBody] CategoriaInventarioDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                // Verificar si ya existe una categoría con ese nombre
                var existente = await _context.CategoriasInventario
                    .FirstOrDefaultAsync(c => c.Nombre.ToLower() == dto.Nombre.ToLower());

                if (existente != null)
                {
                    return BadRequest("Ya existe una categoría con ese nombre");
                }

                var categoria = new CategoriaInventario
                {
                    Nombre = dto.Nombre,
                    Descripcion = dto.Descripcion,
                    Tipo = dto.Tipo,
                    Color = dto.Color ?? "#3b82f6",
                    Activo = dto.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                _context.CategoriasInventario.Add(categoria);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetCategoria), new { id = categoria.Id }, categoria);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear categoría");
                return StatusCode(500, new { message = "Error al crear categoría" });
            }
        }

        /// <summary>
        /// Actualiza una categoría existente
        /// </summary>
        [HttpPut("categorias/{id}")]
        public async Task<IActionResult> UpdateCategoria(int id, [FromBody] CategoriaInventarioDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var categoria = await _context.CategoriasInventario.FindAsync(id);

                if (categoria == null)
                {
                    return NotFound($"Categoría con ID {id} no encontrada");
                }

                // Verificar si el nuevo nombre ya existe en otra categoría
                var existente = await _context.CategoriasInventario
                    .FirstOrDefaultAsync(c => c.Nombre.ToLower() == dto.Nombre.ToLower() && c.Id != id);

                if (existente != null)
                {
                    return BadRequest("Ya existe otra categoría con ese nombre");
                }

                categoria.Nombre = dto.Nombre;
                categoria.Descripcion = dto.Descripcion;
                categoria.Tipo = dto.Tipo;
                categoria.Color = dto.Color ?? categoria.Color;
                categoria.Activo = dto.Activo;

                await _context.SaveChangesAsync();

                return Ok(categoria);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar categoría");
                return StatusCode(500, new { message = "Error al actualizar categoría" });
            }
        }

        /// <summary>
        /// Elimina una categoría
        /// </summary>
        [HttpDelete("categorias/{id}")]
        public async Task<IActionResult> DeleteCategoria(int id)
        {
            try
            {
                var categoria = await _context.CategoriasInventario.FindAsync(id);

                if (categoria == null)
                {
                    return NotFound($"Categoría con ID {id} no encontrada");
                }

                // Verificar si hay productos asociados
                var tieneProductos = await _context.ProductosInventario
                    .AnyAsync(p => p.CategoriaId == id);

                if (tieneProductos)
                {
                    return BadRequest("No se puede eliminar la categoría porque tiene productos asociados");
                }

                _context.CategoriasInventario.Remove(categoria);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Categoría eliminada exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar categoría");
                return StatusCode(500, new { message = "Error al eliminar categoría" });
            }
        }

        // ==================== PROVEEDORES ====================

        /// Obtiene todos los proveedores
        [HttpGet("proveedores")]
        public async Task<ActionResult<IEnumerable<object>>> GetProveedores()
        {
            try
            {
                var proveedores = await _context.Proveedores
                    .OrderBy(p => p.Nombre)
                    .Select(p => new
                    {
                        p.Id,
                        p.Nombre,
                        Contacto = p.Contacto ?? "",
                        Telefono = p.Telefono ?? "",
                        Email = p.Email ?? "",
                        Direccion = p.Direccion ?? "",
                        NIT = p.NIT ?? "",
                        Ciudad = p.Ciudad ?? "",
                        Pais = p.Pais ?? "Colombia",
                        NotasAdicionales = p.NotasAdicionales ?? "",
                        TipoProductos = p.TipoProductos ?? "",
                        p.Activo,
                        p.FechaRegistro
                    })
                    .ToListAsync();

                return Ok(proveedores);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener proveedores");
                return StatusCode(500, new { message = "Error al obtener proveedores" });
            }
        }

        /// <summary>
        /// Obtiene un proveedor por ID
        /// </summary>
        [HttpGet("proveedores/{id}")]
        public async Task<ActionResult<Proveedor>> GetProveedor(int id)
        {
            try
            {
                var proveedor = await _context.Proveedores.FindAsync(id);

                if (proveedor == null)
                {
                    return NotFound($"Proveedor con ID {id} no encontrado");
                }

                return Ok(proveedor);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener proveedor");
                return StatusCode(500, new { message = "Error al obtener proveedor" });
            }
        }

        /// <summary>
        /// Crea un nuevo proveedor
        /// </summary>
        [HttpPost("proveedores")]
        public async Task<ActionResult<Proveedor>> CreateProveedor([FromBody] ProveedorDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var proveedor = new Proveedor
                {
                    Nombre = dto.Nombre,
                    Contacto = dto.Contacto,
                    Telefono = dto.Telefono,
                    Email = dto.Email,
                    Direccion = dto.Direccion,
                    Ciudad = dto.Ciudad,
                    TipoProductos = dto.TipoProductos,
                    Activo = dto.Activo,
                    FechaRegistro = DateTime.UtcNow
                };

                _context.Proveedores.Add(proveedor);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetProveedor), new { id = proveedor.Id }, proveedor);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear proveedor");
                return StatusCode(500, new { message = "Error al crear proveedor" });
            }
        }

        /// <summary>
        /// Actualiza un proveedor existente
        /// </summary>
        [HttpPut("proveedores/{id}")]
        public async Task<IActionResult> UpdateProveedor(int id, [FromBody] ProveedorDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var proveedor = await _context.Proveedores.FindAsync(id);

                if (proveedor == null)
                {
                    return NotFound($"Proveedor con ID {id} no encontrado");
                }

                proveedor.Nombre = dto.Nombre;
                proveedor.Contacto = dto.Contacto;
                proveedor.Telefono = dto.Telefono;
                proveedor.Email = dto.Email;
                proveedor.Direccion = dto.Direccion;
                proveedor.Ciudad = dto.Ciudad;
                proveedor.TipoProductos = dto.TipoProductos;
                proveedor.Activo = dto.Activo;

                await _context.SaveChangesAsync();

                return Ok(proveedor);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar proveedor");
                return StatusCode(500, new { message = "Error al actualizar proveedor" });
            }
        }

        /// <summary>
        /// Elimina un proveedor
        /// </summary>
        [HttpDelete("proveedores/{id}")]
        public async Task<IActionResult> DeleteProveedor(int id)
        {
            try
            {
                var proveedor = await _context.Proveedores.FindAsync(id);

                if (proveedor == null)
                {
                    return NotFound($"Proveedor con ID {id} no encontrado");
                }

                // Verificar si hay productos asociados
                var tieneProductos = await _context.ProductosInventario
                    .AnyAsync(p => p.ProveedorId == id);

                if (tieneProductos)
                {
                    return BadRequest("No se puede eliminar el proveedor porque tiene productos asociados");
                }

                _context.Proveedores.Remove(proveedor);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Proveedor eliminado exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar proveedor");
                return StatusCode(500, new { message = "Error al eliminar proveedor" });
            }
        }

        // ==================== ALMACENES ====================

        /// <summary>
        /// Obtiene todos los almacenes
        /// </summary>
        [HttpGet("almacenes")]
        public async Task<ActionResult<IEnumerable<Almacen>>> GetAlmacenes()
        {
            try
            {
                var almacenes = await _context.Almacenes
                    .OrderBy(a => a.Nombre)
                    .ToListAsync();

                return Ok(almacenes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener almacenes");
                return StatusCode(500, new { message = "Error al obtener almacenes" });
            }
        }

        /// <summary>
        /// Obtiene un almacén por ID
        /// </summary>
        [HttpGet("almacenes/{id}")]
        public async Task<ActionResult<Almacen>> GetAlmacen(int id)
        {
            try
            {
                var almacen = await _context.Almacenes.FindAsync(id);

                if (almacen == null)
                {
                    return NotFound($"Almacén con ID {id} no encontrado");
                }

                return Ok(almacen);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener almacén");
                return StatusCode(500, new { message = "Error al obtener almacén" });
            }
        }

        /// <summary>
        /// Crea un nuevo almacén
        /// </summary>
        [HttpPost("almacenes")]
        public async Task<ActionResult<Almacen>> CreateAlmacen([FromBody] AlmacenDTO dto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                // Verificar si ya existe un almacén con ese código
                var existente = await _context.Almacenes
                    .FirstOrDefaultAsync(a => a.Codigo.ToLower() == dto.Codigo.ToLower());

                if (existente != null)
                {
                    return BadRequest("Ya existe un almacén con ese código");
                }

                var almacen = new Almacen
                {
                    Codigo = dto.Codigo,
                    Nombre = dto.Nombre,
                    Descripcion = dto.Descripcion,
                    Ubicacion = dto.Ubicacion,
                    Tipo = dto.Tipo,
                    Activo = dto.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                _context.Almacenes.Add(almacen);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetAlmacen), new { id = almacen.Id }, almacen);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear almacén");
                return StatusCode(500, new { message = "Error al crear almacén" });
            }
        }

        /// <summary>
        /// Actualiza un almacén existente
        /// </summary>
        [HttpPut("almacenes/{id}")]
        public async Task<IActionResult> UpdateAlmacen(int id, [FromBody] AlmacenDTO dto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var almacen = await _context.Almacenes.FindAsync(id);

                if (almacen == null)
                {
                    return NotFound($"Almacén con ID {id} no encontrado");
                }

                // Verificar si el nuevo código ya existe en otro almacén
                var existente = await _context.Almacenes
                    .FirstOrDefaultAsync(a => a.Codigo.ToLower() == dto.Codigo.ToLower() && a.Id != id);

                if (existente != null)
                {
                    return BadRequest("Ya existe otro almacén con ese código");
                }

                almacen.Codigo = dto.Codigo;
                almacen.Nombre = dto.Nombre;
                almacen.Descripcion = dto.Descripcion;
                almacen.Ubicacion = dto.Ubicacion;
                almacen.Tipo = dto.Tipo;
                almacen.Activo = dto.Activo;

                await _context.SaveChangesAsync();

                return Ok(almacen);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar almacén");
                return StatusCode(500, new { message = "Error al actualizar almacén" });
            }
        }

        /// <summary>
        /// Elimina un almacén
        /// </summary>
        [HttpDelete("almacenes/{id}")]
        public async Task<IActionResult> DeleteAlmacen(int id)
        {
            try
            {
                var almacen = await _context.Almacenes.FindAsync(id);

                if (almacen == null)
                {
                    return NotFound($"Almacén con ID {id} no encontrado");
                }

                // Verificar si hay stock en este almacén
                var tieneStock = await _context.Stock
                    .AnyAsync(s => s.AlmacenId == id && s.Cantidad > 0);

                if (tieneStock)
                {
                    return BadRequest("No se puede eliminar el almacén porque tiene productos en stock");
                }

                _context.Almacenes.Remove(almacen);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Almacén eliminado exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar almacén");
                return StatusCode(500, new { message = "Error al eliminar almacén" });
            }
        }

        // ==================== PRODUCTOS ====================

        /// <summary>
        /// Obtiene todos los productos de inventario
        /// </summary>
        [HttpGet("productos")]
        public async Task<ActionResult<IEnumerable<object>>> GetProductos()
        {
            try
            {
                var productos = await _context.ProductosInventario
                    .Include(p => p.Categoria)
                    .Include(p => p.Proveedor)
                    .OrderBy(p => p.Nombre)
                    .Select(p => new
                    {
                        p.Id,
                        p.Codigo,
                        p.Nombre,
                        p.Descripcion,
                        p.CategoriaId,
                        CategoriaNombre = p.Categoria.Nombre,
                        p.ProveedorId,
                        ProveedorNombre = p.Proveedor != null ? p.Proveedor.Nombre : null,
                        p.UnidadMedida,
                        p.PrecioCosto,
                        p.StockMinimo,
                        p.StockMaximo,
                        p.PuntoReorden,
                        p.RequiereCaducidad,
                        p.DiasVencimiento,
                        p.ImagenUrl,
                        p.Activo,
                        p.FechaCreacion
                    })
                    .ToListAsync();

                return Ok(productos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener productos");
                return StatusCode(500, new { message = "Error al obtener productos" });
            }
        }

        /// <summary>
        /// Obtiene un producto por ID
        /// </summary>
        [HttpGet("productos/{id}")]
        public async Task<ActionResult<ProductoInventario>> GetProducto(int id)
        {
            try
            {
                var producto = await _context.ProductosInventario
                    .Include(p => p.Categoria)
                    .Include(p => p.Proveedor)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (producto == null)
                {
                    return NotFound($"Producto con ID {id} no encontrado");
                }

                return Ok(producto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener producto");
                return StatusCode(500, new { message = "Error al obtener producto" });
            }
        }

        /// <summary>
        /// Crea un nuevo producto
        /// </summary>
        [HttpPost("productos")]
        public async Task<ActionResult<ProductoInventario>> CreateProducto([FromBody] ProductoInventarioDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                // Verificar si ya existe un producto con ese código
                var existente = await _context.ProductosInventario
                    .FirstOrDefaultAsync(p => p.Codigo.ToLower() == dto.Codigo.ToLower());

                if (existente != null)
                {
                    return BadRequest("Ya existe un producto con ese código");
                }

                // Verificar que la categoría existe
                var categoriaExiste = await _context.CategoriasInventario
                    .AnyAsync(c => c.Id == dto.CategoriaId);

                if (!categoriaExiste)
                {
                    return BadRequest("La categoría especificada no existe");
                }

                // Si hay proveedor, verificar que existe
                if (dto.ProveedorId.HasValue)
                {
                    var proveedorExiste = await _context.Proveedores
                        .AnyAsync(p => p.Id == dto.ProveedorId.Value);

                    if (!proveedorExiste)
                    {
                        return BadRequest("El proveedor especificado no existe");
                    }
                }

                var producto = new ProductoInventario
                {
                    Codigo = dto.Codigo,
                    Nombre = dto.Nombre,
                    Descripcion = dto.Descripcion,
                    CategoriaId = dto.CategoriaId,
                    ProveedorId = dto.ProveedorId,
                    UnidadMedida = dto.UnidadMedida,
                    PrecioCosto = dto.PrecioCosto,
                    StockMinimo = dto.StockMinimo,
                    StockMaximo = dto.StockMaximo,
                    PuntoReorden = dto.PuntoReorden,
                    RequiereCaducidad = dto.RequiereCaducidad,
                    DiasVencimiento = dto.DiasVencimiento,
                    ImagenUrl = dto.ImagenUrl,
                    Activo = dto.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                _context.ProductosInventario.Add(producto);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetProducto), new { id = producto.Id }, producto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear producto");
                return StatusCode(500, new { message = "Error al crear producto" });
            }
        }

        /// <summary>
        /// Actualiza un producto existente
        /// </summary>
        [HttpPut("productos/{id}")]
        public async Task<IActionResult> UpdateProducto(int id, [FromBody] ProductoInventarioDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var producto = await _context.ProductosInventario.FindAsync(id);

                if (producto == null)
                {
                    return NotFound($"Producto con ID {id} no encontrado");
                }

                // Verificar si el nuevo código ya existe en otro producto
                var existente = await _context.ProductosInventario
                    .FirstOrDefaultAsync(p => p.Codigo.ToLower() == dto.Codigo.ToLower() && p.Id != id);

                if (existente != null)
                {
                    return BadRequest("Ya existe otro producto con ese código");
                }

                // Verificar que la categoría existe
                var categoriaExiste = await _context.CategoriasInventario
                    .AnyAsync(c => c.Id == dto.CategoriaId);

                if (!categoriaExiste)
                {
                    return BadRequest("La categoría especificada no existe");
                }

                // Si hay proveedor, verificar que existe
                if (dto.ProveedorId.HasValue)
                {
                    var proveedorExiste = await _context.Proveedores
                        .AnyAsync(p => p.Id == dto.ProveedorId.Value);

                    if (!proveedorExiste)
                    {
                        return BadRequest("El proveedor especificado no existe");
                    }
                }

                producto.Codigo = dto.Codigo;
                producto.Nombre = dto.Nombre;
                producto.Descripcion = dto.Descripcion;
                producto.CategoriaId = dto.CategoriaId;
                producto.ProveedorId = dto.ProveedorId;
                producto.UnidadMedida = dto.UnidadMedida;
                producto.PrecioCosto = dto.PrecioCosto;
                producto.StockMinimo = dto.StockMinimo;
                producto.StockMaximo = dto.StockMaximo;
                producto.PuntoReorden = dto.PuntoReorden;
                producto.RequiereCaducidad = dto.RequiereCaducidad;
                producto.DiasVencimiento = dto.DiasVencimiento;
                producto.ImagenUrl = dto.ImagenUrl;
                producto.Activo = dto.Activo;
                producto.FechaActualizacion = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(producto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar producto");
                return StatusCode(500, new { message = "Error al actualizar producto" });
            }
        }

        /// <summary>
        /// Elimina un producto
        /// </summary>
        [HttpDelete("productos/{id}")]
        public async Task<IActionResult> DeleteProducto(int id)
        {
            try
            {
                var producto = await _context.ProductosInventario.FindAsync(id);

                if (producto == null)
                {
                    return NotFound($"Producto con ID {id} no encontrado");
                }

                // Verificar si tiene stock
                var tieneStock = await _context.Stock
                    .AnyAsync(s => s.ProductoId == id && s.Cantidad > 0);

                if (tieneStock)
                {
                    return BadRequest("No se puede eliminar el producto porque tiene stock disponible");
                }

                // Verificar si tiene movimientos
                var tieneMovimientos = await _context.MovimientosInventario
                    .AnyAsync(m => m.ProductoId == id);

                if (tieneMovimientos)
                {
                    return BadRequest("No se puede eliminar el producto porque tiene movimientos registrados. Considere desactivarlo en su lugar.");
                }

                _context.ProductosInventario.Remove(producto);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Producto eliminado exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar producto");
                return StatusCode(500, new { message = "Error al eliminar producto" });
            }
        }

        // ==================== STOCK ====================

        /// <summary>
        /// Obtiene todo el stock
        /// </summary>
        [HttpGet("stock")]
        public async Task<ActionResult<IEnumerable<object>>> GetStock()
        {
            try
            {
                var stock = await _context.Stock
                    .Include(s => s.Producto)
                    .Include(s => s.Almacen)
                    .Select(s => new
                    {
                        s.Id,
                        s.ProductoId,
                        ProductoNombre = s.Producto.Nombre,
                        ProductoCodigo = s.Producto.Codigo,
                        s.AlmacenId,
                        AlmacenNombre = s.Almacen.Nombre,
                        s.Cantidad,
                        s.CostoPromedio,
                        s.CostoTotal,
                        UnidadMedida = s.Producto.UnidadMedida,
                        s.FechaActualizacion
                    })
                    .ToListAsync();

                return Ok(stock);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener stock");
                return StatusCode(500, new { message = "Error al obtener stock" });
            }
        }

        /// <summary>
        /// Obtiene el stock de un almacén específico
        /// </summary>
        [HttpGet("stock/almacen/{almacenId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetStockPorAlmacen(int almacenId)
        {
            try
            {
                var stock = await _context.Stock
                    .Include(s => s.Producto)
                    .Include(s => s.Almacen)
                    .Where(s => s.AlmacenId == almacenId)
                    .Select(s => new
                    {
                        s.Id,
                        s.ProductoId,
                        ProductoNombre = s.Producto.Nombre,
                        ProductoCodigo = s.Producto.Codigo,
                        s.AlmacenId,
                        AlmacenNombre = s.Almacen.Nombre,
                        s.Cantidad,
                        s.CostoPromedio,
                        s.CostoTotal,
                        UnidadMedida = s.Producto.UnidadMedida,
                        s.FechaActualizacion
                    })
                    .ToListAsync();

                return Ok(stock);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener stock por almacén");
                return StatusCode(500, new { message = "Error al obtener stock por almacén" });
            }
        }

        /// <summary>
        /// Obtiene el stock de un producto específico
        /// </summary>
        [HttpGet("stock/producto/{productoId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetStockPorProducto(int productoId)
        {
            try
            {
                var stock = await _context.Stock
                    .Include(s => s.Producto)
                    .Include(s => s.Almacen)
                    .Where(s => s.ProductoId == productoId)
                    .Select(s => new
                    {
                        s.Id,
                        s.ProductoId,
                        ProductoNombre = s.Producto.Nombre,
                        ProductoCodigo = s.Producto.Codigo,
                        s.AlmacenId,
                        AlmacenNombre = s.Almacen.Nombre,
                        s.Cantidad,
                        s.CostoPromedio,
                        s.CostoTotal,
                        UnidadMedida = s.Producto.UnidadMedida,
                        s.FechaActualizacion
                    })
                    .ToListAsync();

                return Ok(stock);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener stock por producto");
                return StatusCode(500, new { message = "Error al obtener stock por producto" });
            }
        }

        // ==================== GET: Obtener todos los movimientos ====================
        [HttpGet("movimientos")]
        public async Task<ActionResult<IEnumerable<object>>> GetMovimientos()
        {
            try
            {
                var movimientos = await _context.MovimientosInventario
                    .Include(m => m.Producto)
                    .Include(m => m.Almacen) // ✅ Cambio: ahora es Almacen en lugar de AlmacenOrigen
                    .OrderByDescending(m => m.Fecha)
                    .Take(100)
                    .Select(m => new
                    {
                        m.Id,
                        m.ProductoId,
                        ProductoNombre = m.Producto.Nombre,
                        ProductoCodigo = m.Producto.Codigo,
                        m.AlmacenId, // ✅ Cambio: AlmacenId en lugar de AlmacenOrigenId
                        AlmacenNombre = m.Almacen.Nombre,
                        m.TipoMovimiento,
                        m.Cantidad,
                        m.CostoUnitario,
                        m.CostoTotal,
                        m.Motivo,
                        m.Referencia,
                        m.Fecha
                    })
                    .ToListAsync();

                return Ok(movimientos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener movimientos");
                return StatusCode(500, new { message = "Error al obtener movimientos" });
            }
        }
        /// <summary>
        /// Registra un nuevo movimiento de inventario
        /// </summary>
        [HttpPost("movimientos")]
        public async Task<ActionResult<MovimientoInventario>> CreateMovimiento([FromBody] MovimientoInventarioDTO dto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                if (dto.TipoMovimiento != "Ajuste" && dto.Cantidad <= 0)
                {
                    return BadRequest("La cantidad debe ser mayor que cero");
                }

                // Verificar que el producto existe
                var producto = await _context.ProductosInventario.FindAsync(dto.ProductoId);
                if (producto == null)
                {
                    return BadRequest("El producto especificado no existe");
                }

                // Verificar que el almacén existe
                var almacen = await _context.Almacenes.FindAsync(dto.AlmacenId);
                if (almacen == null)
                {
                    return BadRequest("El almacén especificado no existe");
                }

                // Obtener o crear el registro de stock
                var stock = await _context.Stock
                    .FirstOrDefaultAsync(s => s.ProductoId == dto.ProductoId && s.AlmacenId == dto.AlmacenId);

                if (stock == null && (dto.TipoMovimiento == "Salida" || dto.TipoMovimiento == "Merma"))
                {
                    return BadRequest("No hay stock disponible para realizar esta operación");
                }

                if (stock == null)
                {
                    stock = new Stock
                    {
                        ProductoId = dto.ProductoId,
                        AlmacenId = dto.AlmacenId,
                        Cantidad = 0,
                        CostoPromedio = dto.CostoUnitario ?? 0,
                        FechaActualizacion = DateTime.UtcNow
                    };
                    _context.Stock.Add(stock);
                }

                // Calcular el nuevo stock según el tipo de movimiento
                decimal nuevaCantidad = stock.Cantidad;
                decimal costoUnitario = dto.CostoUnitario ?? stock.CostoPromedio;

                switch (dto.TipoMovimiento)
                {
                    case "Entrada":
                        nuevaCantidad += dto.Cantidad;
                        // Actualizar costo promedio ponderado
                        if (dto.CostoUnitario.HasValue)
                        {
                            decimal costoTotalAnterior = stock.Cantidad * stock.CostoPromedio;
                            decimal costoTotalNuevo = dto.Cantidad * dto.CostoUnitario.Value;
                            // Un stock previo negativo (datos antiguos) no debe distorsionar el promedio.
                            stock.CostoPromedio = stock.Cantidad > 0
                                ? (costoTotalAnterior + costoTotalNuevo) / nuevaCantidad
                                : dto.CostoUnitario.Value;
                        }
                        break;

                    case "Salida":
                    case "Merma":
                        if (stock.Cantidad < dto.Cantidad)
                        {
                            return BadRequest($"Stock insuficiente. Disponible: {stock.Cantidad}, Solicitado: {dto.Cantidad}");
                        }
                        nuevaCantidad -= dto.Cantidad;
                        await DescontarLotesAsync(dto.ProductoId, dto.AlmacenId, dto.LoteId, dto.Cantidad);
                        break;

                    case "Ajuste":
                        nuevaCantidad = dto.Cantidad;
                        if (nuevaCantidad < stock.Cantidad)
                            await DescontarLotesAsync(dto.ProductoId, dto.AlmacenId, null, stock.Cantidad - nuevaCantidad);
                        break;

                    default:
                        return BadRequest("Tipo de movimiento no válido");
                }

                // Actualizar stock
                stock.Cantidad = nuevaCantidad;
                stock.FechaActualizacion = DateTime.UtcNow;

                // Crear el movimiento (CostoTotal es generado automáticamente por MySQL)
                var movimiento = new MovimientoInventario
                {
                    ProductoId = dto.ProductoId,
                    AlmacenId = dto.AlmacenId,
                    TipoMovimiento = dto.TipoMovimiento,
                    Cantidad = dto.Cantidad,
                    CostoUnitario = costoUnitario,
                    Motivo = dto.Motivo ?? string.Empty,
                    Referencia = dto.Referencia ?? string.Empty,
                    LoteId = dto.LoteId,
                    // El responsable es quien está autenticado, no lo que diga el cuerpo.
                    UsuarioId = QproClaims.IdUsuario(User) ?? 1,
                    Fecha = DateTime.UtcNow
                };

                _context.MovimientosInventario.Add(movimiento);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetMovimientos), new { id = movimiento.Id }, movimiento);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear movimiento");
                return StatusCode(500, new { message = "Error al crear movimiento" });
            }
        }

        /// <summary>
        /// Saca la cantidad de los lotes (el indicado primero, luego FIFO por vencimiento)
        /// para que los lotes no muestren más existencias que el stock.
        /// </summary>
        private async Task DescontarLotesAsync(int productoId, int almacenId, int? loteId, decimal cantidad)
        {
            var lotes = (await _context.Lotes
                    .Where(l => l.ProductoId == productoId && l.AlmacenId == almacenId && l.CantidadActual > 0)
                    .ToListAsync())
                .OrderByDescending(l => l.Id == loteId)
                .ThenBy(l => l.FechaVencimiento == null)
                .ThenBy(l => l.FechaVencimiento)
                .ThenBy(l => l.FechaIngreso);

            foreach (var lote in lotes)
            {
                if (cantidad <= 0) break;
                var tomar = Math.Min(cantidad, lote.CantidadActual);
                lote.CantidadActual -= tomar;
                cantidad -= tomar;
            }
        }

        // ==================== LOTES ====================

        /// <summary>
        /// Obtiene todos los lotes
        /// </summary>
        [HttpGet("lotes")]
        public async Task<ActionResult<IEnumerable<object>>> GetLotes()
        {
            try
            {
                var lotes = await _context.Lotes
                    .Include(l => l.Producto)
                    .Include(l => l.Almacen)
                    .OrderByDescending(l => l.FechaIngreso)
                    .Select(l => new
                    {
                        l.Id,
                        l.NumeroLote,
                        l.ProductoId,
                        ProductoNombre = l.Producto.Nombre,
                        l.AlmacenId,
                        AlmacenNombre = l.Almacen.Nombre,
                        l.CantidadInicial,
                        l.CantidadActual,
                        l.FechaIngreso,
                        l.FechaVencimiento,
                        l.CostoUnitario,
                        l.Estado
                    })
                    .ToListAsync();

                return Ok(lotes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener lotes");
                return StatusCode(500, new { message = "Error al obtener lotes" });
            }
        }

        /// <summary>
        /// Obtiene lotes próximos a vencer
        /// </summary>
        [HttpGet("lotes/vencimiento")]
        public async Task<ActionResult<IEnumerable<object>>> GetLotesProximosVencer([FromQuery] int dias = 7)
        {
            try
            {
                var hoyColombia = HoraLocal.AhoraColombia().Date;
                var fechaLimite = hoyColombia.AddDays(dias);

                var lotes = await _context.Lotes
                    .Include(l => l.Producto)
                    .Include(l => l.Almacen)
                    .Where(l => l.Estado == "Activo"
                             && l.CantidadActual > 0
                             && l.FechaVencimiento.HasValue
                             && l.FechaVencimiento.Value <= fechaLimite)
                    .OrderBy(l => l.FechaVencimiento)
                    .Select(l => new
                    {
                        l.Id,
                        l.NumeroLote,
                        l.ProductoId,
                        ProductoNombre = l.Producto.Nombre,
                        l.AlmacenId,
                        AlmacenNombre = l.Almacen.Nombre,
                        l.CantidadActual,
                        l.FechaVencimiento,
                        DiasParaVencer = EF.Functions.DateDiffDay(hoyColombia, l.FechaVencimiento.Value)
                    })
                    .ToListAsync();

                return Ok(lotes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener lotes próximos a vencer");
                return StatusCode(500, new { message = "Error al obtener lotes próximos a vencer" });
            }
        }

        // ==================== REPORTES ====================

        /// Obtiene el resumen general de stock (vista vw_stock_general)
        [HttpGet("reportes/stock-general")]
        public async Task<ActionResult<IEnumerable<object>>> GetStockGeneral()
        {
            try
            {
                var resultado = await _context.ProductosInventario
                    .Include(p => p.Categoria)
                    .Where(p => p.Activo)
                    .Select(p => new
                    {
                        ProductoId = p.Id,
                        p.Codigo,
                        ProductoNombre = p.Nombre,
                        Categoria = p.Categoria.Nombre,
                        p.UnidadMedida,
                        StockTotal = _context.Stock
                            .Where(s => s.ProductoId == p.Id)
                            .Sum(s => (decimal?)s.Cantidad) ?? 0,
                        p.StockMinimo,
                        p.StockMaximo,
                        p.PuntoReorden,
                        ValorInventario = _context.Stock
                            .Where(s => s.ProductoId == p.Id)
                            .Sum(s => (decimal?)s.CostoTotal) ?? 0,
                        EstadoStock =
                            (_context.Stock.Where(s => s.ProductoId == p.Id).Sum(s => (decimal?)s.Cantidad) ?? 0) == 0 ? "Agotado" :
                            (_context.Stock.Where(s => s.ProductoId == p.Id).Sum(s => (decimal?)s.Cantidad) ?? 0) <= p.StockMinimo ? "Critico" :
                            (_context.Stock.Where(s => s.ProductoId == p.Id).Sum(s => (decimal?)s.Cantidad) ?? 0) <= (p.PuntoReorden ?? p.StockMinimo) ? "Bajo" :
                            (p.StockMaximo.HasValue && (_context.Stock.Where(s => s.ProductoId == p.Id).Sum(s => (decimal?)s.Cantidad) ?? 0) >= p.StockMaximo) ? "Excedido" :
                            "Normal",
                        p.Activo
                    })
                    .ToListAsync();

                return Ok(resultado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener stock general");
                return StatusCode(500, new { message = "Error al obtener stock general" });
            }
        }

        /// Obtiene productos próximos a vencer (vista vw_productos_vencimiento)
        [HttpGet("reportes/productos-vencimiento")]
        public async Task<ActionResult<IEnumerable<object>>> GetProductosVencimiento()
        {
            try
            {
                var hoyColombia = HoraLocal.AhoraColombia().Date;
                var resultado = await _context.Lotes
                    .Include(l => l.Producto)
                    .Include(l => l.Almacen)
                    .Where(l => l.Estado == "Activo"
                             && l.CantidadActual > 0
                             && l.FechaVencimiento.HasValue)
                    .OrderBy(l => l.FechaVencimiento)
                    .Select(l => new
                    {
                        LoteId = l.Id,
                        l.NumeroLote,
                        ProductoId = l.Producto.Id,
                        ProductoNombre = l.Producto.Nombre,
                        Almacen = l.Almacen.Nombre,
                        l.CantidadActual,
                        UnidadMedida = l.Producto.UnidadMedida,
                        l.FechaVencimiento,
                        DiasParaVencer = EF.Functions.DateDiffDay(hoyColombia, l.FechaVencimiento.Value),
                        NivelAlerta =
                            l.FechaVencimiento.Value < hoyColombia ? "Vencido" :
                            EF.Functions.DateDiffDay(hoyColombia, l.FechaVencimiento.Value) <= 3 ? "Critico" :
                            EF.Functions.DateDiffDay(hoyColombia, l.FechaVencimiento.Value) <= 7 ? "Advertencia" :
                            "Normal"
                    })
                    .ToListAsync();

                return Ok(resultado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener productos próximos a vencer");
                return StatusCode(500, new { message = "Error al obtener productos próximos a vencer" });
            }
        }

        /// Obtiene el valor del inventario por almacén (vista vw_valor_inventario_almacen)
        [HttpGet("reportes/valor-por-almacen")]
        public async Task<ActionResult<IEnumerable<object>>> GetValorInventarioPorAlmacen()
        {
            try
            {
                var resultado = await _context.Almacenes
                    .Where(a => a.Activo)
                    .Select(a => new
                    {
                        AlmacenId = a.Id,
                        a.Codigo,
                        Almacen = a.Nombre,
                        a.Tipo,
                        TotalProductos = _context.Stock
                            .Where(s => s.AlmacenId == a.Id)
                            .Select(s => s.ProductoId)
                            .Distinct()
                            .Count(),
                        CantidadTotal = _context.Stock
                            .Where(s => s.AlmacenId == a.Id)
                            .Sum(s => (decimal?)s.Cantidad) ?? 0,
                        ValorTotal = _context.Stock
                            .Where(s => s.AlmacenId == a.Id)
                            .Sum(s => (decimal?)s.CostoTotal) ?? 0
                    })
                    .ToListAsync();

                return Ok(resultado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener valor de inventario por almacén");
                return StatusCode(500, new { message = "Error al obtener valor de inventario por almacén" });
            }
        }

        /// Obtiene alertas de stock (productos con stock bajo o crítico)
        [HttpGet("reportes/alertas-stock")]
        public async Task<ActionResult<IEnumerable<object>>> GetAlertasStock()
        {
            try
            {
                var alertas = await _context.ProductosInventario
                    .Where(p => p.Activo)
                    .Select(p => new
                    {
                        p.Id,
                        p.Codigo,
                        ProductoNombre = p.Nombre,
                        Categoria = p.Categoria.Nombre,
                        p.UnidadMedida,
                        StockTotal = _context.Stock
                            .Where(s => s.ProductoId == p.Id)
                            .Sum(s => (decimal?)s.Cantidad) ?? 0,
                        p.StockMinimo,
                        p.PuntoReorden,
                        EstadoStock =
                            (_context.Stock.Where(s => s.ProductoId == p.Id).Sum(s => (decimal?)s.Cantidad) ?? 0) == 0 ? "Agotado" :
                            (_context.Stock.Where(s => s.ProductoId == p.Id).Sum(s => (decimal?)s.Cantidad) ?? 0) <= p.StockMinimo ? "Critico" :
                            (_context.Stock.Where(s => s.ProductoId == p.Id).Sum(s => (decimal?)s.Cantidad) ?? 0) <= (p.PuntoReorden ?? p.StockMinimo) ? "Bajo" :
                            "Normal"
                    })
                    .Where(p => p.StockTotal <= (p.PuntoReorden ?? p.StockMinimo))
                    .OrderBy(p => p.StockTotal)
                    .ToListAsync();

                return Ok(alertas);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener alertas de stock");
                return StatusCode(500, new { message = "Error al obtener alertas de stock" });
            }
        }

        // ==================== RECETAS / FICHAS TÉCNICAS ====================

        /// <summary>
        /// Obtiene todas las recetas registradas
        /// </summary>
        [HttpGet("recetas")]
        public async Task<ActionResult<IEnumerable<RecetaDto>>> GetRecetas()
        {
            try
            {
                await _inventarioService.InicializarRecetasPredeterminadasAsync();

                var recetas = await _context.Recetas
                    .Include(r => r.Platillo)
                    .Include(r => r.Producto)
                    .OrderBy(r => r.Platillo.Nombre)
                    .Select(r => new RecetaDto
                    {
                        Id = r.Id,
                        PlatilloId = r.PlatilloId,
                        PlatilloNombre = r.Platillo.Nombre,
                        ProductoId = r.ProductoId,
                        ProductoNombre = r.Producto.Nombre,
                        ProductoCodigo = r.Producto.Codigo,
                        CantidadRequerida = r.CantidadRequerida,
                        UnidadMedida = r.UnidadMedida.ToString(),
                        CostoUnitario = r.CostoUnitario ?? r.Producto.PrecioCosto,
                        Opcional = r.Opcional,
                        Notas = r.Notas
                    })
                    .ToListAsync();

                return Ok(recetas);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener recetas");
                return StatusCode(500, new { message = "Error al obtener recetas" });
            }
        }

        /// <summary>
        /// Obtiene la receta (insumos) de un platillo específico
        /// </summary>
        [HttpGet("recetas/platillo/{platilloId}")]
        public async Task<ActionResult<IEnumerable<RecetaDto>>> GetRecetasPorPlatillo(int platilloId)
        {
            try
            {
                await _inventarioService.InicializarRecetasPredeterminadasAsync();

                var recetas = await _context.Recetas
                    .Include(r => r.Platillo)
                    .Include(r => r.Producto)
                    .Where(r => r.PlatilloId == platilloId)
                    .Select(r => new RecetaDto
                    {
                        Id = r.Id,
                        PlatilloId = r.PlatilloId,
                        PlatilloNombre = r.Platillo.Nombre,
                        ProductoId = r.ProductoId,
                        ProductoNombre = r.Producto.Nombre,
                        ProductoCodigo = r.Producto.Codigo,
                        CantidadRequerida = r.CantidadRequerida,
                        UnidadMedida = r.UnidadMedida.ToString(),
                        CostoUnitario = r.CostoUnitario ?? r.Producto.PrecioCosto,
                        Opcional = r.Opcional,
                        Notas = r.Notas
                    })
                    .ToListAsync();

                return Ok(recetas);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener receta del platillo");
                return StatusCode(500, new { message = "Error al obtener receta del platillo" });
            }
        }

        /// <summary>
        /// Agrega un nuevo ingrediente a la receta de un platillo
        /// </summary>
        [HttpPost("recetas")]
        public async Task<ActionResult<RecetaDto>> CreateReceta([FromBody] CrearRecetaDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var platillo = await _context.Platillos.FindAsync(dto.PlatilloId);
                if (platillo == null)
                    return BadRequest("El platillo especificado no existe.");

                var producto = await _context.ProductosInventario.FindAsync(dto.ProductoId);
                if (producto == null)
                    return BadRequest("El producto/insumo especificado no existe.");

                if (!Enum.TryParse<UnidadMedida>(dto.UnidadMedida, true, out var unidadEnum))
                {
                    unidadEnum = UnidadMedida.Unidad;
                }

                var receta = new Receta
                {
                    PlatilloId = dto.PlatilloId,
                    ProductoId = dto.ProductoId,
                    CantidadRequerida = dto.CantidadRequerida,
                    UnidadMedida = unidadEnum,
                    CostoUnitario = dto.CostoUnitario ?? producto.PrecioCosto,
                    Opcional = dto.Opcional,
                    Notas = dto.Notas,
                    FechaCreacion = DateTime.UtcNow
                };

                _context.Recetas.Add(receta);
                await _context.SaveChangesAsync();

                var creado = new RecetaDto
                {
                    Id = receta.Id,
                    PlatilloId = platillo.Id,
                    PlatilloNombre = platillo.Nombre,
                    ProductoId = producto.Id,
                    ProductoNombre = producto.Nombre,
                    ProductoCodigo = producto.Codigo,
                    CantidadRequerida = receta.CantidadRequerida,
                    UnidadMedida = receta.UnidadMedida.ToString(),
                    CostoUnitario = receta.CostoUnitario,
                    Opcional = receta.Opcional,
                    Notas = receta.Notas
                };

                return CreatedAtAction(nameof(GetRecetasPorPlatillo), new { platilloId = receta.PlatilloId }, creado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al registrar ingrediente en receta");
                return StatusCode(500, new { message = "Error al registrar ingrediente en receta" });
            }
        }

        /// <summary>
        /// Actualiza un ingrediente de una receta
        /// </summary>
        [HttpPut("recetas/{id}")]
        public async Task<IActionResult> UpdateReceta(int id, [FromBody] ActualizarRecetaDto dto)
        {
            try
            {
                var receta = await _context.Recetas.FindAsync(id);
                if (receta == null)
                    return NotFound($"Ingrediente de receta con ID {id} no encontrado.");

                receta.CantidadRequerida = dto.CantidadRequerida;

                if (!string.IsNullOrEmpty(dto.UnidadMedida) && Enum.TryParse<UnidadMedida>(dto.UnidadMedida, true, out var unidadEnum))
                {
                    receta.UnidadMedida = unidadEnum;
                }

                if (dto.CostoUnitario.HasValue)
                    receta.CostoUnitario = dto.CostoUnitario.Value;

                if (dto.Opcional.HasValue)
                    receta.Opcional = dto.Opcional.Value;

                if (dto.Notas != null)
                    receta.Notas = dto.Notas;

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar receta");
                return StatusCode(500, new { message = "Error al actualizar receta" });
            }
        }

        /// <summary>
        /// Elimina un ingrediente de la receta de un platillo
        /// </summary>
        [HttpDelete("recetas/{id}")]
        public async Task<IActionResult> DeleteReceta(int id)
        {
            try
            {
                var receta = await _context.Recetas.FindAsync(id);
                if (receta == null)
                    return NotFound($"Ingrediente de receta con ID {id} no encontrado.");

                _context.Recetas.Remove(receta);
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar ingrediente de receta");
                return StatusCode(500, new { message = "Error al eliminar ingrediente de receta" });
            }
        }

        /// <summary>
        /// Fuerza la inicialización de recetas predeterminadas
        /// </summary>
        [HttpPost("recetas/inicializar")]
        public async Task<IActionResult> InicializarRecetas()
        {
            try
            {
                await _inventarioService.InicializarRecetasPredeterminadasAsync();
                return Ok(new { mensaje = "Recetas verificadas e inicializadas correctamente." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al inicializar recetas");
                return StatusCode(500, new { message = "Error al inicializar recetas" });
            }
        }
    }
}