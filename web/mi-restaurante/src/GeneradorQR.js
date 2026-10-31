// Códigos QR de las mesas: el administrador fija cuántas mesas tiene el salón y obtiene un
// código por mesa, con el número dentro del QR. El código lleva ?mesa=<id>&numero=<n>.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, ExternalLink, Minus, Plus, Printer, QrCode } from 'lucide-react';
import { fijarCantidadMesas, getMesas } from './services/api';
import { Boton, Cargando, useAviso, Vacio } from './components/inventario/ui';
import { cambioMesas, insigniaMesa, limitarMesas, MAXIMO_MESAS, urlMesa } from './utils/administracion';
import logo from './components/logo.jpg';

const ESPRESSO = '#2A1D15';
const porNumero = (mesas) => [...mesas].sort((a, b) => a.numero - b.numero);

const descargarPNG = async (nodo, nombre) => {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(nodo, { scale: 3, backgroundColor: '#ffffff', logging: false });
  const enlace = document.createElement('a');
  enlace.download = nombre;
  enlace.href = canvas.toDataURL('image/png');
  enlace.click();
};

/** Tarjeta imprimible de una mesa: el único diseño de QR de Qpro. */
const TarjetaQR = React.forwardRef(function TarjetaQR({ mesa, url }, ref) {
  return (
    <article ref={ref} className="qp-tarjeta-qr w-[300px] rounded-[24px] border border-gray-200 bg-white p-6 text-center">
      <div className="flex items-center justify-center gap-2">
        <img src={logo} alt="" className="h-8 w-8 rounded-[10px] object-contain ring-1 ring-gray-200" />
        <span className="text-[17px] font-extrabold tracking-[-0.01em] text-espresso">Qpro</span>
      </div>
      <p className="mt-5 text-[15px] font-semibold text-gray-500">Mesa</p>
      <p className="tabular text-[56px] font-extrabold leading-none tracking-[-0.03em] text-espresso">{mesa.numero}</p>
      <div className="mx-auto mt-5 w-fit rounded-[16px] bg-white p-2 ring-1 ring-gray-200">
        <QRCodeSVG
          value={url}
          size={208}
          level="H"
          fgColor={ESPRESSO}
          bgColor="#FFFFFF"
          title={`Código QR de la mesa ${mesa.numero}`}
          imageSettings={{ src: insigniaMesa(mesa.numero), width: 48, height: 48, excavate: true }}
        />
      </div>
      <p className="mx-auto mt-5 max-w-[220px] text-[14px] font-medium leading-snug text-gray-600">
        Escanea con la cámara, mira la carta y pide desde tu mesa.
      </p>
    </article>
  );
});

function ControlMesas({ mesas, onGuardar, guardando }) {
  const numeros = mesas.map((m) => m.numero);
  const [texto, setTexto] = useState(String(mesas.length || 1));
  useEffect(() => setTexto(String(mesas.length || 1)), [mesas.length]);

  const cantidad = limitarMesas(texto);
  const { crear, retirar } = cambioMesas(numeros, cantidad);
  const hayCambio = crear > 0 || retirar.length > 0;
  const mover = (d) => setTexto(String(limitarMesas(cantidad + d)));

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5" aria-label="Número de mesas">
      <div>
        <label htmlFor="cantidad-mesas" className="block text-[15px] font-bold text-espresso">Mesas del salón</label>
        <p className="tabular text-[13px] text-gray-500">
          {hayCambio
            ? [crear > 0 && `Se crean ${crear}`, retirar.length > 0 && `se retiran la${retirar.length > 1 ? 's' : ''} ${retirar.join(', ')}`].filter(Boolean).join(' y ')
            : `Hay ${mesas.length} mesa${mesas.length === 1 ? '' : 's'} con su código`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button" onClick={() => mover(-1)} disabled={cantidad <= 1}
          className="grid h-11 w-11 place-items-center rounded-full border border-gray-300 bg-white text-espresso transition-colors hover:bg-gray-50 disabled:text-gray-300"
          aria-label="Una mesa menos"
        >
          <Minus size={18} />
        </button>
        <input
          id="cantidad-mesas" type="number" inputMode="numeric" min="1" max={MAXIMO_MESAS}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => setTexto(String(cantidad))}
          onKeyDown={(e) => e.key === 'Enter' && hayCambio && onGuardar(cantidad)}
          className="tabular h-11 w-20 rounded-xl border border-gray-300 bg-white text-center text-[18px] font-extrabold text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
        />
        <button
          type="button" onClick={() => mover(1)} disabled={cantidad >= MAXIMO_MESAS}
          className="grid h-11 w-11 place-items-center rounded-full border border-gray-300 bg-white text-espresso transition-colors hover:bg-gray-50 disabled:text-gray-300"
          aria-label="Una mesa más"
        >
          <Plus size={18} />
        </button>
      </div>
      <Boton onClick={() => onGuardar(cantidad)} disabled={!hayCambio || guardando}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </Boton>
      {hayCambio && (
        <Boton variante="fantasma" onClick={() => setTexto(String(mesas.length || 1))}>Deshacer</Boton>
      )}
    </section>
  );
}

