// src/components/menu/MiMesa.js
// Lo que el comensal ve de su mesa además de la carta: llamar al mesero y seguir sus pedidos.
// Todo sale de la API (useSeguimiento / useLlamada); el navegador solo recuerda la llave.
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, BellRing, Check, ChevronRight, CircleAlert, Receipt, WifiOff, X } from 'lucide-react';
import HojaInferior from './HojaInferior';
import { activarAvisos, necesitaInstalar, pushSoportado, unirse } from '../../services/clienteMesa';

const ease = [0.16, 1, 0.3, 1];
const formatear = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(valor);

/** Estados reales del pedido como los ve el comensal (EstadosPedido.ParaCliente en la API). */
export const ESTADOS_PEDIDO = {
  Recibido: { texto: 'Recibido', clase: 'bg-gray-100 text-gray-700' },
  EnPreparacion: { texto: 'En preparación', clase: 'bg-orange-100 text-orange-900' },
  Listo: { texto: 'Listo, va para tu mesa', clase: 'bg-green-50 text-green-800' },
  Entregado: { texto: 'En tu mesa', clase: 'bg-gray-100 text-gray-700' },
  Pagado: { texto: 'Pagado', clase: 'bg-green-50 text-green-800' },
  Cancelado: { texto: 'Cancelado', clase: 'bg-red-50 text-red-800' },
};

const ORDEN_RESUMEN = ['Listo', 'EnPreparacion', 'Recibido', 'Entregado'];

/** Estado que resume la visita: lo más urgente primero (listo > en preparación > recibido). */
export const estadoResumen = (pedidos = []) => {
  const estados = pedidos.map((p) => p.estado);
  return ORDEN_RESUMEN.find((e) => estados.includes(e)) ?? null;
};

export const TEXTO_LLAMADA = {
  enviando: 'Avisando al mesero…',
  Pendiente: 'Solicitud recibida. Un mesero vendrá a tu mesa.',
  EnCamino: 'Un mesero va para tu mesa.',
  Atendida: 'Listo, ya te atendieron.',
};

/** Botón de la cabecera. Se apaga mientras la llamada sigue viva para no repetirla. */
export function BotonLlamar({ llamada }) {
  const viva = ['enviando', 'Pendiente', 'EnCamino'].includes(llamada.estado);
  const Icono = viva ? BellRing : Bell;
  return (
    <button
      type="button"
      onClick={llamada.llamar}
      disabled={viva}
      aria-describedby="estado-llamada"
      className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-espresso px-4 text-[14px] font-bold text-white transition-transform active:scale-[0.98] disabled:bg-gray-100 disabled:text-espresso"
    >
      {llamada.estado === 'enviando' ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-espresso" aria-hidden="true" />
      ) : (
        <Icono size={18} aria-hidden="true" />
      )}
      {/* En el celular la etiqueta corta deja ver el número de la mesa; el nombre accesible es el completo. */}
      <span className="sr-only">{viva ? 'Mesero avisado' : 'Llamar al mesero'}</span>
      <span aria-hidden="true" className="sm:hidden">{viva ? 'Avisado' : 'Llamar'}</span>
      <span aria-hidden="true" className="hidden sm:inline">{viva ? 'Mesero avisado' : 'Llamar al mesero'}</span>
    </button>
  );
}

