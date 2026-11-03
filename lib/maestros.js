'use client';
import { norm } from '@/lib/format';

/** Busca una institución por nombre aproximado ("Htal Cullen" ≈ "Hospital Cullen") */
export function buscarInstitucion(lista, nombre) {
  const n = norm(nombre).replace(/\bhtal\b/g, 'hospital').replace(/\bsan\b/g, 'sanatorio');
  if (!n) return null;
  const exacta = lista.find((i) => norm(i.nombre) === norm(nombre));
  if (exacta) return exacta;
  const palabras = n.split(' ').filter((w) => w.length > 2 && !['hospital', 'sanatorio', 'clinica'].includes(w));
  if (!palabras.length) return null;
  const cand = lista.filter((i) => palabras.every((w) => norm(i.nombre).includes(w)));
  return cand.length === 1 ? cand[0] : null;
}

export function buscarMedico(lista, nombre) {
  return lista.find((m) => norm(m.nombre) === norm(nombre)) || null;
}

/** Contenido de un listado (Sistemas_Contenido) */
export function contenidoDe(contenido, listado) {
  if (!listado) return [];
  return contenido.filter((r) => r.listado === listado).map(({ seccion, cant, codigo, desc }) => ({ seccion, cant, codigo, desc }));
}

export const textoProducto = (p) => `${p.codigo} ${p.desc} ${p.marca} ${p.modelo} ${p.proveedor}`;
export function EtiquetaProducto(p) {
  return (
    <span className="flex items-baseline gap-2">
      <b className="font-semibold whitespace-nowrap">{p.codigo}</b>
      <span className="truncate">{p.desc}</span>
      <span className="text-gris-claro text-[11.5px] whitespace-nowrap ml-auto">{p.proveedor}</span>
    </span>
  );
}

export const textoSistema = (s) => `${s.codigo} ${s.desc} ${s.marca}`;
export function EtiquetaSistema(s) {
  return (
    <span className="flex items-baseline gap-2">
      <b className="font-semibold whitespace-nowrap">{s.codigo}</b>
      <span className="truncate max-w-[380px]">{s.desc}</span>
      <span className="text-gris-claro text-[11.5px] ml-auto">{s.marca}</span>
    </span>
  );
}
