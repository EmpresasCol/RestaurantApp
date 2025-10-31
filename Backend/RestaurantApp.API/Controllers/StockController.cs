using Microsoft.AspNetCore.Mvc;
using RestaurantApp.API.DTOs;
using RestaurantApp.API.Services;

namespace RestaurantApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StockController : ControllerBase
{
    private readonly IStockService _stockService;

    public StockController(IStockService stockService)
    {
        _stockService = stockService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StockDto>>> GetAllStock()
    {
        var stock = await _stockService.GetAllStockAsync();
        return Ok(stock);
    }

    [HttpGet("summary")]
    public async Task<ActionResult<IEnumerable<ProductStockDto>>> GetProductStockSummary()
    {
        var summary = await _stockService.GetProductStockSummaryAsync();
        return Ok(summary);
    }

    [HttpGet("product/{productId}")]
    public async Task<ActionResult<ProductStockDto>> GetProductStock(int productId)
    {
        var stock = await _stockService.GetProductStockByIdAsync(productId);
        if (stock == null)
            return NotFound();

        return Ok(stock);
    }

    [HttpGet("warehouse/{warehouseId}")]
    public async Task<ActionResult<IEnumerable<StockDto>>> GetStockByWarehouse(int warehouseId)
    {
        var stock = await _stockService.GetStockByWarehouseAsync(warehouseId);
        return Ok(stock);
    }

    [HttpGet("alerts")]
    public async Task<ActionResult<IEnumerable<StockAlertDto>>> GetStockAlerts()
    {
        var alerts = await _stockService.GetStockAlertsAsync();
        return Ok(alerts);
    }

    [HttpPost("movement")]
    public async Task<ActionResult<StockMovementDto>> RegisterMovement([FromBody] CreateStockMovementDto movementDto)
    {
        try
        {
            var movement = await _stockService.RegisterMovementAsync(movementDto);
            return Ok(movement);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("adjust")]
    public async Task<ActionResult> AdjustStock([FromBody] StockAdjustmentDto adjustmentDto)
    {
        try
        {
            await _stockService.AdjustStockAsync(adjustmentDto);
            return Ok(new { message = "Stock ajustado correctamente" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("movements")]
    public async Task<ActionResult<IEnumerable<StockMovementDto>>> GetMovementHistory(
        [FromQuery] int? productId = null,
        [FromQuery] int? warehouseId = null)
    {
        var movements = await _stockService.GetMovementHistoryAsync(productId, warehouseId);
        return Ok(movements);
    }
}