/** Franja con el resultado de la llamada; la lee el lector de pantalla al cambiar. */
export function AvisoLlamada({ llamada }) {
  const { estado, error, llamar, descartar } = llamada;
  useEffect(() => {
    if (estado !== 'Atendida') return undefined;
    const t = setTimeout(descartar, 6000);
    return () => clearTimeout(t);
  }, [estado, descartar]);

  const texto = estado === 'error' ? error : TEXTO_LLAMADA[estado];
  return (
    <div id="estado-llamada" role="status" aria-live="polite" className="px-4">
      <AnimatePresence initial={false}>
        {texto && (
          <motion.div
            key={estado}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className={`mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-semibold ${
              estado === 'error' ? 'bg-red-50 text-red-800' : estado === 'Atendida' ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-900'
            }`}
          >
            {estado === 'error' ? <CircleAlert size={18} aria-hidden="true" /> : estado === 'Atendida' ? <Check size={18} aria-hidden="true" /> : <BellRing size={18} aria-hidden="true" />}
            <span className="flex-1">{texto}</span>
            {estado === 'error' && (
              <button type="button" onClick={llamar} className="h-9 shrink-0 rounded-full bg-white px-3 text-[13px] font-bold text-red-800 ring-1 ring-red-200">
                Reintentar
              </button>
            )}
            {(estado === 'error' || estado === 'Atendida') && (
              <button type="button" onClick={descartar} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" aria-label="Cerrar aviso">
                <X size={16} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipEstado({ estado }) {
  const e = ESTADOS_PEDIDO[estado] ?? { texto: estado, clase: 'bg-gray-100 text-gray-700' };
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${e.clase}`}>{e.texto}</span>;
}

/** Tarjeta en la carta: resumen de la visita, unirse con código o cierre. */
export function ResumenMesa({ seguimiento, cierre, onAbrir, onCerrarCierre }) {
  if (cierre) {
    return (
      <div role="status" className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3 text-green-800">
        <Check size={20} aria-hidden="true" />
        <p className="flex-1 text-[14px] font-semibold">{cierre}</p>
        <button type="button" onClick={onCerrarCierre} className="grid h-9 w-9 place-items-center rounded-full" aria-label="Cerrar aviso">
          <X size={16} />
        </button>
      </div>
    );
  }

  if (seguimiento.estado === 'activo' && seguimiento.datos) {
    const { pedidos, cuenta } = seguimiento.datos;
    const vigentes = pedidos.filter((p) => p.estado !== 'Cancelado');
    const resumen = estadoResumen(vigentes);
    return (
      <button
        type="button"
        onClick={onAbrir}
        className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition-shadow hover:shadow-card"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-700" aria-hidden="true">
          <Receipt size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">Tu pedido</span>
          <span className="block truncate text-[13px] font-medium text-gray-500">
            {resumen ? ESTADOS_PEDIDO[resumen].texto : vigentes.length ? 'Pagado' : 'Sin pedidos'}
            {cuenta.pendiente > 0 && <> · por pagar <span className="tabular">{formatear(cuenta.pendiente)}</span></>}
          </span>
        </span>
        {seguimiento.error && <WifiOff size={16} className="text-gray-400" aria-label="Sin conexión" />}
        <ChevronRight size={20} className="text-gray-400" aria-hidden="true" />
      </button>
    );
  }

  if (seguimiento.estado === 'sin-llave') {
    return (
      <button type="button" onClick={onAbrir} className="mx-4 mt-3 min-h-[44px] text-left text-[14px] font-semibold text-orange-700 underline underline-offset-4">
        ¿Ya pidieron en esta mesa? Sigue el pedido con el código del mesero
      </button>
    );
  }
  return null;
}

function Unirse({ codigo, onLlave }) {
  const [pin, setPin] = useState('');
  const [estado, setEstado] = useState({ cargando: false, error: null });

  const enviar = async (e) => {
    e.preventDefault();
    if (pin.length !== 6 || estado.cargando) return;
    setEstado({ cargando: true, error: null });
    try {
      onLlave(await unirse(codigo, pin));
    } catch (err) {
      setEstado({ cargando: false, error: err.message });
    }
  };

  return (
    <form onSubmit={enviar} className="px-5 pb-6 pt-4">
      <h2 className="text-2xl font-extrabold tracking-[-0.02em]">Sigue el pedido de tu mesa</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
        Escribe el código de 6 dígitos que te da el mesero o quien pidió desde su teléfono.
      </p>
      <label htmlFor="pin-mesa" className="mt-5 block text-[14px] font-bold">Código de la mesa</label>
      <input
        id="pin-mesa"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-invalid={!!estado.error}
        aria-describedby={estado.error ? 'pin-error' : undefined}
        className="tabular mt-2 h-14 w-full rounded-2xl border border-gray-300 px-4 text-center text-[24px] font-extrabold tracking-[0.3em] focus:border-orange-500 focus:outline-none"
      />
      {estado.error && <p id="pin-error" role="alert" className="mt-3 text-[14px] font-medium text-red-700">{estado.error}</p>}
      <button
        type="submit"
        disabled={pin.length !== 6 || estado.cargando}
        className="mt-5 h-14 w-full rounded-full bg-espresso text-[15px] font-bold text-white disabled:bg-gray-300 disabled:text-gray-600"
      >
        {estado.cargando ? 'Buscando tu mesa…' : 'Ver el pedido'}
      </button>
    </form>
  );
}

const TEXTO_AVISOS = {
  activados: 'Te avisaremos en este teléfono cuando tu pedido cambie.',
  denegado: 'Los avisos están bloqueados en este navegador. Sigues viendo el estado aquí.',
  'no-disponible': 'Este navegador no permite avisos. Sigues viendo el estado aquí.',
  error: 'No pudimos activar los avisos. Sigues viendo el estado aquí.',
};

function Avisos({ codigo, llave, numeroMesa }) {
  const [estado, setEstado] = useState(() =>
    (typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'denegado' : null));
  const [cargando, setCargando] = useState(false);
  if (!pushSoportado() && !necesitaInstalar()) return null;

  if (necesitaInstalar()) {
    return (
      <p className="mt-6 rounded-2xl bg-gray-100 px-4 py-3 text-[13px] font-medium text-gray-600">
        Para recibir avisos en iPhone, toca Compartir y luego "Agregar a inicio", y abre Qpro desde ahí.
      </p>
    );
  }

  const activar = async () => {
    setCargando(true);
    try {
      const r = await activarAvisos(codigo, llave, numeroMesa);
      setEstado(r);
      if (r === 'activados') try { localStorage.setItem('qpro:avisos', '1'); } catch { /* sin almacenamiento */ }
    } catch {
      setEstado('error');
    } finally {
      setCargando(false);
    }
  };

  return estado ? (
    <p role="status" className="mt-6 rounded-2xl bg-gray-100 px-4 py-3 text-[13px] font-medium text-gray-600">{TEXTO_AVISOS[estado]}</p>
  ) : (
    <button
      type="button"
      onClick={activar}
      disabled={cargando}
      className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-gray-300 text-[14px] font-bold disabled:opacity-60"
    >
      <Bell size={18} aria-hidden="true" />
      {cargando ? 'Activando…' : 'Avisarme cuando cambie mi pedido'}
    </button>
  );
}

/** Hoja con el detalle de la visita: pedidos, cuenta, código para sumar a otro teléfono y avisos. */
export function HojaMesa({ abierta, onCerrar, codigo, llave, numeroMesa, seguimiento, onLlave }) {
  const datos = seguimiento.estado === 'activo' ? seguimiento.datos : null;
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo={`Mesa ${numeroMesa ?? ''}`}>
      {!datos ? (
        seguimiento.estado === 'cargando' ? (
          <div className="space-y-3 px-5 py-8" aria-busy="true" aria-label="Cargando tu pedido">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
          </div>
        ) : (
          <Unirse codigo={codigo} onLlave={onLlave} />
        )
      ) : (
        <div className="px-5 pb-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold tracking-[-0.02em]">Mesa {datos.mesaNumero}</h2>
            <button type="button" onClick={onCerrar} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100" aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
          {seguimiento.error && (
            <p role="alert" className="mt-3 flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-[13px] font-medium text-orange-900">
              <WifiOff size={16} aria-hidden="true" /> Sin conexión. Mostramos lo último que vimos y seguimos intentando.
            </p>
          )}

          {datos.pedidos.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-gray-500">Aún no hay pedidos en esta mesa.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {datos.pedidos.map((p, i) => (
                <li key={p.id} className={`rounded-2xl border border-gray-200 p-4 ${p.estado === 'Cancelado' ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-bold">
                      Pedido {i + 1}
                      <span className="tabular ml-2 font-medium text-gray-500">
                        {new Date(p.fecha).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </p>
                    <ChipEstado estado={p.estado} />
                  </div>
                  <ul className="mt-3 space-y-2">
                    {p.platos.map((d, j) => (
                      <li key={j} className="flex items-start justify-between gap-3 text-[14px]">
                        <span className="min-w-0">
                          <span className="tabular font-extrabold">{d.cantidad}×</span> {d.nombre}
                          {d.nota && <span className="block text-[13px] text-gray-500">{d.nota}</span>}
                        </span>
                        <span className={`tabular shrink-0 font-semibold ${d.pagado ? 'text-gray-400 line-through' : ''}`}>
                          {formatear(d.precio * d.cantidad)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}

          <dl className="mt-5 space-y-1.5 rounded-2xl bg-gray-50 p-4 text-[14px]">
            <div className="flex justify-between"><dt className="text-gray-600">Consumo</dt><dd className="tabular font-semibold">{formatear(datos.cuenta.total)}</dd></div>
            {datos.cuenta.pagado > 0 && (
              <div className="flex justify-between"><dt className="text-gray-600">Ya pagado</dt><dd className="tabular font-semibold">{formatear(datos.cuenta.pagado)}</dd></div>
            )}
            <div className="flex justify-between pt-1 text-[16px]"><dt className="font-bold">Por pagar</dt><dd className="tabular font-extrabold">{formatear(datos.cuenta.pendiente)}</dd></div>
          </dl>
          {datos.cuenta.pagoPorConfirmar ? (
            <p className="mt-3 text-[13px] font-medium text-gray-600">Tu pago está por confirmar en caja.</p>
          ) : datos.cuenta.cuentaPedida ? (
            <p className="mt-3 text-[13px] font-medium text-gray-600">Ya pediste la cuenta. El mesero te la trae.</p>
          ) : null}

          <p className="mt-6 text-[13px] text-gray-600">
            ¿Alguien más de la mesa quiere seguir el pedido? Dale este código:{' '}
            <span className="tabular text-[16px] font-extrabold tracking-[0.2em] text-espresso">{datos.pin}</span>
          </p>
          <Avisos codigo={codigo} llave={llave} numeroMesa={datos.mesaNumero} />
        </div>
      )}
    </HojaInferior>
  );
}
