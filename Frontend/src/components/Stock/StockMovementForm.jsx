import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import stockService from '../../services/stockService';

const StockMovementForm = ({ product, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    productId: product?.productId || '',
    warehouseId: 1,
    type: 'Entry',
    quantity: 0,
    destinationWarehouseId: null,
    reference: '',
    notes: '',
    unitCost: 0,
    expirationDate: '',
    batch: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const dataToSend = {
        ...formData,
        productId: parseInt(formData.productId),
        warehouseId: parseInt(formData.warehouseId),
        quantity: parseFloat(formData.quantity),
        destinationWarehouseId: formData.destinationWarehouseId ? parseInt(formData.destinationWarehouseId) : null,
        unitCost: formData.unitCost ? parseFloat(formData.unitCost) : null,
        expirationDate: formData.expirationDate || null,
        batch: formData.batch || null,
      };

      await stockService.registerMovement(dataToSend);
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar el movimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Registrar Movimiento de Stock</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger">{error}</div>
            )}

            {product && (
              <div className="alert alert-info">
                <strong>Producto:</strong> {product.productName} ({product.productCode})
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo de Movimiento *</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="form-control"
                  required
                >
                  <option value="Entry">Entrada</option>
                  <option value="Exit">Salida</option>
                  <option value="Transfer">Transferencia</option>
                  <option value="Adjustment">Ajuste</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Almacén *</label>
                <select
                  name="warehouseId"
                  value={formData.warehouseId}
                  onChange={handleChange}
                  className="form-control"
                  required
                >
                  <option value="1">Cocina Principal</option>
                  <option value="2">Bar</option>
                  <option value="3">Bodega de Bebidas</option>
                  <option value="4">Bodega Seca</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cantidad *</label>
                <input
                  type="number"
                  step="0.01"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Costo Unitario</label>
                <input
                  type="number"
                  step="0.01"
                  name="unitCost"
                  value={formData.unitCost}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>
            </div>

            {formData.type === 'Transfer' && (
              <div className="form-group">
                <label className="form-label">Almacén Destino *</label>
                <select
                  name="destinationWarehouseId"
                  value={formData.destinationWarehouseId || ''}
                  onChange={handleChange}
                  className="form-control"
                  required
                >
                  <option value="">Seleccione...</option>
                  <option value="1">Cocina Principal</option>
                  <option value="2">Bar</option>
                  <option value="3">Bodega de Bebidas</option>
                  <option value="4">Bodega Seca</option>
                </select>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Referencia</label>
                <input
                  type="text"
                  name="reference"
                  value={formData.reference}
                  onChange={handleChange}
                  className="form-control"
                  placeholder="Ej: Factura #123"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Lote</label>
                <input
                  type="text"
                  name="batch"
                  value={formData.batch}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha de Vencimiento</label>
              <input
                type="date"
                name="expirationDate"
                value={formData.expirationDate}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="form-control"
                rows="3"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Registrando...' : 'Registrar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockMovementForm;
