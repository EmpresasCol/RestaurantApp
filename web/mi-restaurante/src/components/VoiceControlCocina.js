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

  useEffect(() => {
    pedidosRef.current = pedidos
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
      const ultimoResultado = event.results[event.results.length - 1]
      const transcript = ultimoResultado[0].transcript
      const isFinal = ultimoResultado.isFinal
      const confianza = ultimoResultado[0].confidence

      if (isFinal && confianza > 0.5) {
        const comando = transcript.toLowerCase().trim()
        setUltimoComando(comando)
        setTranscribiendo("")

        if (silencioTimeoutRef.current) {
          clearTimeout(silencioTimeoutRef.current)
        }

        if (!modoActivo && comando.includes("Activar")) {
          activarModoEscucha()
        } else if (modoActivo && (comando.includes("pedido") || comando.includes("domicilio"))) {
          procesarComandoPedido(comando)
        }

        setTimeout(() => reiniciarReconocimiento(), 500)
      } else {
        setTranscribiendo(transcript)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        if (escuchandoRef.current) {
          setTimeout(() => reiniciarReconocimiento(), 100)
        }
      } else if (event.error === "not-allowed") {
        mostrarFeedback("error", "❌ Permiso denegado para usar micrófono")
        escuchandoRef.current = false
      }
    }

    recognition.onend = () => {
      if (escuchandoRef.current) {
        setTimeout(() => reiniciarReconocimiento(), 100)
      }
    }

    recognition.onsoundend = () => {
      if (modoActivo) {
        if (silencioTimeoutRef.current) {
          clearTimeout(silencioTimeoutRef.current)
        }
        silencioTimeoutRef.current = setTimeout(() => {
          desactivarModoActivo()
        }, 3000)
      }
    }

    setReconocimiento(recognition)
    reconocimientoRef.current = recognition
    iniciarEscuchaAutomatica(recognition)

    return () => {
      if (recognition) {
        try {
          recognition.stop()
        } catch (e) {
          console.log("Error al detener en cleanup")
        }
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (silencioTimeoutRef.current) clearTimeout(silencioTimeoutRef.current)
    }
  }, [modoActivo])

  const iniciarEscuchaAutomatica = (recognition) => {
    try {
      console.log("🎤 Iniciando reconocimiento automático...")
      recognition.start()
      escuchandoRef.current = true
      console.log("✅ Reconocimiento automático ACTIVADO")
    } catch (error) {
      if (!error.message?.includes("already started")) {
        console.error("❌ Error al iniciar reconocimiento:", error)
      }
    }
  }

  const reiniciarReconocimiento = () => {
    const recognition = reconocimientoRef.current
    if (!recognition || !escuchandoRef.current) return

    try {
      recognition.stop()
    } catch (e) {
      console.log("No se pudo detener reconocimiento")
    }

    setTimeout(() => {
      if (escuchandoRef.current) {
        try {
          recognition.start()
        } catch (error) {
          if (!error.message?.includes("already started")) {
            setTimeout(() => reiniciarReconocimiento(), 1000)
          }
        }
      }
    }, 200)
  }

  const activarModoEscucha = () => {
    console.log("✅ Modo de escucha ACTIVADO - Di 'pedido # listo' o 'domicilio # listo'")
    setModoActivo(true)
    mostrarFeedback("info", "🎤 Escuchando... di pedido o domicilio")
    reproducirConfirmacion("Dime pedido número listo, o domicilio número listo")
  }

  const procesarComandoPedido = (comando) => {
    if (!comando.includes("listo")) {
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
    }

    let numero = null
    const numeroDirecto = comando.match(/\d+/)
    if (numeroDirecto) {
      numero = Number.parseInt(numeroDirecto[0])
    }

    if (numero) {
      const tipo = comando.includes("domicilio") ? "domicilio" : "mesa"
      console.log(`✅ Comando detectado: ${tipo} #${numero}`)
      marcarPedidoListo(numero, tipo)
      desactivarModoActivo()
      return
    }

    mostrarFeedback("error", "❓ No entendí el número")
    reproducirError("No entendí el número. Intenta de nuevo")
  }

  const desactivarModoActivo = () => {
    setModoActivo(false)
    mostrarFeedback("info", "✅ Listo")
    setTranscribiendo("")
  }

  const marcarPedidoListo = (id, tipo) => {
    console.log(`🎤 Marcando ${tipo} #${id} como listo`)
    mostrarFeedback("exito", `✅ ${tipo === "domicilio" ? "Domicilio" : "Pedido"} ${id} marcado`)
    reproducirConfirmacion(`${tipo === "domicilio" ? "Domicilio" : "Pedido"} ${id} marcado como listo`)
    onMarcarListo(Number.parseInt(id), tipo)
  }

  const mostrarFeedback = (tipo, mensaje) => {
    setFeedback({ tipo, mensaje })
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setFeedback(null), 3000)
  }

  const reproducirConfirmacion = (mensaje) => {
    const utterance = new SpeechSynthesisUtterance(mensaje)
    utterance.lang = "es-CO"
    utterance.rate = 1.2
    utterance.pitch = 1.1
    window.speechSynthesis.speak(utterance)
  }

  const reproducirError = (mensaje) => {
    const utterance = new SpeechSynthesisUtterance(mensaje)
    utterance.lang = "es-CO"
    utterance.rate = 1.0
    utterance.pitch = 0.8
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
        <span className="text-sm font-semibold">{modoActivo ? "🎤 Escuchando..." : "🎙️ Di 'activar'"}</span>
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
