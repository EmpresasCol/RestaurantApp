import { useState, useEffect } from 'react';
import { FaWarehouse, FaPlus } from 'react-icons/fa';
import stockService from '../services/stockService';
import StockMovementForm from '../components/Stock/StockMovementForm';
import './Pages.css';

const Stock = () => {
  const [stockSummary, setStockSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    loadStockSummary();
  }, []);

  const loadStockSummary = async () => {
    try {
      setLoading(true);
      const data = await stockService.getProductStockSummary();
      setStockSummary(data);
    } catch (error) {
      console.error('Error loading stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMovement = (product) => {
    setSelectedProduct(product);
    setShowMovementForm(true);
  };

  const handleCloseForm = () => {
    setShowMovementForm(false);
    setSelectedProduct(null);
  };

  const handleSave = () => {
    loadStockSummary();
    handleCloseForm();
  };

  const getStockStatus = (product) => {
    if (!product.minimumStock) return { class: 'badge-info', text: 'Normal' };
    if (product.totalQuantity <= product.minimumStock) return { class: 'badge-danger', text: 'Bajo' };
    if (product.totalQuantity <= product.minimumStock * 1.5) return { class: 'badge-warning', text: 'Medio' };
    return { class: 'badge-success', text: 'Óptimo' };
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Control de Existencias</h1>
          <p className="page-description">Visualización en tiempo real del inventario</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Stock Total</th>
                <th>Unidad</th>
                <th>Stock Mínimo</th>
                <th>Stock Máximo</th>
                <th>Estado</th>
                <th>Almacenes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {stockSummary.map(item => {
                const status = getStockStatus(item);
                return (
                  <tr key={item.productId}>
                    <td><strong>{item.productCode}</strong></td>
                    <td>{item.productName}</td>
                    <td>{item.categoryName}</td>
                    <td>
                      <strong>{item.totalQuantity} {item.unitOfMeasure}</strong>
                    </td>
                    <td>{item.unitOfMeasure}</td>
                    <td>{item.minimumStock || '-'}</td>
                    <td>{item.maximumStock || '-'}</td>
                    <td>
                      <span className={`badge ${status.class}`}>
                        {status.text}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.875rem' }}>
                        {item.stockByWarehouse.map(w => (
                          <div key={w.warehouseId}>
                            <FaWarehouse style={{ marginRight: '0.25rem' }} />
                            {w.warehouseName}: {w.quantity} {item.unitOfMeasure}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAddMovement(item)}
                      >
                        <FaPlus /> Movimiento
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {stockSummary.length === 0 && (
            <div className="empty-state">
              <p>No hay stock registrado</p>
            </div>
          )}
        </div>
      </div>

      {showMovementForm && (
        <StockMovementForm
          product={selectedProduct}
          onClose={handleCloseForm}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default Stock;