function GeneradorQR() {
  const base = window.location.origin + window.location.pathname;
  const [mesas, setMesas] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const tarjetas = useRef({});
  const [aviso, mostrar] = useAviso();

  const cargar = useCallback(async () => {
    try {
      setMesas(porNumero(await getMesas()));
    } catch {
      setMesas((m) => m ?? []);
      mostrar('No se pudieron cargar las mesas', 'error');
    }
  }, [mostrar]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (cantidad) => {
    setGuardando(true);
    try {
      setMesas(porNumero(await fijarCantidadMesas(cantidad)));
      mostrar(`Listo: el salón tiene ${cantidad} mesa${cantidad === 1 ? '' : 's'}`);
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const descargar = async (mesa) => {
    try {
      await descargarPNG(tarjetas.current[mesa.id], `qpro-mesa-${mesa.numero}.png`);
    } catch {
      mostrar(`No se pudo descargar la mesa ${mesa.numero}`, 'error');
    }
  };

  const descargarTodos = async () => {
    setDescargando(true);
    for (const mesa of mesas) {
      await descargar(mesa);
      await new Promise((r) => setTimeout(r, 400)); // el navegador bloquea descargas seguidas sin pausa
    }
    setDescargando(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6 lg:py-8">
        <header className="qp-no-print mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">Códigos QR</h1>
            <p className="mt-1 max-w-[65ch] text-[15px] text-gray-500">
              Un código por mesa. El comensal lo escanea, ve la carta y su pedido llega a cocina con el número de su mesa.
            </p>
          </div>
          {mesas?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" onClick={descargarTodos} disabled={descargando}>
                <Download size={17} aria-hidden="true" />{descargando ? 'Descargando…' : 'Descargar todos'}
              </Boton>
              <Boton variante="secundario" onClick={() => window.print()}>
                <Printer size={17} aria-hidden="true" />Imprimir
              </Boton>
            </div>
          )}
        </header>

        {!mesas ? (
          <Cargando filas={2} />
        ) : (
          <>
            <div className="qp-no-print mb-6">
              <ControlMesas mesas={mesas} onGuardar={guardar} guardando={guardando} />
            </div>

            {mesas.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white">
                <Vacio icono={QrCode} titulo="Aún no hay mesas" texto="Elige cuántas mesas tiene el salón y guarda: cada una tendrá su código." />
              </div>
            ) : (
              <ul className="qp-hoja-qr grid justify-center gap-6 [grid-template-columns:repeat(auto-fill,300px)]">
                {mesas.map((mesa) => {
                  const url = urlMesa(base, mesa);
                  return (
                    <li key={mesa.id} className="qp-celda-qr">
                      <TarjetaQR ref={(n) => { tarjetas.current[mesa.id] = n; }} mesa={mesa} url={url} />
                      <div className="qp-no-print mt-2 flex justify-center gap-1">
                        <Boton variante="fantasma" tamano="sm" onClick={() => window.open(url, '_blank', 'noopener')}>
                          <ExternalLink size={15} aria-hidden="true" />Probar
                        </Boton>
                        <Boton variante="fantasma" tamano="sm" onClick={() => descargar(mesa)} aria-label={`Descargar el QR de la mesa ${mesa.numero}`}>
                          <Download size={15} aria-hidden="true" />Descargar
                        </Boton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>
      {aviso}

      {/* Al imprimir solo salen las tarjetas, dos por fila en A4. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden; }
          .qp-hoja-qr, .qp-hoja-qr * { visibility: visible; }
          .qp-no-print { display: none !important; }
          .qp-hoja-qr { position: absolute; inset: 0 auto auto 0; width: 100%; grid-template-columns: repeat(2, 300px); gap: 10mm; }
          .qp-celda-qr { break-inside: avoid; }
          .qp-tarjeta-qr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

export default GeneradorQR;
