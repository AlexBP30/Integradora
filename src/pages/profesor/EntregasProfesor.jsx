import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './EntregasProfesor.css'

const BUCKET = 'entregas-estudiantes'
const ESTADOS = {
  entregada: 'Entregada',
  en_revision: 'En revisión',
  calificada: 'Calificada',
  correccion_solicitada: 'Corrección solicitada'
}

function EntregasProfesor({ usuario }) {
  const [grupos, setGrupos] = useState([])
  const [grupoId, setGrupoId] = useState('')
  const [actividades, setActividades] = useState([])
  const [actividadId, setActividadId] = useState('')
  const [entregas, setEntregas] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [cargandoGrupos, setCargandoGrupos] = useState(true)
  const [cargandoEntregas, setCargandoEntregas] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [estado, setEstado] = useState('en_revision')
  const [calificacion, setCalificacion] = useState('')
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [abriendoId, setAbriendoId] = useState(null)

  const cargarGrupos = useCallback(async () => {
    if (!usuario?.id) return
    setCargandoGrupos(true)
    setError('')
    const { data, error: fallo } = await supabase
      .from('grupos')
      .select('id, nombre, materia')
      .eq('profesor_id', usuario.id)
      .order('created_at', { ascending: false })
    if (fallo) setError('No se pudieron cargar tus grupos: ' + fallo.message)
    else {
      setGrupos(data || [])
      setGrupoId(actual => (data || []).some(g => String(g.id) === actual) ? actual : String(data?.[0]?.id || ''))
    }
    setCargandoGrupos(false)
  }, [usuario?.id])

  useEffect(() => { cargarGrupos() }, [cargarGrupos])

  useEffect(() => {
    let vigente = true
    async function cargar() {
      setActividades([])
      setActividadId('')
      setEntregas([])
      setAlumnos([])
      setEditandoId(null)
      if (!grupoId) return
      setError('')
      const [{ data, error: fallo }, { data: estudiantes, error: falloAlumnos }] = await Promise.all([
        supabase.from('actividades')
          .select('id, titulo, puntos_maximos, fecha_entrega')
          .eq('grupo_id', Number(grupoId))
          .order('created_at', { ascending: false }),
        supabase.rpc('obtener_alumnos_grupo', { p_grupo_id: Number(grupoId) })
      ])
      if (!vigente) return
      if (fallo) setError('No se pudieron cargar las actividades: ' + fallo.message)
      else {
        setActividades(data || [])
        setActividadId(String(data?.[0]?.id || ''))
      }
      if (falloAlumnos) setError(actual => [actual, 'No se pudieron cargar los alumnos: ' + falloAlumnos.message].filter(Boolean).join(' '))
      else setAlumnos(estudiantes || [])
    }
    cargar()
    return () => { vigente = false }
  }, [grupoId])

  const cargarEntregas = useCallback(async () => {
    if (!actividadId) { setEntregas([]); return }
    setCargandoEntregas(true)
    setError('')
    const { data, error: fallo } = await supabase
      .from('entregas_actividades')
      .select('id, actividad_id, alumno_id, texto_entrega, archivo_ruta, estado, calificacion, comentario_profesor, updated_at, created_at')
      .eq('actividad_id', Number(actividadId))
      .order('created_at', { ascending: false })
    if (fallo) setError('No se pudieron cargar las entregas: ' + fallo.message)
    else setEntregas(data || [])
    setCargandoEntregas(false)
  }, [actividadId])

  useEffect(() => { cargarEntregas() }, [cargarEntregas])

  const actividadActual = actividades.find(a => String(a.id) === actividadId)
  const alumnoNombre = id => alumnos.find(a => a.alumno_id === id)?.nombre || 'Estudiante'

  function editar(entrega) {
    setEditandoId(entrega.id)
    setEstado(['en_revision', 'calificada', 'correccion_solicitada'].includes(entrega.estado) ? entrega.estado : 'en_revision')
    setCalificacion(entrega.calificacion == null ? '' : String(entrega.calificacion))
    setComentario(entrega.comentario_profesor || '')
    setError('')
    setMensaje('')
  }

  async function guardar(entrega) {
    if (guardando) return
    if (estado === 'calificada' && (calificacion.trim() === '' || !Number.isFinite(Number(calificacion)) || Number(calificacion) < 0 || Number(calificacion) > Number(actividadActual?.puntos_maximos))) {
      setError(`La calificación debe estar entre 0 y ${actividadActual?.puntos_maximos}.`)
      return
    }
    setGuardando(true)
    setError('')
    setMensaje('')
    const { error: fallo } = await supabase.rpc('revisar_entrega', {
      p_entrega_id: entrega.id,
      p_estado: estado,
      p_calificacion: estado === 'calificada' ? Number(calificacion) : null,
      p_comentario: comentario.trim() || null
    })
    if (fallo) setError('No se pudo guardar la revisión: ' + fallo.message)
    else {
      setMensaje('La revisión se guardó correctamente.')
      setEditandoId(null)
      await cargarEntregas()
    }
    setGuardando(false)
  }

  async function abrirArchivo(entrega) {
    if (!entrega.archivo_ruta) return
    const ventana = window.open('', '_blank')
    setAbriendoId(entrega.id)
    setError('')
    const { data, error: fallo } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(entrega.archivo_ruta, 60)
    if (fallo || !data?.signedUrl) {
      ventana?.close()
      setError('No se pudo abrir el archivo: ' + (fallo?.message || 'Enlace no disponible'))
    } else if (ventana) {
      ventana.opener = null
      ventana.location.href = data.signedUrl
    } else {
      setError('El navegador bloqueó la pestaña. Permite las ventanas emergentes para Study e inténtalo de nuevo.')
    }
    setAbriendoId(null)
  }

  return (
    <section className="ep-pagina">
      <div className="ep-encabezado">
        <div>
          <p className="ep-etiqueta">PANEL DOCENTE</p>
          <h1>📥 Entregas</h1>
          <p>Revisa los trabajos de tus estudiantes, califica y solicita correcciones.</p>
        </div>
        <button type="button" className="ep-boton ep-secundario" onClick={() => { cargarGrupos(); cargarEntregas() }} disabled={cargandoGrupos || cargandoEntregas}>↻ Actualizar</button>
      </div>

      {error && <p className="ep-error" role="alert">{error}</p>}
      {mensaje && <p className="ep-exito" role="status">{mensaje}</p>}

      {cargandoGrupos ? <p className="ep-vacio">Cargando grupos...</p> : grupos.length === 0 ? (
        <div className="ep-vacio">Todavía no tienes grupos creados.</div>
      ) : (
        <>
          <div className="ep-filtros">
            <label>Grupo
              <select value={grupoId} onChange={e => setGrupoId(e.target.value)}>
                {grupos.map(g => <option key={g.id} value={String(g.id)}>{g.materia} — {g.nombre}</option>)}
              </select>
            </label>
            <label>Actividad
              <select value={actividadId} onChange={e => { setActividadId(e.target.value); setEditandoId(null) }} disabled={!actividades.length}>
                {!actividades.length && <option value="">Sin actividades</option>}
                {actividades.map(a => <option key={a.id} value={String(a.id)}>{a.titulo}</option>)}
              </select>
            </label>
          </div>

          {!actividadId ? <div className="ep-vacio">Selecciona un grupo que tenga actividades publicadas.</div> : (
            <>
              <div className="ep-resumen">
                <strong>{entregas.length} {entregas.length === 1 ? 'entrega recibida' : 'entregas recibidas'}</strong>
                <span>Actividad: {actividadActual?.titulo} · Máximo {actividadActual?.puntos_maximos} puntos</span>
              </div>
              {cargandoEntregas ? <div className="ep-vacio">Cargando entregas...</div> : entregas.length === 0 ? (
                <div className="ep-vacio">Todavía no hay entregas para esta actividad.</div>
              ) : (
                <div className="ep-lista">
                  {entregas.map(entrega => (
                    <article className="ep-tarjeta" key={entrega.id}>
                      <div className="ep-tarjeta-cabecera">
                        <div>
                          <h2>🎓 {alumnoNombre(entrega.alumno_id)}</h2>
                          <small>Enviada: {new Date(entrega.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</small>
                        </div>
                        <span className={`ep-estado ep-estado-${entrega.estado}`}>{ESTADOS[entrega.estado] || entrega.estado}</span>
                      </div>

                      {entrega.texto_entrega && <div className="ep-respuesta"><strong>Respuesta escrita</strong><p>{entrega.texto_entrega}</p></div>}
                      {entrega.archivo_ruta && <button type="button" className="ep-boton ep-secundario" onClick={() => abrirArchivo(entrega)} disabled={abriendoId === entrega.id}>{abriendoId === entrega.id ? 'Abriendo...' : '📎 Ver archivo adjunto'}</button>}
                      {entrega.calificacion != null && <p><strong>Calificación:</strong> {entrega.calificacion} / {actividadActual?.puntos_maximos}</p>}
                      {entrega.comentario_profesor && <p className="ep-comentario"><strong>Comentario:</strong> {entrega.comentario_profesor}</p>}

                      {editandoId === entrega.id ? (
                        <div className="ep-formulario">
                          <h3>Revisar entrega</h3>
                          <label>Acción
                            <select value={estado} onChange={e => setEstado(e.target.value)} disabled={guardando}>
                              <option value="en_revision">Marcar en revisión</option>
                              <option value="calificada">Calificar</option>
                              <option value="correccion_solicitada">Solicitar corrección</option>
                            </select>
                          </label>
                          {estado === 'calificada' && <label>Calificación (0 a {actividadActual?.puntos_maximos})
                            <input type="number" min="0" max={actividadActual?.puntos_maximos} step="0.01" value={calificacion} onChange={e => setCalificacion(e.target.value)} disabled={guardando} placeholder="Ej. 9" />
                          </label>}
                          <label>Comentario del profesor
                            <textarea rows={3} value={comentario} onChange={e => setComentario(e.target.value)} disabled={guardando} placeholder="Escribe observaciones para el estudiante..." />
                          </label>
                          <div className="ep-acciones">
                            <button type="button" className="ep-boton ep-secundario" onClick={() => setEditandoId(null)} disabled={guardando}>Cancelar</button>
                            <button type="button" className="ep-boton ep-primario" onClick={() => guardar(entrega)} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar revisión'}</button>
                          </div>
                        </div>
                      ) : <button type="button" className="ep-boton ep-primario" onClick={() => editar(entrega)}>✏️ Revisar / calificar</button>}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

export default EntregasProfesor