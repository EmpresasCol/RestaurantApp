import { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import productService from '../../services/productService';

const ProductForm = ({ product, categories, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    type: 'Ingredient',
    categoryId: '',
    unitOfMeasureId: 1,
    supplierId: null,
    purchasePrice: 0,
    salePrice: null,
    hasExpirationDate: false,
    shelfLifeDays: null,
    minimumStock: null,
    maximumStock: null,
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      setFormData({
        code: product.code,
        name: product.name,
        description: product.description || '',
        type: product.type,
        categoryId: product.categoryId,
        unitOfMeasureId: product.unitOfMeasureId,
        supplierId: product.supplierId,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        hasExpirationDate: product.hasExpirationDate,
        shelfLifeDays: product.shelfLifeDays,
        minimumStock: product.minimumStock,
        maximumStock: product.maximumStock,
        isActive: product.isActive,
      });
    }
  }, [product]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Convertir valores numéricos
      const dataToSend = {
        ...formData,
        categoryId: parseInt(formData.categoryId),
        unitOfMeasureId: parseInt(formData.unitOfMeasureId),
        supplierId: formData.supplierId ? parseInt(formData.supplierId) : null,
        purchasePrice: parseFloat(formData.purchasePrice),
        salePrice: formData.salePrice ? parseFloat(formData.salePrice) : null,
        shelfLifeDays: formData.shelfLifeDays ? parseInt(formData.shelfLifeDays) : null,
        minimumStock: formData.minimumStock ? parseFloat(formData.minimumStock) : null,
        maximumStock: formData.maximumStock ? parseFloat(formData.maximumStock) : null,
      };

      if (product) {
        await productService.updateProduct(product.id, dataToSend);
      } else {
        await productService.createProduct(dataToSend);
      }

      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger">{error}</div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Código *</label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descripción</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-control"
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo *</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="form-control"
                  required
                >
                  <option value="Ingredient">Ingrediente</option>
                  <option value="Beverage">Bebida</option>
                  <option value="CleaningSupply">Limpieza</option>
                  <option value="FinishedProduct">Producto Terminado</option>
                  <option value="Other">Otro</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleChange}
                  className="form-control"
                  required
                >
                  <option value="">Seleccione...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Precio de Compra *</label>
                <input
                  type="number"
                  step="0.01"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Precio de Venta</label>
                <input
                  type="number"
                  step="0.01"
                  name="salePrice"
                  value={formData.salePrice || ''}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Stock Mínimo</label>
                <input
                  type="number"
                  step="0.01"
                  name="minimumStock"
                  value={formData.minimumStock || ''}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Stock Máximo</label>
                <input
                  type="number"
                  step="0.01"
                  name="maximumStock"
                  value={formData.maximumStock || ''}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group">
              <div className="form-check">
                <input
                  type="checkbox"
                  name="hasExpirationDate"
                  checked={formData.hasExpirationDate}
                  onChange={handleChange}
                  id="hasExpirationDate"
                />
                <label htmlFor="hasExpirationDate">Tiene fecha de caducidad</label>
              </div>
            </div>

            {formData.hasExpirationDate && (
              <div className="form-group">
                <label className="form-label">Vida útil (días)</label>
                <input
                  type="number"
                  name="shelfLifeDays"
                  value={formData.shelfLifeDays || ''}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>
            )}

            {product && (
              <div className="form-group">
                <div className="form-check">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    id="isActive"
                  />
                  <label htmlFor="isActive">Activo</label>
                </div>
              </div>
            )}
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
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
