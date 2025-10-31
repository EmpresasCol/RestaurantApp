import { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaExclamationCircle, FaTimesCircle } from 'react-icons/fa';
import { format } from 'date-fns';
import stockService from '../services/stockService';
import './Pages.css';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await stockService.getStockAlerts();
      setAlerts(data);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'LowStock':
        return <FaExclamationTriangle />;
      case 'Expiring':
        return <FaExclamationCircle />;
      case 'Expired':
        return <FaTimesCircle />;
      default:
        return <FaExclamationTriangle />;
    }
  };

  const getAlertBadgeClass = (type) => {
    switch (type) {
      case 'LowStock':
        return 'badge-warning';
      case 'Expiring':
        return 'badge-info';
      case 'Expired':
        return 'badge-danger';
      default:
        return 'badge-warning';
    }
  };

  const getAlertTypeName = (type) => {
    const types = {
      LowStock: 'Stock Bajo',
      Expiring: 'Por Vencer',
      Expired: 'Vencido'
    };
    return types[type] || type;
  };

  const getAlertMessage = (alert) => {
    if (alert.alertType === 'LowStock') {
      return `Stock actual: ${alert.currentStock}. Mínimo: ${alert.minimumStock}`;
    }
    if (alert.alertType === 'Expiring') {
      return `Vence en ${alert.daysUntilExpiration} días`;
    }
    if (alert.alertType === 'Expired') {
      return `Venció hace ${Math.abs(alert.daysUntilExpiration)} días`;
    }
    return '';
  };

  const filteredAlerts = alerts.filter(alert =>
    !filterType || alert.alertType === filterType
  );

  const alertCounts = {
    total: alerts.length,
    lowStock: alerts.filter(a => a.alertType === 'LowStock').length,
    expiring: alerts.filter(a => a.alertType === 'Expiring').length,
    expired: alerts.filter(a => a.alertType === 'Expired').length,
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alertas de Inventario</h1>
          <p className="page-description">Productos con stock bajo o próximos a vencer</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon warning">
            <FaExclamationTriangle />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total de Alertas</div>
            <div className="stat-value">{alertCounts.total}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <FaExclamationTriangle />
          </div>
          <div className="stat-content">
            <div className="stat-label">Stock Bajo</div>
            <div className="stat-value">{alertCounts.lowStock}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon primary">
            <FaExclamationCircle />
          </div>
          <div className="stat-content">
            <div className="stat-label">Por Vencer</div>
            <div className="stat-value">{alertCounts.expiring}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon danger">
            <FaTimesCircle />
          </div>
          <div className="stat-content">
            <div className="stat-label">Vencidos</div>
            <div className="stat-value">{alertCounts.expired}</div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="filters">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="">Todas las alertas</option>
            <option value="LowStock">Stock Bajo</option>
            <option value="Expiring">Por Vencer</option>
            <option value="Expired">Vencidos</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Almacén</th>
                <th>Stock Actual</th>
                <th>Detalles</th>
                <th>Fecha Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert, index) => (
                <tr key={index}>
                  <td>
                    <span className={`badge ${getAlertBadgeClass(alert.alertType)}`}>
                      {getAlertIcon(alert.alertType)}
                      {' '}
                      {getAlertTypeName(alert.alertType)}
                    </span>
                  </td>
                  <td>
                    <div>
                      <strong>{alert.productName}</strong>
                      <br />
                      <small style={{ color: 'var(--text-light)' }}>{alert.productCode}</small>
                    </div>
                  </td>
                  <td>{alert.warehouseName}</td>
                  <td><strong>{alert.currentStock}</strong></td>
                  <td>{getAlertMessage(alert)}</td>
                  <td>
                    {alert.expirationDate
                      ? format(new Date(alert.expirationDate), 'dd/MM/yyyy')
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAlerts.length === 0 && (
            <div className="empty-state">
              <p>No hay alertas activas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Alerts;
