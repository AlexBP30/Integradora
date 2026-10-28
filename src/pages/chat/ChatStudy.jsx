
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './ChatStudy.css'

function ChatStudy({ usuario, rol, onMensajesSinLeer }) {
  const [conversaciones, setConversaciones] = useState([])
  const [seleccion, setSeleccion] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [pendientes, setPendientes] = useState({})
  const esProfesor = rol === 'profesor'

  const cargarConversaciones = useCallback(async () => {
    if (!usuario?.id) {
      setConversaciones([])
      setCargando(false)
      return
    }
    setCargando(true)
    setError('')
    try {
      if (!esProfesor) {
        const { data, error: fallo } = await supabase.rpc('obtener_mis_grupos')
        if (fallo) throw fallo
        setConversaciones((data || []).filter(g => g.profesor_id).map(g => ({
          clave: `${g.id}:${usuario.id}`,
          grupo_id: g.id,
          alumno_id: usuario.id,
          titulo: [g.materia, g.nombre].filter(Boolean).join(' · ') || `Grupo ${g.id}`,
          subtitulo: 'Chat con tu profesor'
        })))
      } else {
        const { data: grupos, error: falloGrupos } = await supabase
          .from('grupos').select('id, nombre, materia').eq('profesor_id', usuario.id)
        if (falloGrupos) throw falloGrupos
        const ids = (grupos || []).map(g => g.id)
        if (!ids.length) {
          setConversaciones([])
          return
        }
        const { data: inscripciones, error: falloAlumnos } = await supabase
          .from('grupo_alumnos').select('grupo_id, alumno_id').in('grupo_id', ids)
        if (falloAlumnos) throw falloAlumnos
        const porId = new Map((grupos || []).map(g => [String(g.id), g]))
        setConversaciones((inscripciones || []).map(ga => {
          const grupo = porId.get(String(ga.grupo_id))
          return {
            clave: `${ga.grupo_id}:${ga.alumno_id}`,
            grupo_id: ga.grupo_id,
            alumno_id: ga.alumno_id,
            titulo: `Alumno ${ga.alumno_id.slice(0, 8)}`,
            subtitulo: [grupo?.materia, grupo?.nombre].filter(Boolean).join(' · ') || `Grupo ${ga.grupo_id}`
          }
        }))
      }
    } catch (err) {
      setError('No se pudieron cargar las conversaciones: ' + err.message)
    } finally {
      setCargando(false)
    }
  }, [usuario?.id, esProfesor])

  const cargarPendientes = useCallback(async () => {
    if (!usuario?.id || !conversaciones.length) {
      setPendientes({})
      onMensajesSinLeer?.(0)
      return
    }
    try {
      const idsGrupos = [...new Set(conversaciones.map(c => c.grupo_id))]
      const { data, error: fallo } = await supabase
        .from('mensajes_chat')
        .select('grupo_id, alumno_id')
        .in('grupo_id', idsGrupos)
        .neq('remitente_id', usuario.id)
        .is('leido_at', null)
      if (fallo) throw fallo
      const clavesPermitidas = new Set(conversaciones.map(c => c.clave))
      const nuevos = {}
      for (const m of data || []) {
        const clave = `${m.grupo_id}:${m.alumno_id}`
        if (clavesPermitidas.has(clave)) nuevos[clave] = (nuevos[clave] || 0) + 1
      }
      setPendientes(nuevos)
      onMensajesSinLeer?.(Object.values(nuevos).reduce((suma, n) => suma + n, 0))
    } catch (err) {
      console.error('No se pudo cargar el contador de mensajes', err)
    }
  }, [usuario?.id, conversaciones, onMensajesSinLeer])

  const cargarMensajes = useCallback(async () => {
    if (!seleccion || !usuario?.id) {
      setMensajes([])
      return
    }
    const { data, error: fallo } = await supabase
      .from('mensajes_chat')
      .select('id, grupo_id, alumno_id, remitente_id, contenido, leido_at, created_at')
      .eq('grupo_id', seleccion.grupo_id)
      .eq('alumno_id', seleccion.alumno_id)
      .order('created_at', { ascending: true })
    if (fallo) {
      setError('No se pudieron cargar los mensajes: ' + fallo.message)
      return
    }
    setMensajes(data || [])
    const sinLeer = (data || [])
      .filter(m => m.remitente_id !== usuario.id && !m.leido_at)
      .map(m => m.id)
    if (sinLeer.length) {
      const { error: falloLectura } = await supabase.from('mensajes_chat')
        .update({ leido_at: new Date().toISOString() })
        .in('id', sinLeer)
      if (falloLectura) console.error('No se pudieron marcar mensajes leídos', falloLectura)
      else {
        setMensajes(actual => actual.map(m => sinLeer.includes(m.id) ? { ...m, leido_at: new Date().toISOString() } : m))
        await cargarPendientes()
      }
    }
  }, [seleccion, usuario?.id, cargarPendientes])

  useEffect(() => { cargarConversaciones() }, [cargarConversaciones])
  useEffect(() => { cargarPendientes() }, [cargarPendientes])
  useEffect(() => { cargarMensajes() }, [cargarMensajes])

  useEffect(() => {
    if (!usuario?.id) return
    const canal = supabase.channel(`chat-notificaciones-${usuario.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'mensajes_chat'
      }, () => {
        cargarPendientes()
        if (seleccion) cargarMensajes()
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [usuario?.id, seleccion, cargarPendientes, cargarMensajes])

  async function enviar(e) {
    e.preventDefault()
    const contenido = texto.trim()
    if (!seleccion || !contenido || enviando) return
    setEnviando(true)
    setError('')
    try {
      const { error: fallo } = await supabase.from('mensajes_chat').insert({
        grupo_id: seleccion.grupo_id,
        alumno_id: seleccion.alumno_id,
        remitente_id: usuario.id,
        contenido
      })
      if (fallo) throw fallo
      setTexto('')
      await cargarMensajes()
    } catch (err) {
      setError('No se pudo enviar: ' + err.message)
    } finally {
      setEnviando(false)
    }
  }

  const totalPendientes = Object.values(pendientes).reduce((suma, n) => suma + n, 0)
  const etiqueta = cantidad => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999,
    background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700,
    marginLeft: 8
  })

  return (
    <section className="study-chat">
      <header className="study-chat-header">
        <div>
          <h1>💬 Mensajes {totalPendientes > 0 && <span style={etiqueta(totalPendientes)}>{totalPendientes}</span>}</h1>
          <p>Conversaciones privadas de tus grupos.</p>
        </div>
        <button type="button" onClick={async () => { await cargarConversaciones(); await cargarPendientes() }}>↻ Actualizar</button>
      </header>
      {error && <p className="study-chat-error" role="alert">{error}</p>}
      <div className="study-chat-layout">
        <aside className="study-chat-contacts" aria-label="Conversaciones">
          <h2>Conversaciones</h2>
          {cargando ? <p>Cargando...</p> : conversaciones.length === 0 ? <p>No tienes conversaciones disponibles.</p> :
            conversaciones.map(c => (
              <button key={c.clave} type="button"
                className={seleccion?.clave === c.clave ? 'study-chat-contact selected' : 'study-chat-contact'}
                onClick={() => { setSeleccion(c); setError('') }}>
                <strong>{c.titulo}{pendientes[c.clave] > 0 && <span style={etiqueta(pendientes[c.clave])}>{pendientes[c.clave]}</span>}</strong>
                <small>{c.subtitulo}</small>
              </button>
            ))}
        </aside>
        <div className="study-chat-room">
          {!seleccion ? <p className="study-chat-placeholder">Selecciona una conversación para comenzar.</p> : <>
            <div className="study-chat-room-title"><strong>{seleccion.titulo}</strong><small>{seleccion.subtitulo}</small></div>
            <div className="study-chat-messages" aria-live="polite">
              {mensajes.length === 0 ? <p className="study-chat-placeholder">Todavía no hay mensajes. ¡Escribe el primero!</p> :
                mensajes.map(m => (
                  <div key={m.id} className={m.remitente_id === usuario.id ? 'study-chat-bubble mine' : 'study-chat-bubble'}>
                    <p>{m.contenido}</p>
                    <small>{new Date(m.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{m.remitente_id === usuario.id && m.leido_at ? ' · Leído' : ''}</small>
                  </div>
                ))}
            </div>
            <form className="study-chat-form" onSubmit={enviar}>
              <input aria-label="Escribe tu mensaje" maxLength={2000} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe un mensaje..." />
              <button type="submit" disabled={enviando || !texto.trim()}>{enviando ? 'Enviando...' : 'Enviar ➤'}</button>
            </form>
          </>}
        </div>
      </div>
    </section>
  )
}

export default ChatStudy
