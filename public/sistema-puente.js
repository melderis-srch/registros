/*
 * Puente del sistema web (sistema.html) con el backend de Apps Script.
 * La pantalla se escribió como app de Claude: usa claude.use("db" | "mcp" | "downloads").
 * Este archivo da esas mismas funciones, pero contra /api/gas (que valida la sesión de Google
 * y llama al Apps Script con la cuenta DT). Así la misma pantalla funciona en Vercel.
 */
(function () {
  'use strict';
  var POLL_MS = 8000;

  async function api(accion, args) {
    var r = await fetch('/api/gas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ accion: accion, args: args || [] }),
    });
    if (r.status === 401) { location.href = '/login'; throw { code: 'needs_reauth', message: 'Sesión vencida' }; }
    var j; try { j = await r.json(); } catch (e) { throw { code: 'tool_error', message: 'Respuesta inválida del servidor' }; }
    if (!j.ok) throw { code: 'tool_error', message: j.error || 'Error del servidor' };
    return j.data;
  }

  // ---------------- base compartida ----------------
  var datos = {};            // coleccion -> Map(id -> data)
  var subsCol = {};          // coleccion -> [cb]
  var subsDoc = {};          // "col/id" -> [cb]
  var ultimo = 0, cargado = null, enCurso = false;
  function clon(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function mapa(c) { return datos[c] || (datos[c] = new Map()); }
  function snapCol(c) {
    var docs = []; mapa(c).forEach(function (d, id) { docs.push({ id: id, data: (function (v) { return function () { return clon(v); }; })(d) }); });
    return { metadata: { fromCache: false }, docs: docs };
  }
  function snapDoc(c, id) { var d = mapa(c).get(id); return { id: id, exists: d !== undefined, data: function () { return clon(d); } }; }
  function avisar(cols, docs) {
    cols.forEach(function (c) { (subsCol[c] || []).forEach(function (cb) { try { cb(snapCol(c)); } catch (e) { console.error(e); } }); });
    docs.forEach(function (k) { var p = k.split('/'); (subsDoc[k] || []).forEach(function (cb) { try { cb(snapDoc(p[0], p[1])); } catch (e) { console.error(e); } }); });
  }
  function aplicar(lista) {
    var cols = {}, docs = {};
    lista.forEach(function (x) {
      if (x.d === null) mapa(x.c).delete(x.id); else mapa(x.c).set(x.id, x.d);
      cols[x.c] = 1; docs[x.c + '/' + x.id] = 1;
    });
    avisar(Object.keys(cols), Object.keys(docs));
  }
  function cargar() {
    if (!cargado) cargado = api('dbTodo').then(function (r) { ultimo = r.ts; aplicar(r.docs); return true; });
    return cargado;
  }
  async function sondear() {
    if (enCurso || document.hidden) return; enCurso = true;
    try { var r = await api('dbCambios', [ultimo - 2000]); ultimo = r.ts; if (r.docs.length) aplicar(r.docs); }
    catch (e) { console.warn('No se pudo actualizar:', e && e.message); }
    finally { enCurso = false; }
  }
  setInterval(sondear, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) sondear(); });

  var db = {
    collection: function (c) {
      return {
        onSnapshot: function (cb, err) {
          (subsCol[c] = subsCol[c] || []).push(cb);
          cargar().then(function () { cb(snapCol(c)); }, function (e) { if (err) err(e); });
          return function () { subsCol[c] = (subsCol[c] || []).filter(function (f) { return f !== cb; }); };
        },
      };
    },
    doc: function (path) {
      var p = String(path).split('/'), c = p[0], id = p[1];
      return {
        get: async function () { await cargar(); return snapDoc(c, id); },
        set: async function (data) {
          var anterior = mapa(c).get(id), nuevo = clon(data);
          mapa(c).set(id, nuevo); avisar([c], [c + '/' + id]);
          try { await api('dbSet', [c, id, nuevo]); }
          catch (e) { if (anterior === undefined) mapa(c).delete(id); else mapa(c).set(id, anterior); avisar([c], [c + '/' + id]); throw e; }
        },
        delete: async function () {
          var anterior = mapa(c).get(id); mapa(c).delete(id); avisar([c], [c + '/' + id]);
          try { await api('dbDelete', [c, id]); }
          catch (e) { if (anterior !== undefined) { mapa(c).set(id, anterior); avisar([c], [c + '/' + id]); } throw e; }
        },
        onSnapshot: function (cb, err) {
          var k = c + '/' + id; (subsDoc[k] = subsDoc[k] || []).push(cb);
          cargar().then(function () { cb(snapDoc(c, id)); }, function (e) { if (err) err(e); });
          return function () { subsDoc[k] = (subsDoc[k] || []).filter(function (f) { return f !== cb; }); };
        },
      };
    },
  };

  // ---------------- planillas y Drive ----------------
  var mcp = {
    callTool: async function (server, tool, input) {
      var accion = /Sheets/i.test(server) ? 'sheetsProxy' : /Drive/i.test(server) ? 'driveProxy' : '';
      if (!accion) throw { code: 'not_in_manifest', message: 'Servicio no disponible: ' + server };
      return { payload: await api(accion, [tool, input]) };
    },
  };

  // ---------------- descargas ----------------
  var downloads = {
    save: async function (o) {
      var blob = o.data instanceof Blob ? o.data : new Blob([o.data]);
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = o.filename || 'archivo'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return { status: 'saved' };
    },
  };

  window.claude = {
    use: async function (n) {
      if (n === 'db') return db;
      if (n === 'mcp') return mcp;
      if (n === 'downloads') return downloads;
      return null;
    },
  };
  window.SISTEMA_WEB = true;
})();
