import { useEffect, useState, useRef } from "react"
import { Mic } from "lucide-react"

function VoiceControlCocina({ pedidos, onMarcarListo }) {
  const [reconocimiento, setReconocimiento] = useState(null)
  const [ultimoComando, setUltimoComando] = useState("")
  const [soportado, setSoportado] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [transcribiendo, setTranscribiendo] = useState("")
  const [modoActivo, setModoActivo] = useState(false)
  const timeoutRef = useRef(null)
  const silencioTimeoutRef = useRef(null)

  const reconocimientoRef = useRef(null)
  const escuchandoRef = useRef(false)
  const pedidosRef = useRef(pedidos)
  const palabraClaveProcesandoRef = useRef(null)

  useEffect(() => {
    pedidosRef.current = pedidos
    console.log("🔄 Actualizando referencia de pedidos:", pedidos?.length || 0)
  }, [pedidos])

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.error("❌ Tu navegador no soporta reconocimiento de voz")
      setSoportado(false)
      return
    }

    const recognition = new SpeechRecognition()

    recognition.lang = "es-CO"
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      console.log("🎙️ Evento onresult disparado - Total resultados:", event.results.length)

      const ultimoResultado = event.results[event.results.length - 1]
      const transcript = ultimoResultado[0].transcript
      const isFinal = ultimoResultado.isFinal
      const confianza = ultimoResultado[0].confidence

      console.log("📝 Transcripción:", transcript, "| Final:", isFinal, "| Confianza:", confianza)

      if (isFinal) {
        const comando = transcript.toLowerCase().trim()
        console.log("🎤 Comando detectado (final):", comando, "| Confianza:", confianza)
        setUltimoComando(comando)
        setTranscribiendo("")

        if (silencioTimeoutRef.current) {
          clearTimeout(silencioTimeoutRef.current)
        }

        if (confianza > 0.5) {
          if (!modoActivo) {
            detectarPalabraClave(comando)
          } else {
            procesarComando(comando)
          }
        } else {
          console.log("⚠️ Confianza muy baja, no se procesará:", confianza)
        }

        setTimeout(() => reiniciarReconocimiento(), 500)
      } else {
        console.log("👂 Escuchando (en tiempo real):", transcript)
        setTranscribiendo(transcript)
      }
    }

    recognition.onerror = (event) => {
      console.error("⚠️ Error en reconocimiento:", event.error)

      if (event.error === "no-speech") {
        console.log("👂 Esperando comando de voz...")
      } else if (event.error === "aborted") {
        console.log("⚠️ Reconocimiento abortado - Reiniciando...")
        if (escuchandoRef.current) {
          setTimeout(() => reiniciarReconocimiento(), 100)
        }
      } else if (event.error === "network") {
        mostrarFeedback("error", "❌ Error de conexión")
        escuchandoRef.current = false
      } else if (event.error === "not-allowed") {
        mostrarFeedback("error", "❌ Permiso denegado para usar micrófono")
        escuchandoRef.current = false
      }
    }

    recognition.onend = () => {
      console.log("🎤 Reconocimiento finalizado")
      if (escuchandoRef.current) {
        console.log("🔄 Reiniciando reconocimiento automáticamente...")
        setTimeout(() => reiniciarReconocimiento(), 100)
      }
    }

    recognition.onstart = () => {
      console.log("✅ Reconocimiento iniciado correctamente")
    }

    recognition.onaudiostart = () => {
      console.log("🔊 Audio detectado - El micrófono está capturando sonido")
    }

    recognition.onsoundstart = () => {
      console.log("🗣️ Voz detectada - Comenzando transcripción")
    }

    recognition.onsoundend = () => {
      console.log("🔇 Voz finalizada - Procesando resultado")
      if (modoActivo) {
        if (silencioTimeoutRef.current) {
          clearTimeout(silencioTimeoutRef.current)
        }
        silencioTimeoutRef.current = setTimeout(() => {
          console.log("⏱️ Silencio detectado - Desactivando modo activo")
          desactivarModoActivo()
        }, 3000)
      }
    }

    setReconocimiento(recognition)
    reconocimientoRef.current = recognition

    iniciarEscuchaAutomatica(recognition)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("👁️ Ventana en segundo plano")
      } else {
        console.log("👁️ Ventana en primer plano")
        if (escuchandoRef.current) {
          console.log("🔄 Verificando estado del reconocimiento...")
          setTimeout(() => {
            if (escuchandoRef.current) {
              reiniciarReconocimiento()
            }
          }, 100)
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    const healthCheckInterval = setInterval(() => {
      if (escuchandoRef.current) {
        console.log("🏥 Health check - Reconocimiento activo")
      }
    }, 5000)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(healthCheckInterval)

      if (recognition) {
        try {
          recognition.stop()
        } catch (e) {
          console.log("Error al detener en cleanup")
        }
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (silencioTimeoutRef.current) {
        clearTimeout(silencioTimeoutRef.current)
      }
    }
  }, [modoActivo])

  const iniciarEscuchaAutomatica = (recognition) => {
    try {
      console.log("🎤 Iniciando reconocimiento automático...")
      recognition.start()
      escuchandoRef.current = true
      console.log("✅ Reconocimiento automático ACTIVADO")
    } catch (error) {
      console.error("❌ Error al iniciar reconocimiento automático:", error)
      if (error.message.includes("already started")) {
        console.log("⚠️ Reconocimiento ya estaba activo")
        escuchandoRef.current = true
      } else {
        mostrarFeedback("error", "❌ Error al iniciar micrófono")
      }
    }
  }

  const reiniciarReconocimiento = () => {
    const recognition = reconocimientoRef.current

    if (!recognition || !escuchandoRef.current) {
      return
    }

    try {
      recognition.stop()
    } catch (e) {
      console.log("No se pudo detener (probablemente ya estaba detenido)")
    }

    setTimeout(() => {
      if (escuchandoRef.current) {
        try {
          recognition.start()
          console.log("✅ Reconocimiento reiniciado exitosamente")
        } catch (error) {
          if (error.message && error.message.includes("already started")) {
            console.log("⚠️ Reconocimiento ya estaba activo")
          } else {
            console.error("❌ Error al reiniciar:", error)
            setTimeout(() => reiniciarReconocimiento(), 1000)
          }
        }
      }
    }, 200)
  }

  const detectarPalabraClave = (comando) => {
    console.log("🔍 Detectando palabra clave en:", comando)

    if (comando.includes("activar")) {
      console.log("✅ Palabra clave ACTIVAR detectada")
      palabraClaveProcesandoRef.current = "mesa"
      mostrarFeedback("info", "🎤 Escuchando número de pedido...")
      reproducirConfirmacion("Di el número de pedido")
      setModoActivo(true)
      return
    }

    if (comando.includes("domicilio")) {
      console.log("✅ Palabra clave DOMICILIO detectada")
      palabraClaveProcesandoRef.current = "domicilio"
      mostrarFeedback("info", "🎤 Escuchando número de domicilio...")
      reproducirConfirmacion("Di el número de domicilio")
      setModoActivo(true)
      return
    }

    console.log("❓ Ninguna palabra clave detectada")
  }

  const desactivarModoActivo = () => {
    setModoActivo(false)
    palabraClaveProcesandoRef.current = null
    mostrarFeedback("info", "✅ Listo")
    setTranscribiendo("")
  }

  const procesarComando = (comando) => {
    console.log("🔍 Procesando comando en modo activo:", comando)

    if (!comando.includes("listo")) {
      console.log("⚠️ Comando sin palabra 'listo'")
      mostrarFeedback("error", "❓ Di 'listo' al final")
      reproducirError("Di la palabra listo al final")
      return
    }

    const numerosEnPalabras = {
      uno: 1,
      dos: 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
      seis: 6,
      siete: 7,
      ocho: 8,
      nueve: 9,
      diez: 10,
      once: 11,
      doce: 12,
      trece: 13,
      catorce: 14,
      quince: 15,
      dieciséis: 16,
      diecisiete: 17,
      dieciocho: 18,
      diecinueve: 19,
      veinte: 20,
      veintiuno: 21,
      veintidós: 22,
      veintitrés: 23,
      veinticuatro: 24,
      veinticinco: 25,
      veintiséis: 26,
      veintisiete: 27,
      veintiocho: 28,
      veintinueve: 29,
      treinta: 30,
      cuarenta: 40,
      cincuenta: 50,
      sesenta: 60,
      setenta: 70,
      ochenta: 80,
      noventa: 90,
      cien: 100,
      ciento: 100,
      doscientos: 200,
      trescientos: 300,
      cuatrocientos: 400,
      quinientos: 500,
      seiscientos: 600,
      setecientos: 700,
      ochocientos: 800,
      novecientos: 900,
    }

    let numero = null

    const numeroDirecto = comando.match(/\d+/)
    if (numeroDirecto) {
      numero = Number.parseInt(numeroDirecto[0])
    } else {
      const comandoLimpio = comando
        .replace(/listo/i, "")
        .replace(/pedido|domicilio|número/i, "")
        .trim()
      numero = numerosEnPalabras[comandoLimpio] || convertirPalabrasANumero(comandoLimpio, numerosEnPalabras)
    }

    if (numero) {
      const tipoComando = palabraClaveProcesandoRef.current
      console.log(`✅ Número detectado: ${numero}, tipo: ${tipoComando}`)
      marcarPedidoListo(numero, tipoComando)
      desactivarModoActivo()
      return
    }

    console.log("❓ No se detectó un número válido")
    mostrarFeedback("error", "❓ No entendí el número")
    reproducirError("No entendí el número. Intenta de nuevo")
  }

  const convertirPalabrasANumero = (palabras, numerosMap) => {
    palabras = palabras.replace(/\s+y\s+/g, " ").trim()
    const partes = palabras.split(/\s+/)
    let total = 0

    for (const parte of partes) {
      const valor = numerosMap[parte]
      if (valor) {
        total += valor
      } else {
        return null
      }
    }

    return total > 0 ? total : null
  }

  const marcarPedidoListo = (id, tipoComando) => {
    const pedidosActuales = pedidosRef.current

    console.log(`🎤 Comando de voz recibido: ${tipoComando} #${id}`)
    console.log(`📋 Total de pedidos disponibles: ${pedidosActuales?.length || 0}`)

    const pedidosMesa = pedidosActuales?.filter((p) => p.tipo === "mesa" && p.estado === "EnProceso") || []
    const domicilios = pedidosActuales?.filter((p) => p.tipo === "domicilio" && p.estado === "EnProceso") || []

    console.log(`📋 Disponibles en EnProceso:`, {
      mesas: pedidosMesa.map((p) => ({ id: p.id, mesa: p.mesa })),
      domicilios: domicilios.map((p) => ({ domicilioId: p.domicilioId, mesa: p.mesa })),
    })

    const idNumerico = Number.parseInt(id)

    if (tipoComando === "mesa") {
      mostrarFeedback("exito", `✅ Pedido ${id} marcado`)
      reproducirConfirmacion(`Pedido ${id} marcado como listo`)
      onMarcarListo(idNumerico, tipoComando)
    } else if (tipoComando === "domicilio") {
      mostrarFeedback("exito", `✅ Domicilio ${id} marcado`)
      reproducirConfirmacion(`Domicilio ${id} marcado como en camino`)
      onMarcarListo(idNumerico, tipoComando)
    }
  }

  const mostrarFeedback = (tipo, mensaje) => {
    setFeedback({ tipo, mensaje })

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setFeedback(null)
    }, 3000)
  }

  const reproducirConfirmacion = (mensaje) => {
    const utterance = new SpeechSynthesisUtterance(mensaje)
    utterance.lang = "es-CO"
    utterance.rate = 1.2
    utterance.pitch = 1.1
    utterance.volume = 1.0
    window.speechSynthesis.speak(utterance)
  }

  const reproducirError = (mensaje) => {
    const utterance = new SpeechSynthesisUtterance(mensaje)
    utterance.lang = "es-CO"
    utterance.rate = 1.0
    utterance.pitch = 0.8
    utterance.volume = 1.0
    window.speechSynthesis.speak(utterance)
  }

  if (!soportado) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-red-900 text-white px-6 py-4 rounded-lg shadow-xl border-2 border-red-600">
          <p className="font-semibold">❌ Navegador no compatible</p>
          <p className="text-sm">Usa Chrome, Edge o Safari para control por voz</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg border transition-all ${
          modoActivo ? "bg-yellow-600 border-yellow-400 text-white" : "bg-green-600 border-green-400 text-white"
        }`}
      >
        <Mic className="flex-shrink-0 animate-pulse" size={16} />
        <span className="text-sm font-semibold">{modoActivo ? "🎤 Escuchando..." : "🎙️ Activo"}</span>
      </div>

      {feedback && (
        <div
          className={`
          absolute bottom-full right-0 mb-4 px-4 py-3 rounded-lg shadow-xl
          font-semibold text-white text-sm animate-fade-in
          ${feedback.tipo === "exito" ? "bg-green-600" : ""}
          ${feedback.tipo === "error" ? "bg-red-600" : ""}
          ${feedback.tipo === "info" ? "bg-blue-600" : ""}
        `}
        >
          {feedback.mensaje}
        </div>
      )}
    </div>
  )
}

export default VoiceControlCocina
