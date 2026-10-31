// Lee códigos de barras de dos formas:
// - Lector de mano (pistola USB/Bluetooth): escribe el código como un teclado y envía Enter.
// - Cámara del celular: @zxing/browser decodifica EAN-13, EAN-8, UPC, Code 128, QR, etc.
import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ScanLine } from 'lucide-react';
import { Boton } from './ui';

export default function EscanerCodigo({ onCodigo, autoFocus = true, placeholder = 'Escanea o escribe el código', ocupado = false }) {
  const [valor, setValor] = useState('');
  const [camara, setCamara] = useState(false);
  const [errorCamara, setErrorCamara] = useState(null);
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const ultimo = useRef({ codigo: null, en: 0 });
  // La cámara guarda el callback del primer render: se lee la prop actual por ref.
  const onCodigoRef = useRef(onCodigo);
  onCodigoRef.current = onCodigo;

  const emitir = (codigo) => {
    const limpio = String(codigo ?? '').trim();
    if (!limpio) return;
    // La cámara lee el mismo código varias veces por segundo: se ignora la repetición inmediata.
    const ahora = Date.now();
    if (ultimo.current.codigo === limpio && ahora - ultimo.current.en < 1500) return;
    ultimo.current = { codigo: limpio, en: ahora };
    if (typeof navigator !== 'undefined') navigator.vibrate?.(40);
    onCodigoRef.current(limpio);
  };

  useEffect(() => {
    if (!camara) return undefined;
    let controles = null;
    let cancelado = false;

    (async () => {
      try {
        if (!window.isSecureContext) throw Object.assign(new Error('inseguro'), { name: 'Inseguro' });
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelado) return;
        const lector = new BrowserMultiFormatReader();
        controles = await lector.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (resultado) => { if (resultado) emitir(resultado.getText()); }
        );
        if (cancelado) controles.stop();
      } catch (e) {
        setErrorCamara(
          e.name === 'NotAllowedError' ? 'Permite el acceso a la cámara en el navegador para escanear.'
            : e.name === 'NotFoundError' ? 'Este dispositivo no tiene cámara disponible.'
            : e.name === 'Inseguro' ? 'La cámara solo funciona en una dirección https.'
            : 'No se pudo abrir la cámara. Puedes escribir el código.'
        );
        setCamara(false);
      }
    })();

    return () => {
      cancelado = true;
      controles?.stop();
    };
    // emitir solo usa refs; la cámara no debe reiniciarse en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camara]);

  const enviar = (e) => {
    e.preventDefault();
    emitir(valor);
    setValor('');
    inputRef.current?.focus();
  };

  return (
    <div>
      <form onSubmit={enviar} className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Código de barras</span>
          <ScanLine size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus={autoFocus}
            inputMode="text"
            autoComplete="off"
            enterKeyHint="search"
            placeholder={placeholder}
            disabled={ocupado}
            className="tabular h-12 w-full rounded-xl border border-gray-300 bg-white pl-11 pr-3.5 text-[16px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <Boton
          variante={camara ? 'primario' : 'secundario'}
          tamano="lg"
          onClick={() => { setErrorCamara(null); setCamara((c) => !c); }}
          aria-pressed={camara}
          aria-label={camara ? 'Cerrar cámara' : 'Escanear con la cámara'}
        >
          {camara ? <CameraOff size={20} /> : <Camera size={20} />}
          <span className="hidden sm:inline">{camara ? 'Cerrar' : 'Cámara'}</span>
        </Boton>
      </form>

      {camara && (
        <div className="relative mt-3 overflow-hidden rounded-2xl bg-espresso">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover sm:aspect-video" muted playsInline />
          {/* Guía de encuadre: el código cabe dentro de la franja. */}
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl ring-2 ring-white/80" aria-hidden="true" />
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-center text-[13px] font-semibold text-white">
            Apunta al código de barras. Se agrega solo al leerlo.
          </p>
        </div>
      )}
      {errorCamara && <p className="mt-2 text-[13px] font-semibold text-red-700" role="alert">{errorCamara}</p>}
    </div>
  );
}
