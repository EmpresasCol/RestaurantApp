// src/components/VoiceControlCocina.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

/**
 * Componente de Control por Voz para Cocina - VERSIÓN FINAL SIN WARNINGS
 * Permite marcar pedidos como listos mediante comando de voz: "pedido [numero] listo"
 * ✅ FUNCIONA EN SEGUNDO PLANO
 */
function VoiceControlCocina({ pedidos, onMarcarListo }) {
  const [escuchando, setEscuchando] = useState(false);
  const [ultimoComando, setUltimoComando] = useState('');
  const [soportado, setSoportado] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [transcribiendo, setTranscribiendo] = useState('');
  
  const timeoutRef = useRef(null);
  const reconocimientoRef = useRef(null);
  const escuchandoRef = useRef(false);
  const reinicioIntervalRef = useRef(null);

  // ✅ Función para mostrar feedback (memoizada)
  const mostrarFeedback = useCallback((tipo, mensaje) => {
    setFeedback({ tipo, mensaje });
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 3000);
  }, []);

  // ✅ Función para reproducir confirmación (memoizada)
  const reproducirConfirmacion = useCallback((mensaje) => {
    const utterance = new SpeechSynthesisUtterance(mensaje);
    utterance.lang = 'es-CO';
    utterance.rate = 1.2;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  // ✅ Función para reproducir error (memoizada)
  const reproducirError = useCallback((mensaje) => {
    const utterance = new SpeechSynthesisUtterance(mensaje);
    utterance.lang = 'es-CO';
    utterance.rate = 1.0;
    utterance.pitch = 0.8;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  // ✅ Función para marcar pedido listo (memoizada con dependencias correctas)
  const marcarPedidoListo = useCallback((idPedido) => {
    console.log(`🔍 Buscando pedido ID: ${idPedido}`);
    console.log(`📋 Pedidos disponibles:`, pedidos.map(p => `ID:${p.id} Estado:${p.estado}`));
    
    const pedido = pedidos.find(p => p.id === idPedido && p.estado === 'EnProceso');
    
    if (pedido) {
      console.log(`✅ Pedido ${idPedido} encontrado - Marcando como listo`);
      mostrarFeedback('exito', `✅ Pedido ${idPedido} marcado como listo`);
      reproducirConfirmacion(`Pedido ${idPedido} listo`);
      onMarcarListo(idPedido);
    } else {
      const pedidoExiste = pedidos.find(p => p.id === idPedido);
      
      if (pedidoExiste) {
        console.log(`⚠️ Pedido ${idPedido} existe pero no está en proceso (Estado: ${pedidoExiste.estado})`);
        mostrarFeedback('error', `⚠️ Pedido ${idPedido} ya está ${pedidoExiste.estado}`);
        reproducirError(`El pedido ${idPedido} ya está ${pedidoExiste.estado}`);
      } else {
        console.log(`❌ Pedido ${idPedido} no está disponible`);
        mostrarFeedback('error', `❌ Pedido ${idPedido} no disponible`);
        reproducirError(`El pedido ${idPedido} no está disponible`);
      }
    }
  }, [pedidos, onMarcarListo, mostrarFeedback, reproducirConfirmacion, reproducirError]);

  // ✅ Función para convertir palabras a número (memoizada)
  const convertirPalabrasANumero = useCallback((palabras, numerosMap) => {
    palabras = palabras.replace(/\s+y\s+/g, ' ').trim();
    const partes = palabras.split(/\s+/);
    let total = 0;
    
    for (let parte of partes) {
      const valor = numerosMap[parte];
      if (valor) {
        total += valor;
      } else {
        return null;
      }
    }
    
    return total > 0 ? total : null;
  }, []);

  // ✅ Función para procesar comando (memoizada con dependencias correctas)
  const procesarComando = useCallback((comando) => {
    console.log('🔍 Procesando comando:', comando);

    // Patrón: "pedido [numero] listo"
    const patronNumero = /pedido\s+(?:número\s+)?(\d+)\s+listo/i;
    const matchNumero = comando.match(patronNumero);
    
    if (matchNumero) {
      const idPedido = parseInt(matchNumero[1]);
      marcarPedidoListo(idPedido);
      return;
    }

    // Números en palabras
    const numerosEnPalabras = {
      'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
      'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9,
      'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 
      'quince': 15, 'dieciséis': 16, 'diecisiete': 17, 'dieciocho': 18, 
      'diecinueve': 19,
      'veinte': 20, 'veintiuno': 21, 'veintidós': 22, 'veintitrés': 23,
      'veinticuatro': 24, 'veinticinco': 25, 'veintiséis': 26, 'veintisiete': 27,
      'veintiocho': 28, 'veintinueve': 29,
      'treinta': 30, 'cuarenta': 40, 'cincuenta': 50,
      'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90,
      'cien': 100, 'ciento': 100
    };

    const patronPalabra = /pedido\s+(?:número\s+)?(.+?)\s+listo/i;
    const matchPalabra = comando.match(patronPalabra);
    
    if (matchPalabra) {
      const palabras = matchPalabra[1].toLowerCase().trim();
      let idPedido = numerosEnPalabras[palabras];
      
      if (!idPedido) {
        idPedido = convertirPalabrasANumero(palabras, numerosEnPalabras);
      }
      
      if (idPedido) {
        marcarPedidoListo(idPedido);
        return;
      }
    }

    console.log('❓ Comando no reconocido:', comando);
    mostrarFeedback('error', '❓ Comando no reconocido');
    reproducirError('Comando no reconocido. Di pedido número listo');
  }, [marcarPedidoListo, convertirPalabrasANumero, mostrarFeedback, reproducirError]);

  // ✅ Función para reiniciar reconocimiento (memoizada)
  const reiniciarReconocimiento = useCallback(() => {
    const recognition = reconocimientoRef.current;
    
    if (!recognition || !escuchandoRef.current) {
      return;
    }

    try {
      recognition.stop();
    } catch (e) {
      console.log('No se pudo detener (probablemente ya estaba detenido)');
    }

    setTimeout(() => {
      if (escuchandoRef.current) {
        try {
          recognition.start();
          console.log('✅ Reconocimiento reiniciado exitosamente');
        } catch (error) {
          if (error.message && error.message.includes('already started')) {
            console.log('⚠️ Reconocimiento ya estaba activo');
          } else {
            console.error('❌ Error al reiniciar:', error);
            setTimeout(() => reiniciarReconocimiento(), 1000);
          }
        }
      }
    }, 200);
  }, []);

  // ✅ useEffect principal con todas las dependencias correctas
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('❌ Tu navegador no soporta reconocimiento de voz');
      setSoportado(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const ultimoResultado = event.results[event.results.length - 1];
      const transcript = ultimoResultado[0].transcript;
      const isFinal = ultimoResultado.isFinal;
      const confianza = ultimoResultado[0].confidence;

      if (isFinal) {
        const comando = transcript.toLowerCase().trim();
        console.log('🎤 Comando final:', comando);
        setUltimoComando(comando);
        setTranscribiendo('');
        
        if (confianza > 0.5) {
          procesarComando(comando);
        }
      } else {
        setTranscribiendo(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error('⚠️ Error:', event.error);
      
      if (event.error === 'aborted' && escuchandoRef.current) {
        setTimeout(() => reiniciarReconocimiento(), 100);
      } else if (event.error === 'not-allowed') {
        mostrarFeedback('error', '❌ Permiso denegado para usar micrófono');
        setEscuchando(false);
        escuchandoRef.current = false;
      }
    };

    recognition.onend = () => {
      console.log('🎤 Reconocimiento finalizado');
      if (escuchandoRef.current) {
        setTimeout(() => reiniciarReconocimiento(), 100);
      }
    };

    recognition.onstart = () => {
      console.log('✅ Reconocimiento iniciado');
    };

    reconocimientoRef.current = recognition;

    // Monitorear visibilidad
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('👁️ Ventana en segundo plano');
      } else {
        console.log('👁️ Ventana visible');
        if (escuchandoRef.current) {
          setTimeout(() => reiniciarReconocimiento(), 100);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Health check
    const healthCheckInterval = setInterval(() => {
      if (escuchandoRef.current) {
        console.log('🏥 Health check');
      }
    }, 5000);

    reinicioIntervalRef.current = healthCheckInterval;

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (healthCheckInterval) clearInterval(healthCheckInterval);
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          console.log('Error al detener en cleanup');
        }
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [procesarComando, reiniciarReconocimiento, mostrarFeedback]); // ✅ Todas las dependencias incluidas

  const iniciarEscucha = () => {
    if (reconocimientoRef.current) {
      try {
        console.log('🎤 Iniciando reconocimiento...');
        console.log('📋 Pedidos disponibles:', pedidos.length);
        
        reconocimientoRef.current.start();
        setEscuchando(true);
        escuchandoRef.current = true;
        console.log('✅ Control por voz ACTIVADO');
      } catch (error) {
        if (error.message && error.message.includes('already started')) {
          setEscuchando(true);
          escuchandoRef.current = true;
        } else {
          mostrarFeedback('error', '❌ Error al iniciar micrófono');
        }
      }
    }
  };

  const detenerEscucha = () => {
    if (reconocimientoRef.current) {
      escuchandoRef.current = false;
      reconocimientoRef.current.stop();
      setEscuchando(false);
      mostrarFeedback('info', '🔇 Control por voz desactivado');
      console.log('🔇 Control por voz DESACTIVADO');
    }
  };

  if (!soportado) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-red-900 text-white px-6 py-4 rounded-lg shadow-xl border-2 border-red-600">
          <p className="font-semibold">❌ Navegador no compatible</p>
          <p className="text-sm">Usa Chrome, Edge o Safari</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={escuchando ? detenerEscucha : iniciarEscucha}
        className={`
          flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl
          font-semibold text-white transition-all transform hover:scale-105
          ${escuchando 
            ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
            : 'bg-blue-600 hover:bg-blue-700'
          }
        `}
      >
        {escuchando ? (
          <>
            <Mic className="w-6 h-6 animate-pulse" />
            <span>Escuchando...</span>
          </>
        ) : (
          <>
            <MicOff className="w-6 h-6" />
            <span>Activar Voz</span>
          </>
        )}
      </button>

      {escuchando && (
        <div className="absolute bottom-full right-0 mb-4 bg-gray-800 rounded-lg shadow-xl p-4 w-72 border-2 border-blue-500">
          <div className="flex items-start gap-2 mb-3">
            <Volume2 className="text-blue-400 flex-shrink-0 mt-1" size={20} />
            <div>
              <p className="text-white font-semibold mb-1">Control por Voz Activo</p>
              <p className="text-gray-300 text-sm">Di el comando:</p>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-3 mb-3">
            <p className="text-green-400 font-mono text-center text-lg">
              "Pedido [número] listo"
            </p>
          </div>

          {transcribiendo && (
            <div className="bg-blue-900 border-2 border-blue-500 rounded-lg p-3 mb-3 animate-pulse">
              <p className="text-xs text-blue-300 font-semibold mb-1">👂 Escuchando:</p>
              <p className="text-white font-mono text-sm break-words">
                "{transcribiendo}"
              </p>
            </div>
          )}

          {!transcribiendo && (
            <div className="bg-gray-700 rounded-lg p-3 mb-3">
              <p className="text-gray-400 text-xs text-center">
                🎤 Esperando tu voz...
              </p>
            </div>
          )}

          <div className="space-y-2 text-xs text-gray-400">
            <p className="font-semibold text-gray-300">Ejemplos:</p>
            <ul className="space-y-1 ml-2">
              <li>• "Pedido 1 listo"</li>
              <li>• "Pedido 4 listo"</li>
              <li>• "Pedido uno listo"</li>
              <li>• "Pedido cuatro listo"</li>
            </ul>
            <p className="text-green-300 font-semibold mt-2">
              ✨ Funciona en segundo plano
            </p>
          </div>

          {ultimoComando && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-xs text-gray-500">Último comando:</p>
              <p className="text-xs text-blue-300 truncate">"{ultimoComando}"</p>
            </div>
          )}
        </div>
      )}

      {feedback && (
        <div className={`
          absolute bottom-full right-0 mb-4 px-4 py-3 rounded-lg shadow-xl
          font-semibold text-white text-sm animate-fade-in
          ${feedback.tipo === 'exito' ? 'bg-green-600' : ''}
          ${feedback.tipo === 'error' ? 'bg-red-600' : ''}
          ${feedback.tipo === 'info' ? 'bg-blue-600' : ''}
        `}>
          {feedback.mensaje}
        </div>
      )}
    </div>
  );
}

export default VoiceControlCocina;