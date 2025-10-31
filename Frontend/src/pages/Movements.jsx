import { useState, useEffect } from 'react';
import { FaArrowDown, FaArrowUp, FaExchangeAlt, FaCog } from 'react-icons/fa';
import { format } from 'date-fns';
import stockService from '../services/stockService';
import './Pages.css';

const Movements = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    loadMovements();
  }, []);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const data = await stockService.getMovementHistory();
      setMovements(data);
    } catch (error) {
      console.error('Error loading movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMovementIcon = (type) => {
    switch (type) {
      case 'Entry':
        return <FaArrowDown style={{ color: 'var(--secondary-color)' }} />;
      case 'Exit':
        return <FaArrowUp style={{ color: 'var(--danger-color)' }} />;
      case 'Transfer':
        return <FaExchangeAlt style={{ color: 'var(--info-color)' }} />;
      case 'Adjustment':
        return <FaCog style={{ color: 'var(--warning-color)' }} />;
      default:
        return null;
    }
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

  const getMovementBadgeClass = (type) => {
    switch (type) {
      case 'Entry':
        return 'badge-success';
      case 'Exit':
        return 'badge-danger';
      case 'Transfer':
        return 'badge-info';
      case 'Adjustment':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  };

  const filteredMovements = movements.filter(m =>
    !filterType || m.type === filterType
  );

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Movimientos de Inventario</h1>
          <p className="page-description">Historial de entradas, salidas y transferencias</p>
        </div>
      </div>

      <div className="card mb-4">
        <div className="filters">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="">Todos los movimientos</option>
            <option value="Entry">Entradas</option>
            <option value="Exit">Salidas</option>
            <option value="Transfer">Transferencias</option>
            <option value="Adjustment">Ajustes</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Almacén</th>
                <th>Cantidad</th>
                <th>Costo</th>
                <th>Referencia</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map(movement => (
                <tr key={movement.id}>
                  <td>{format(new Date(movement.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                  <td>
                    <span className={`badge ${getMovementBadgeClass(movement.type)}`}>
                      {getMovementIcon(movement.type)}
                      {' '}
                      {getMovementTypeName(movement.type)}
                    </span>
                  </td>
                  <td>
                    <div>
                      <strong>{movement.productName}</strong>
                      <br />
                      <small style={{ color: 'var(--text-light)' }}>{movement.productCode}</small>
                    </div>
                  </td>
                  <td>{movement.warehouseName}</td>
                  <td>
                    <strong>
                      {movement.type === 'Exit' ? '-' : '+'}
                      {movement.quantity} {movement.unitOfMeasure}
                    </strong>
                  </td>
                  <td>
                    {movement.totalCost
                      ? `$${movement.totalCost.toFixed(2)}`
                      : '-'}
                  </td>
                  <td>{movement.reference || '-'}</td>
                  <td>{movement.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMovements.length === 0 && (
            <div className="empty-state">
              <p>No hay movimientos registrados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Movements;
