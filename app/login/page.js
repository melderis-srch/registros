'use client';
import { useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setCargando(true);
    setError('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, clave }) });
    const j = await r.json().catch(() => ({}));
    if (j.ok) window.location.href = '/cirugias';
    else {
      setError(j.error || 'No se pudo ingresar.');
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-[radial-gradient(circle_at_20%_10%,#E4EBF9,transparent_45%),radial-gradient(circle_at_90%_90%,#F9E9E0,transparent_40%)]">
      <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-2xl shadow-card border border-linea p-8">
        <div className="mb-7">
          <div className="text-[22px] font-extrabold tracking-tight text-azul-osc">
            Surch<span className="text-naranja">é</span>rie
          </div>
          <div className="text-gris mt-1">Registros · Cirugías y compras</div>
        </div>
        <label className="block text-xs font-semibold text-gris mb-1.5">Email</label>
        <input className="campo mb-4" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="block text-xs font-semibold text-gris mb-1.5">Contraseña</label>
        <input className="campo" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
        {error && <div className="mt-4 text-sm text-err bg-err-claro rounded-lg px-3 py-2">{error}</div>}
        <button disabled={cargando} className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-azul hover:bg-azul-osc text-white font-semibold py-2.5 disabled:opacity-60">
          {cargando ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Ingresar
        </button>
      </form>
    </main>
  );
}
