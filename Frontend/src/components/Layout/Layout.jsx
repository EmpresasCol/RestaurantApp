import { Link, useLocation } from 'react-router-dom';
import {
  FaHome, FaBoxes, FaWarehouse, FaExchangeAlt,
  FaList, FaExclamationTriangle
} from 'react-icons/fa';
import './Layout.css';

const Layout = ({ children }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: <FaHome /> },
    { path: '/products', label: 'Productos', icon: <FaBoxes /> },
    { path: '/stock', label: 'Existencias', icon: <FaWarehouse /> },
    { path: '/movements', label: 'Movimientos', icon: <FaExchangeAlt /> },
    { path: '/categories', label: 'Categorías', icon: <FaList /> },
    { path: '/alerts', label: 'Alertas', icon: <FaExclamationTriangle /> },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>RestaurantApp</h1>
          <p>Sistema de Inventario</p>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <div className="container">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
