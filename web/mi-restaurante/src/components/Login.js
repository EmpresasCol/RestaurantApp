// src/components/Login.js
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowRight, ChefHat, Eye, EyeOff, Package, QrCode, Receipt, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from './logo.jpg';

const ease = [0.16, 1, 0.3, 1];

// El recorrido real de un pedido en Qpro, de la mesa al inventario.
const RECORRIDO = [
  { icon: QrCode, texto: 'Mesa' },
  { icon: ChefHat, texto: 'Cocina' },
  { icon: Receipt, texto: 'Caja' },
  { icon: Package, texto: 'Inventario' }
];

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [esMesero, setEsMesero] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEsMesero(false);
    setCargando(true);

    try {
      await login({ username, password });
    } catch (err) {
      if (err.message.includes('mesero') || err.message.includes('móvil')) {
        setEsMesero(true);
        setPassword('');
      } else {
        setError(err.message);
      }
    } finally {
      setCargando(false);
    }
  };

  const campo =
    'block h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] text-espresso placeholder:text-gray-500 transition-shadow focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100';

  return (
    <div className="flex min-h-screen bg-white">
      {/* Panel de marca (escritorio) */}
      <aside className="relative hidden w-[44%] max-w-[640px] flex-col justify-between overflow-hidden bg-espresso p-12 text-white lg:flex">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
          <div className="flex items-center gap-3">
            <img src={logo} alt="Qpro" className="h-12 w-12 rounded-2xl bg-white object-contain p-1" />
            <span className="text-xl font-extrabold tracking-[-0.01em]">Qpro</span>
          </div>
          <h1 className="mt-16 max-w-md text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em]">
            Del pedido en la mesa a la factura, en un solo sistema.
          </h1>
          <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-orange-100">
            Lo que pide el comensal llega a cocina, se cobra en caja y se descuenta del inventario.
          </p>
        </motion.div>

        <ol className="flex items-center gap-2" aria-label="Recorrido de un pedido">
          {RECORRIDO.map(({ icon: Icono, texto }, i) => (
            <motion.li
              key={texto}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.25 + i * 0.1 }}
              className="flex items-center gap-2"
            >
              <span className="flex items-center gap-2 rounded-full bg-white/[0.08] py-2 pl-2 pr-4 text-[14px] font-bold">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-espresso">
                  <Icono size={16} />
                </span>
                {texto}
              </span>
              {i < RECORRIDO.length - 1 && <ArrowRight size={16} className="text-orange-300" aria-hidden="true" />}
            </motion.li>
          ))}
        </ol>
      </aside>

      {/* Formulario */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.05 }}
          className="w-full max-w-[400px]"
        >
          <img src={logo} alt="Qpro" className="mb-8 h-16 w-16 rounded-2xl object-contain ring-1 ring-gray-200 lg:hidden" />
          <h2 className="text-[30px] font-extrabold tracking-[-0.02em] text-espresso">Inicia sesión</h2>
          <p className="mt-2 text-[15px] text-gray-500">Acceso para administración, caja y cocina.</p>

          {error && (
            <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl bg-red-50 p-4">
              <AlertCircle className="mt-0.5 shrink-0 text-red-700" size={18} />
              <p className="text-[14px] font-medium text-red-800">{error}. Revisa el usuario y la contraseña.</p>
            </div>
          )}

          {esMesero && (
            <div role="status" className="mt-6 flex items-start gap-3 rounded-xl bg-purple-50 p-4">
              <Smartphone className="mt-0.5 shrink-0 text-purple-700" size={18} />
              <p className="text-[14px] font-medium text-purple-900">
                Las cuentas de mesero entran por la app móvil de Qpro. Inicia sesión allí con el mismo usuario.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="mb-2 block text-[14px] font-semibold text-espresso">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={campo}
                placeholder="Tu usuario"
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-[14px] font-semibold text-espresso">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={mostrarPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${campo} pr-12`}
                  placeholder="Tu contraseña"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-lg text-gray-500 transition-colors hover:text-espresso"
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-espresso text-[15px] font-bold text-white transition-[transform,background-color] hover:bg-gray-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {cargando ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  Verificando…
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-[13px] text-gray-500">Meseros y domiciliarios usan la app móvil de Qpro.</p>
        </motion.div>
      </main>
    </div>
  );
}

export default Login;
