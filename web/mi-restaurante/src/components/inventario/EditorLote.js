// Corregir un lote mal registrado (fecha de vencimiento o número) sin salir de la lista.
import React, { useState } from 'react';
import { compras, mensajeError } from '../../services/inventarioApi';
import { Boton, Campo } from './ui';

export default function EditorLote({ lote, onGuardado, onCancelar }) {
  const [fecha, setFecha] = useState(lote.fechaVencimiento ? String(lote.fechaVencimiento).slice(0, 10) : '');
  const [numero, setNumero] = useState(lote.numeroLote ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await compras.editarLote(lote.id, { fechaVencimiento: fecha || null, numeroLote: numero.trim() || null });
      onGuardado?.();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo corregir el lote'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="w-full rounded-xl border border-orange-200 bg-orange-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Vence" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} autoFocus />
        <Campo label="Número de lote" value={numero} onChange={(e) => setNumero(e.target.value)} />
      </div>
      {error && <p className="mt-2 text-[13px] font-semibold text-red-700" role="alert">{error}</p>}
      <div className="mt-2.5 flex justify-end gap-2">
        <Boton variante="fantasma" tamano="sm" onClick={onCancelar}>Cancelar</Boton>
        <Boton tamano="sm" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar corrección'}</Boton>
      </div>
    </div>
  );
}
