import {
  CONFIG_FABRICA, COLOR_ACCION, COLOR_MARCA, PALETAS, accionLegible, conteosLegibles, aplicarMarca, contraste, enlaceInstagram, enlaceWhatsapp,
  errorConfiguracion, escala, marcaActual, normalizar, tasaPropina, variablesCss
} from '../utils/marca';
import { htmlFactura } from '../utils/recibo';

describe('marca del restaurante', () => {
  afterEach(() => aplicarMarca(CONFIG_FABRICA));

  test('el caramelo de fábrica conserva su escala afinada a mano', () => {
    const e = escala(COLOR_MARCA);
    expect(e[500]).toBe('#C8955E');
    expect(e[100]).toBe('#F5E9DA');
    expect(e[950]).toBe('#2A1D15');
  });

  test('un color nuevo genera tonos más claros y más oscuros con el elegido en el 500', () => {
    const e = escala('#2F8F9D');
    expect(e[500]).toBe('#2F8F9D');
    expect(contraste(e[50], '#FFFFFF')).toBeLessThan(1.15);
    expect(contraste(e[900], '#FFFFFF')).toBeGreaterThan(7);
  });

  test('el contraste sigue WCAG y todas las paletas dejan leer el texto blanco', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    PALETAS.forEach((p) => {
      expect(accionLegible(p.accion)).toBe(true);
      expect(conteosLegibles(p.marca, p.accion)).toBe(true);
    });
    expect(accionLegible('#F5E9DA')).toBe(false);
  });

  test('normalizar completa lo que falta y descarta colores ilegibles', () => {
    const c = normalizar({ nombre: 'La Fonda', colorAccion: '#FFFFFF', logo: null, propinaSugerida: 0 });
    expect(c.nombre).toBe('La Fonda');
    expect(c.colorAccion).toBe(COLOR_ACCION);
    expect(c.minutosUrgente).toBe(15);
    expect(c.propinaSugerida).toBe(0);
    expect(normalizar({ instagram: '@lafonda' }).instagram).toBe('lafonda');
  });

  test('las variables CSS van en canales r g b', () => {
    const v = variablesCss({ colorMarca: '#2F8F9D', colorAccion: '#123B47' });
    expect(v['--qp-marca-500']).toBe('47 143 157');
    expect(v['--qp-accion']).toBe('18 59 71');
  });

  test('aplicar la marca cambia el título, los colores y la copia para las tirillas', () => {
    aplicarMarca({ nombre: 'La Fonda', colorAccion: '#123B47', propinaSugerida: 12 });
    expect(document.title).toBe('La Fonda');
    expect(document.documentElement.style.getPropertyValue('--qp-accion')).toBe('18 59 71');
    expect(marcaActual().nombre).toBe('La Fonda');
    expect(tasaPropina()).toBeCloseTo(0.12);
  });

  test('validación igual a la de la API', () => {
    const base = { ...CONFIG_FABRICA };
    expect(errorConfiguracion(base)).toBeNull();
    expect(errorConfiguracion({ ...base, nombre: '  ' })).toMatch(/nombre/);
    expect(errorConfiguracion({ ...base, colorAccion: '#EEEEEE' })).toMatch(/muy claro/);
    expect(errorConfiguracion({ ...base, minutosAlerta: 20, minutosUrgente: 20 })).toMatch(/urgente/);
    expect(errorConfiguracion({ ...base, propinaSugerida: 31 })).toMatch(/propina/);
    expect(errorConfiguracion({ ...base, whatsapp: '123' })).toMatch(/WhatsApp/);
  });

  test('enlaces de WhatsApp (Colombia por defecto) e Instagram', () => {
    expect(enlaceWhatsapp('300 123 4567')).toBe('https://wa.me/573001234567');
    expect(enlaceWhatsapp('14155550100')).toBe('https://wa.me/14155550100');
    expect(enlaceWhatsapp('')).toBeNull();
    expect(enlaceInstagram('@lafonda')).toBe('https://instagram.com/lafonda');
  });

  test('la factura lleva el nombre, el pie y el Instagram del restaurante, escapados', () => {
    const f = { numeroFactura: 'FV-1', fechaEmision: '2026-11-26T12:00:00Z', nombreCliente: 'Ana', nitCliente: '222222222222', items: [], subtotal: 0, total: 0 };
    const html = htmlFactura(f, {}, null, normalizar({ nombre: 'Fonda <Ana>', pieFactura: 'Vuelve pronto', instagram: 'lafonda' }));
    expect(html).toContain('<h1>Fonda &lt;Ana&gt;</h1>');
    expect(html).toContain('Vuelve pronto');
    expect(html).toContain('@lafonda');
    expect(html).not.toContain('Gracias por su visita');
  });
});
