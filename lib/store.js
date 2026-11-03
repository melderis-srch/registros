'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [inicio, setInicio] = useState(null);
  const [error, setError] = useState('');
  const [avisos, setAvisos] = useState([]);

  const cargar = useCallback(async () => {
    try {
      setInicio(await api('getInicio'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const avisar = useCallback((texto, tipo = 'ok', link) => {
    const id = Math.random().toString(36).slice(2);
    setAvisos((a) => [...a, { id, texto, tipo, link }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'err' ? 9000 : 6000);
  }, []);

  const actualizar = useCallback((parcial) => setInicio((i) => ({ ...i, ...parcial })), []);

  const valor = useMemo(() => ({ inicio, error, recargar: cargar, actualizar, avisar }), [inicio, error, cargar, actualizar, avisar]);
  return (
    <Ctx.Provider value={valor}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))]">
        {avisos.map((a) => (
          <div key={a.id} className={`rounded-xl shadow-xl border px-4 py-3 text-[13px] bg-white ${a.tipo === 'err' ? 'border-err/30 text-err' : 'border-ok/25 text-tinta'}`}>
            {a.texto}
            {a.link && (
              <a href={a.link} target="_blank" rel="noreferrer" className="ml-2 font-semibold text-azul underline">Abrir PDF</a>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useApp() {
  return useContext(Ctx);
}

/** Maestros con nombres cortos */
export function useMaestros() {
  const { inicio } = useApp();
  const m = inicio?.maestros || {};
  return {
    clientes: m.Clientes || [],
    productos: m.Productos || [],
    proveedores: m.Proveedores || [],
    medicos: m.Medicos || [],
    instituciones: m.Instituciones || [],
    sistemas: m.Sistemas || [],
    contenido: m.Sistemas_Contenido || [],
  };
}
