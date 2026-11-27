// Configuración del restaurante (solo administrador): marca, carta del comensal, facturas,
// operación y datos fiscales. Lo guardado se ve al instante en la web, el menú QR, las tirillas
// y la app móvil (tema "configuracion" por tiempo real).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check, ChefHat, Clock, ImagePlus, Landmark, Palette, Receipt, RotateCcw, Settings2, Store, TriangleAlert, UtensilsCrossed
} from 'lucide-react';
import * as api from './services/api';
import { useMarca } from './context/MarcaContext';
import { Boton, Campo, Chip, ease, useAviso } from './components/inventario/ui';
import DatosFiscales from './components/caja/DatosFiscales';
import { reducirLogo } from './utils/imagenes';
import { htmlFactura } from './utils/recibo';
import { pesos, propinaSugerida } from './utils/caja';
import {
  CONFIG_FABRICA, CONTRASTE_MINIMO, PALETAS, accionLegible, contraste, errorConfiguracion, esHex, normalizar, paraGuardar, tasaPropina, variablesCss
} from './utils/marca';
import logoQpro from './components/logo.jpg';

const PESTANAS = [
  { id: 'marca', label: 'Marca', icon: Palette, titulo: 'Marca', detalle: 'El nombre, el logo y los colores con los que el restaurante aparece en la web, la carta, las facturas y la app.' },
  { id: 'carta', label: 'Carta y contacto', icon: UtensilsCrossed, titulo: 'Carta y contacto', detalle: 'Lo que ve el comensal al escanear el QR: bienvenida, horario, redes y si puede pedir desde su celular.' },
  { id: 'facturas', label: 'Facturas', icon: Receipt, titulo: 'Facturas', detalle: 'El mensaje y el logo de la tirilla que imprime la caja.' },
  { id: 'operacion', label: 'Operación', icon: Settings2, titulo: 'Operación', detalle: 'Propina sugerida, costo del envío y cuándo una comanda se marca demorada en cocina.' },
  { id: 'fiscal', label: 'Datos fiscales', icon: Landmark, titulo: 'Datos fiscales', detalle: 'El restaurante como vendedor, el impuesto, las numeraciones de la DIAN y la facturación electrónica.' },
];

// Lo que el administrador edita: la configuración sin campos de servidor ni del contexto.
const CAMPOS = Object.keys(CONFIG_FABRICA).filter((k) => k !== 'fechaActualizacion');
const formularioDe = (c) => Object.fromEntries(CAMPOS.map((k) => [k, c[k] ?? CONFIG_FABRICA[k] ?? '']));
const iguales = (a, b) => CAMPOS.every((k) => String(a[k] ?? '') === String(b[k] ?? ''));

const FACTURA_MUESTRA = {
  numeroFactura: 'FV-000128', fechaEmision: '2026-11-26T19:42:00', mesaNumero: 4,
  nombreCliente: 'Consumidor final', nitCliente: '222222222222', metodoPago: 'Efectivo',
  items: [{ cantidad: 2, nombre: 'Bandeja paisa', total: 64000 }, { cantidad: 1, nombre: 'Limonada de coco', total: 9000 }],
  subtotal: 73000,
};

