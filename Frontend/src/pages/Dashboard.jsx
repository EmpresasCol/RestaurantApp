import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBoxes, FaWarehouse, FaExclamationTriangle,
  FaArrowDown, FaArrowUp, FaChartLine
} from 'react-icons/fa';
import { format } from 'date-fns';
import productService from '../services/productService';
import stockService from '../services/stockService';
import './Pages.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    totalAlerts: 0,
    recentMovements: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Cargar productos con stock bajo
      const lowStock = await productService.getLowStockProducts();
      setLowStockProducts(lowStock.slice(0, 5));

      // Cargar alertas
      const alertsData = await stockService.getStockAlerts();
      setAlerts(alertsData.slice(0, 5));

      // Cargar movimientos recientes
      const movements = await stockService.getMovementHistory();
      setRecentMovements(movements.slice(0, 5));

      // Cargar todos los productos para estadísticas
      const allProducts = await productService.getAllProducts();

      setStats({
        totalProducts: allProducts.length,
        lowStockProducts: lowStock.length,
        totalAlerts: alertsData.length,
        recentMovements: movements.length,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMovementIcon = (type) => {
    return type === 'Entry' ? <FaArrowDown /> : <FaArrowUp />;
  };

  const getMovementTypeName = (type) => {
    const types = {
      Entry: 'Entrada',
      Exit: 'Salida',
      Transfer: 'Transferencia',
      Adjustment: 'Ajuste'
    };
    return types[type] || type;
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard de Inventario</h1>
          <p className="page-description">Resumen general del sistema</p>
        </div>
      </div>

      {/* Estadísticas principales */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon primary">
            <FaBoxes />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total de Productos</div>
            <div className="stat-value">{stats.totalProducts}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <FaWarehouse />
          </div>
          <div className="stat-content">
            <div className="stat-label">Productos con Stock Bajo</div>
            <div className="stat-value">{stats.lowStockProducts}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon danger">
            <FaExclamationTriangle />
          </div>
          <div className="stat-content">
            <div className="stat-label">Alertas Activas</div>
            <div className="stat-value">{stats.totalAlerts}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <FaChartLine />
          </div>
          <div className="stat-content">
            <div className="stat-label">Movimientos Registrados</div>
            <div className="stat-value">{stats.recentMovements}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2">
        {/* Productos con Stock Bajo */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              Productos con Stock Bajo
            </h2>
            <Link to="/products" className="btn btn-sm btn-primary">
              Ver Todos
            </Link>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map(product => (
                  <tr key={product.id}>
                    <td>
                      <div>
                        <strong>{product.name}</strong>
                        <br />
                        <small style={{ color: 'var(--text-light)' }}>{product.code}</small>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-danger">
                        {product.totalStock} {product.unitOfMeasureAbbreviation}
                      </span>
                    </td>
                    <td>{product.minimumStock} {product.unitOfMeasureAbbreviation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lowStockProducts.length === 0 && (
              <div className="empty-state">
                <p>No hay productos con stock bajo</p>
              </div>
            )}
          </div>
        </div>

        {/* Alertas Recientes */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              Alertas Recientes
            </h2>
            <Link to="/alerts" className="btn btn-sm btn-warning">
              Ver Todas
            </Link>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Producto</th>
                  <th>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert, index) => (
                  <tr key={index}>
                    <td>
                      <span className={`badge ${
                        alert.alertType === 'LowStock' ? 'badge-warning' :
                        alert.alertType === 'Expiring' ? 'badge-info' : 'badge-danger'
                      }`}>
                        {alert.alertType === 'LowStock' ? 'Stock Bajo' :
                         alert.alertType === 'Expiring' ? 'Por Vencer' : 'Vencido'}
                      </span>
                    </td>
                    <td>
                      <strong>{alert.productName}</strong>
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>
                      {alert.alertType === 'LowStock'
                        ? `Stock: ${alert.currentStock}`
                        : alert.daysUntilExpiration !== null
                          ? `${Math.abs(alert.daysUntilExpiration)} días`
                          : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {alerts.length === 0 && (
              <div className="empty-state">
                <p>No hay alertas activas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Movimientos Recientes */}
      <div className="card mt-4">
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            Movimientos Recientes
          </h2>
          <Link to="/movements" className="btn btn-sm btn-primary">
            Ver Historial Completo
          </Link>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Almacén</th>
              </tr>
            </thead>
            <tbody>
              {recentMovements.map(movement => (
                <tr key={movement.id}>
                  <td>{format(new Date(movement.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                  <td>
                    <span className={`badge ${
                      movement.type === 'Entry' ? 'badge-success' : 'badge-danger'
                    }`}>
                      {getMovementIcon(movement.type)}
                      {' '}
                      {getMovementTypeName(movement.type)}
                    </span>
                  </td>
                  <td>
                    <strong>{movement.productName}</strong>
                  </td>
                  <td>
                    <strong>
                      {movement.type === 'Exit' ? '-' : '+'}
                      {movement.quantity} {movement.unitOfMeasure}
                    </strong>
                  </td>
                  <td>{movement.warehouseName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentMovements.length === 0 && (
            <div className="empty-state">
              <p>No hay movimientos recientes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
