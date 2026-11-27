'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';

export default function Login() {
  const [conf, setConf] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [email, setEmail] = useState('');
  const boton = useRef(null);

  async function entrar(datos) {
    setCargando(true);
    setError('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
    const j = await r.json().catch(() => ({}));
    if (j.ok) window.location.href = '/sistema.html';
    else {
      setError(j.error || 'No se pudo ingresar.');
      setCargando(false);
    }
  }

  useEffect(() => {
    fetch('/api/login').then((r) => r.json()).then(setConf).catch(() => setConf({ clientId: '', demo: false }));
  }, []);

  useEffect(() => {
    if (!conf?.clientId) return;
    const iniciar = () => {
      window.google.accounts.id.initialize({ client_id: conf.clientId, callback: (r) => entrar({ credential: r.credential }), ux_mode: 'popup' });
      window.google.accounts.id.renderButton(boton.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 300, locale: 'es' });
    };
    if (window.google?.accounts?.id) return iniciar();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = iniciar;
    s.onerror = () => setError('No se pudo cargar el ingreso con Google. Revisá la conexión.');
    document.head.appendChild(s);
  }, [conf]);

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-[radial-gradient(circle_at_20%_10%,#E4EBF9,transparent_45%),radial-gradient(circle_at_90%_90%,#F9E9E0,transparent_40%)]">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-card border border-linea p-8">
        <div className="mb-7">
          <img src="/logo.jpg" alt="Surchérie · Implantes quirúrgicos" className="h-14 w-auto" />
          <div className="text-gris mt-3">Registros · Cirugías, compras y stock</div>
        </div>
        {!conf ? (
          <Loader2 className="animate-spin text-gris" />
        ) : conf.demo ? (
          <form onSubmit={(e) => { e.preventDefault(); entrar({ email }); }}>
            <label className="block text-xs font-semibold text-gris mb-1.5">Email (modo demo)</label>
            <input className="campo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button disabled={cargando} className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-azul hover:bg-azul-osc text-white font-semibold py-2.5 disabled:opacity-60">
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Ingresar
            </button>
          </form>
        ) : conf.clientId ? (
          <div>
            <p className="text-[13px] text-gris mb-4">Ingresá con la cuenta de Google que tengas habilitada.</p>
            <div ref={boton} className="min-h-[44px] flex justify-center" />
            {cargando && <div className="mt-3 flex items-center gap-2 text-[13px] text-gris"><Loader2 size={14} className="animate-spin" /> Ingresando…</div>}
          </div>
        ) : (
          <div className="text-sm text-err">Falta configurar GOOGLE_CLIENT_ID en Vercel.</div>
        )}
        {error && <div className="mt-4 text-sm text-err bg-err-claro rounded-lg px-3 py-2">{error}</div>}
      </div>
    </main>
  );
}