function Seccion({ titulo, detalle, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-5 ${className}`}>
      <h2 className="text-[17px] font-extrabold text-espresso">{titulo}</h2>
      {detalle && <p className="mt-1 max-w-prose text-[13px] text-gray-500">{detalle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AreaTexto({ label, ayuda, value, onChange, maxLength, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px] font-semibold text-gray-600">
        {label}
        <span className="tabular text-[12px] font-medium text-gray-400">{String(value ?? '').length}/{maxLength}</span>
      </span>
      <textarea
        rows={3} value={value ?? ''} onChange={onChange} maxLength={maxLength} placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-espresso placeholder:text-gray-500 transition-shadow focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
      />
      {ayuda && <span className="mt-1 block text-[12px] text-gray-500">{ayuda}</span>}
    </label>
  );
}

function Interruptor({ checked, onChange, titulo, detalle }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-espresso" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-[15px] font-bold text-espresso">{titulo}</span>
        <span className="block text-[13px] text-gray-500">{detalle}</span>
      </span>
    </label>
  );
}

function SelectorColor({ label, ayuda, value, onChange, error }) {
  const [texto, setTexto] = useState(value);
  useEffect(() => setTexto(value), [value]);
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color" value={esHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-gray-300 bg-white p-1" aria-label={`${label}: elegir en la paleta`}
        />
        <input
          value={texto} maxLength={7} spellCheck={false} aria-label={`${label} en hexadecimal`}
          onChange={(e) => {
            const v = e.target.value.trim();
            setTexto(v);
            if (esHex(v)) onChange(v.toUpperCase());
          }}
          className="tabular h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 font-mono text-[15px] uppercase text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
        />
      </div>
      {error ? <span className="mt-1 block text-[12px] font-semibold text-red-700">{error}</span> : ayuda && <span className="mt-1 block text-[12px] text-gray-500">{ayuda}</span>}
    </div>
  );
}

/** Muestra con los colores del formulario (variables CSS locales): así se ve antes de guardar. */
function VistaPrevia({ form, logoSrc }) {
  return (
    <div style={variablesCss(form)} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50" aria-label="Vista previa de la marca">
      <div className="flex items-center gap-2.5 border-b border-gray-200 bg-white px-4 py-3">
        <img src={logoSrc} alt="" className="h-9 w-9 rounded-xl bg-white object-contain ring-1 ring-gray-200" />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-extrabold text-espresso">{form.nombre || 'Nombre del restaurante'}</p>
          {form.eslogan && <p className="truncate text-[12px] text-gray-500">{form.eslogan}</p>}
        </div>
        <span className="ml-auto rounded-full bg-orange-100 px-3 py-1.5 text-[13px] font-semibold text-espresso">Caja</span>
      </div>
      <div className="space-y-4 p-4">
        <div className="rounded-[20px] bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-bold text-espresso">Bandeja paisa</p>
              <p className="text-[13px] text-gray-500">Frijoles, arroz, chicharrón y aguacate</p>
            </div>
            <Chip className="bg-orange-100 text-orange-800">Quedan 6</Chip>
          </div>
          <p className="tabular mt-3 text-[18px] font-extrabold text-espresso">$32.000</p>
        </div>
        <div className="flex h-14 items-center gap-3 rounded-[22px] bg-espresso pl-3 pr-5 text-white">
          <span className="tabular grid h-9 min-w-[2.25rem] place-items-center rounded-2xl bg-orange-500 px-2 text-[14px] font-extrabold text-espresso">3</span>
          <span className="text-[14px] font-bold">Ver pedido</span>
          <span className="tabular ml-auto text-[15px] font-extrabold">$73.000</span>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex h-10 items-center rounded-xl bg-espresso px-4 text-[14px] font-bold text-white">Cobrar</span>
          <span className="inline-flex h-10 items-center rounded-xl border border-gray-300 bg-white px-4 text-[14px] font-bold text-espresso">Imprimir</span>
        </div>
      </div>
    </div>
  );
}

function PestanaMarca({ form, cambiar, logoSrc, mostrar }) {
  const archivo = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const paleta = PALETAS.find((p) => p.marca === form.colorMarca && p.accion === form.colorAccion)?.id;
  const ratio = esHex(form.colorAccion) ? contraste(form.colorAccion, '#FFFFFF') : 0;

  const subirLogo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) {
      mostrar('El logo debe ser una imagen PNG, JPG o WebP', 'error');
      return;
    }
    setSubiendo(true);
    try {
      cambiar('logo')(await reducirLogo(f));
    } catch (err) {
      mostrar(err.message || 'No se pudo leer la imagen', 'error');
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Seccion titulo="Nombre" detalle="Sale en la barra del personal, el ingreso, la carta del comensal, los QR de las mesas, las tirillas y la app móvil.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nombre del restaurante" value={form.nombre} onChange={(e) => cambiar('nombre')(e.target.value)} maxLength={60} placeholder="La Fonda de Ana" />
            <Campo label="Eslogan (opcional)" value={form.eslogan ?? ''} onChange={(e) => cambiar('eslogan')(e.target.value)} maxLength={120} placeholder="Sabor de casa desde 1998" />
          </div>
        </Seccion>

        <Seccion titulo="Logo" detalle="Un PNG con fondo transparente se ve mejor. Se reduce a 512 px antes de guardarse.">
          <div className="flex flex-wrap items-center gap-4">
            <img src={logoSrc} alt="Logo actual" className="h-20 w-20 rounded-2xl bg-white object-contain p-1 ring-1 ring-gray-200" />
            <div className="flex flex-wrap gap-2">
              <input ref={archivo} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={subirLogo} tabIndex={-1} aria-hidden="true" />
              <Boton variante="secundario" onClick={() => archivo.current?.click()} disabled={subiendo}>
                <ImagePlus size={17} aria-hidden="true" /> {subiendo ? 'Preparando…' : form.logo ? 'Cambiar logo' : 'Subir logo'}
              </Boton>
              {form.logo && (
                <Boton variante="fantasma" onClick={() => cambiar('logo')('')}>
                  <RotateCcw size={16} aria-hidden="true" /> Usar el de Qpro
                </Boton>
              )}
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Colores" detalle="Elige una combinación lista o tus propios colores. El de acciones va en botones y títulos con texto blanco encima, así que debe ser oscuro.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Combinaciones de color">
            {PALETAS.map((p) => {
              const activa = paleta === p.id;
              return (
                <button
                  key={p.id} type="button" role="radio" aria-checked={activa}
                  onClick={() => { cambiar('colorMarca')(p.marca); cambiar('colorAccion')(p.accion); }}
                  className={`flex h-14 items-center gap-3 rounded-xl border px-3 text-left text-[14px] font-bold text-espresso transition-colors ${activa ? 'border-espresso bg-white ring-2 ring-espresso/15' : 'border-gray-200 bg-white hover:border-gray-400'}`}
                >
                  <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                    <span className="h-7 w-7 rounded-full ring-2 ring-white" style={{ background: p.marca }} />
                    <span className="h-7 w-7 rounded-full ring-2 ring-white" style={{ background: p.accion }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                  {activa && <Check size={16} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SelectorColor label="Color de marca" ayuda="Resaltes, conteos y fondos suaves." value={form.colorMarca} onChange={cambiar('colorMarca')} />
            <SelectorColor
              label="Color de acciones" value={form.colorAccion} onChange={cambiar('colorAccion')}
              ayuda={`Contraste con blanco: ${ratio.toFixed(1)} a 1 (mínimo ${CONTRASTE_MINIMO}).`}
              error={esHex(form.colorAccion) && !accionLegible(form.colorAccion) ? `Muy claro: contraste ${ratio.toFixed(1)} a 1. Elige uno más oscuro (mínimo ${CONTRASTE_MINIMO}).` : null}
            />
          </div>
        </Seccion>
      </div>

      <aside className="lg:sticky lg:top-36 lg:self-start">
        <p className="mb-2 text-[13px] font-semibold text-gray-600">Así se verá</p>
        <VistaPrevia form={form} logoSrc={logoSrc} />
      </aside>
    </div>
  );
}

function PestanaCarta({ form, cambiar }) {
  return (
    <div className="max-w-3xl space-y-5">
      <Seccion titulo="Pedidos desde el QR">
        <Interruptor
          checked={form.pedidosQR} onChange={cambiar('pedidosQR')}
          titulo="El comensal puede enviar pedidos desde su celular"
          detalle="Apágalo si la cocina está llena o vas a cerrar: la carta se sigue viendo y el comensal llama al mesero. El mesero pide igual desde la app."
        />
        {!form.pedidosQR && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[14px] font-semibold text-amber-900">
            <TriangleAlert size={17} aria-hidden="true" /> Pedidos por QR pausados al guardar.
          </p>
        )}
      </Seccion>

      <Seccion titulo="Bienvenida" detalle="Aparece arriba de la carta, debajo del nombre.">
        <AreaTexto
          label="Mensaje de bienvenida (opcional)" value={form.mensajeBienvenida} onChange={(e) => cambiar('mensajeBienvenida')(e.target.value)} maxLength={200}
          placeholder="Bienvenido. Pide desde tu mesa y te lo llevamos en minutos."
        />
      </Seccion>

      <Seccion titulo="Horario y redes" detalle="Salen al pie de la carta. El Instagram también va al final de la factura.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Horario" value={form.horario ?? ''} onChange={(e) => cambiar('horario')(e.target.value)} maxLength={120} placeholder="Lun a sáb, 11:00 a. m. a 10:00 p. m." className="sm:col-span-2" />
          <Campo label="WhatsApp" inputMode="tel" value={form.whatsapp ?? ''} onChange={(e) => cambiar('whatsapp')(e.target.value)} maxLength={20} placeholder="300 123 4567" ayuda="Un celular de Colombia o el número con su indicativo." />
          <Campo label="Instagram" value={form.instagram ?? ''} onChange={(e) => cambiar('instagram')(e.target.value)} maxLength={60} placeholder="@lafondadeana" ayuda="El usuario o el enlace del perfil." />
        </div>
      </Seccion>
    </div>
  );
}

function PestanaFacturas({ form, cambiar, fiscal }) {
  const marca = useMemo(() => normalizar(form), [form]);
  const muestra = useMemo(() => {
    const propina = propinaSugerida(FACTURA_MUESTRA.subtotal, tasaPropina(marca));
    const total = FACTURA_MUESTRA.subtotal + propina;
    return { ...FACTURA_MUESTRA, propina, total, pagos: [{ metodoPago: 'Efectivo', monto: total }] };
  }, [marca]);
  const html = useMemo(() => htmlFactura(muestra, {}, fiscal, marca), [muestra, fiscal, marca]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Seccion titulo="Pie de la factura">
          <AreaTexto
            label="Mensaje al final de la tirilla" value={form.pieFactura} onChange={(e) => cambiar('pieFactura')(e.target.value)} maxLength={200}
            placeholder="Gracias por su visita" ayuda='Vacío: "Gracias por su visita".'
          />
        </Seccion>
        <Seccion titulo="Logo en la tirilla">
          <Interruptor
            checked={form.logoEnFactura} onChange={cambiar('logoEnFactura')}
            titulo="Imprimir el logo arriba de la factura"
            detalle={form.logo ? 'Las impresoras térmicas lo imprimen en blanco y negro; un logo de trazos gruesos se ve mejor.' : 'Primero sube un logo en la pestaña Marca.'}
          />
        </Seccion>
        <p className="text-[13px] text-gray-500">
          La razón social, el NIT y el impuesto que encabezan la factura están en la pestaña Datos fiscales.
        </p>
      </div>
      <aside className="lg:sticky lg:top-36 lg:self-start">
        <p className="mb-2 text-[13px] font-semibold text-gray-600">Vista previa de la tirilla</p>
        <div className="rounded-2xl border border-gray-200 bg-gray-100 p-3">
          <iframe title="Vista previa de la factura" srcDoc={html} sandbox="" className="mx-auto block h-[560px] w-[300px] rounded-lg bg-white shadow-card" />
        </div>
      </aside>
    </div>
  );
}

function PestanaOperacion({ form, cambiar }) {
  const propina = propinaSugerida(50000, (Number(form.propinaSugerida) || 0) / 100);
  return (
    <div className="max-w-3xl space-y-5">
      <Seccion titulo="Propina voluntaria" detalle="La caja la ofrece al cobrar y el mesero la propone en la app. Siempre es voluntaria; en 0 no se sugiere.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            label="Propina sugerida (%)" type="number" min="0" max="30" step="1" inputMode="numeric"
            value={form.propinaSugerida} onChange={(e) => cambiar('propinaSugerida')(e.target.value)}
            ayuda={Number(form.propinaSugerida) > 0 ? `En una cuenta de ${pesos(50000)} sugiere ${pesos(propina)}.` : 'La caja no sugerirá propina.'}
          />
        </div>
      </Seccion>

      <Seccion titulo="Domicilios" detalle="El valor que se propone al crear un domicilio en la caja y el que paga quien pide por la página pública.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            label="Costo del envío" type="number" min="0" step="500" inputMode="numeric"
            value={form.costoEnvio} onChange={(e) => cambiar('costoEnvio')(e.target.value)}
            ayuda={`Se propone ${pesos(Number(form.costoEnvio) || 0)}; la caja puede cambiarlo en cada domicilio.`}
          />
        </div>
      </Seccion>

      <Seccion titulo="Tiempos de cocina" detalle="Cuánto puede esperar una comanda antes de cambiar de color en la pantalla de cocina.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Demorada a los (minutos)" type="number" min="1" max="180" inputMode="numeric" value={form.minutosAlerta} onChange={(e) => cambiar('minutosAlerta')(e.target.value)} />
          <Campo label="Urgente a los (minutos)" type="number" min="1" max="240" inputMode="numeric" value={form.minutosUrgente} onChange={(e) => cambiar('minutosUrgente')(e.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] font-semibold" aria-label="Así cambia una comanda en cocina">
          <ChefHat size={17} className="text-gray-500" aria-hidden="true" />
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">A tiempo</span>
          <span className="text-gray-400">→</span>
          <span className="rounded-full bg-amber-400 px-2.5 py-1 text-espresso">Demorada · {form.minutosAlerta || '?'} min</span>
          <span className="text-gray-400">→</span>
          <span className="rounded-full bg-red-600 px-2.5 py-1 text-white">Urgente · {form.minutosUrgente || '?'} min</span>
        </div>
      </Seccion>
    </div>
  );
}

export default function Configuracion() {
  const marca = useMarca();
  const [pestana, setPestana] = useState('marca');
  const [aviso, mostrar] = useAviso();
  const guardada = useMemo(() => formularioDe(marca), [marca]);
  const [form, setForm] = useState(guardada);
  const [enviando, setEnviando] = useState(false);
  const [fiscal, setFiscal] = useState(null);

  // Si otro administrador guarda mientras no hay cambios propios, se toma lo nuevo.
  const sinCambiosRef = useRef(true);
  const sinCambios = iguales(form, guardada);
  sinCambiosRef.current = sinCambios;
  useEffect(() => { if (sinCambiosRef.current) setForm(guardada); }, [guardada]);

  const cargarFiscal = async () => {
    try { setFiscal(await api.getFiscal()); } catch { /* sin datos fiscales la vista previa sale con la marca */ }
  };
  useEffect(() => { cargarFiscal(); }, []);

  const cambiar = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const error = errorConfiguracion(form);
  const logoSrc = form.logo || logoQpro;

  const guardar = async () => {
    if (enviando) return;
    if (error) { mostrar(error, 'error'); return; }
    setEnviando(true);
    try {
      const lista = await marca.guardar(paraGuardar(form));
      setForm(formularioDe(lista));
      mostrar('Configuración guardada. Ya se ve en la web, la carta, las facturas y la app.');
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const actual = PESTANAS.find((p) => p.id === pestana);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="sticky top-16 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <nav className="qp-rail mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-4 py-2 lg:px-6" aria-label="Configuración">
          {PESTANAS.map(({ id, label, icon: Icono }) => {
            const activa = pestana === id;
            return (
              <button
                key={id} type="button" onClick={() => setPestana(id)} aria-current={activa ? 'page' : undefined}
                className={`relative flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${activa ? 'text-espresso' : 'text-gray-500 hover:text-espresso'}`}
              >
                {activa && <motion.span layoutId="vista-configuracion" className="absolute inset-0 rounded-full bg-orange-100" transition={{ duration: 0.4, ease }} />}
                <Icono size={17} className="relative" aria-hidden="true" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <main className="mx-auto max-w-[1280px] px-4 py-6 lg:px-6 lg:py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">{actual.titulo}</h1>
            <p className="mt-1 max-w-prose text-[15px] text-gray-500">{actual.detalle}</p>
          </div>
          {pestana !== 'fiscal' && marca.fechaActualizacion && (
            <p className="flex items-center gap-1.5 text-[13px] text-gray-500">
              <Clock size={14} aria-hidden="true" />
              Guardada el {new Date(marca.fechaActualizacion.endsWith('Z') ? marca.fechaActualizacion : `${marca.fechaActualizacion}Z`).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </header>

        {pestana === 'marca' && <PestanaMarca form={form} cambiar={cambiar} logoSrc={logoSrc} mostrar={mostrar} />}
        {pestana === 'carta' && <PestanaCarta form={form} cambiar={cambiar} />}
        {pestana === 'facturas' && <PestanaFacturas form={form} cambiar={cambiar} fiscal={fiscal} />}
        {pestana === 'operacion' && <PestanaOperacion form={form} cambiar={cambiar} />}
        {pestana === 'fiscal' && <div className="max-w-4xl"><DatosFiscales fiscal={fiscal} onGuardado={cargarFiscal} mostrar={mostrar} /></div>}
      </main>

      {/* Barra de guardado: aparece solo con cambios sin guardar, en cualquier pestaña. */}
      <AnimatePresence>
        {!sinCambios && (
          <motion.div
            initial={{ y: 96, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 96, opacity: 0 }} transition={{ duration: 0.4, ease }}
            className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto flex max-w-[860px] flex-wrap items-center gap-3 rounded-[22px] bg-white px-4 py-3 shadow-lift ring-1 ring-gray-200">
              <Store size={18} className="text-gray-500" aria-hidden="true" />
              <p className={`min-w-0 flex-1 text-[14px] font-semibold ${error ? 'text-red-700' : 'text-espresso'}`} role="status">
                {error ?? 'Tienes cambios sin guardar'}
              </p>
              <Boton variante="fantasma" onClick={() => setForm(guardada)} disabled={enviando}>Descartar</Boton>
              <Boton onClick={guardar} disabled={enviando || !!error}>
                {enviando ? 'Guardando…' : 'Guardar cambios'}
              </Boton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {aviso}
    </div>
  );
}
