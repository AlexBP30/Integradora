import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { alertaExito, alertaError, alertaConfirmacion } from '../../utils/alertas'
import './ActividadesProfesor.css'

const inicial = { titulo: '', descripcion: '', fecha_entrega: '', puntos_maximos: '10', tipo_publicacion: 'texto', archivo_ruta: '' }
const BUCKET = 'actividades-archivos'
const MAX_BYTES = 10 * 1024 * 1024
const EXTENSIONES = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp']

const fechaLocal = (valor) => {
  if (!valor) return ''
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const mostrarFecha = (valor) =>
  new Date(valor).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

function ActividadesProfesor({ usuario }) {
  const [grupos, setGrupos] = useState([])
  const [grupoId, setGrupoId] = useState('')
  const [actividades, setActividades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [formularioVisible, setFormularioVisible] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formulario, setFormulario] = useState(inicial)
  const [archivo, setArchivo] = useState(null)

  useEffect(() => {
    let activo = true
    const cargarGrupos = async () => {
      if (!usuario?.id) { setCargando(false); return }
      const { data, error } = await supabase
        .from('grupos')
        .select('id, nombre, materia')
        .eq('profesor_id', usuario.id)
        .order('created_at', { ascending: false })
      if (!activo) return
      if (error) await alertaError('No se pudieron cargar los grupos', error.message)
      else {
        setGrupos(data || [])
        setGrupoId((actual) => (data || []).some((g) => String(g.id) === actual)
          ? actual : String(data?.[0]?.id || ''))
      }
      setCargando(false)
    }
    cargarGrupos()
    return () => { activo = false }
  }, [usuario?.id])

  useEffect(() => {
    let activo = true
    const cargarActividades = async () => {
      setActividades([])
      if (!grupoId) return
      setCargando(true)
      const { data, error } = await supabase
        .from('actividades')
        .select('id, grupo_id, titulo, descripcion, fecha_entrega, puntos_maximos, tipo_publicacion, archivo_ruta, created_at')
        .eq('grupo_id', grupoId)
        .order('fecha_entrega', { ascending: true })
      if (!activo) return
      if (error) await alertaError('No se pudieron cargar las actividades', error.message)
      else setActividades(data || [])
      setCargando(false)
    }
    cargarActividades()
    return () => { activo = false }
  }, [grupoId])

  const cambiarGrupo = (id) => {
    setGrupoId(id)
    setFormularioVisible(false)
    setEditandoId(null)
    setFormulario(inicial)
    setArchivo(null)
  }

  const nuevaActividad = () => {
    setEditandoId(null)
    setFormulario(inicial)
    setFormularioVisible(true)
  }

  const editarActividad = (actividad) => {
    setEditandoId(actividad.id)
    setFormulario({
      titulo: actividad.titulo || '',
      descripcion: actividad.descripcion || '',
      fecha_entrega: fechaLocal(actividad.fecha_entrega),
      puntos_maximos: String(actividad.puntos_maximos),
      tipo_publicacion: actividad.tipo_publicacion || 'texto',
      archivo_ruta: actividad.archivo_ruta || ''
    })
    setArchivo(null)
    setFormularioVisible(true)
  }

  const cerrarFormulario = () => {
    setFormularioVisible(false)
    setEditandoId(null)
    setFormulario(inicial)
    setArchivo(null)
  }

  const seleccionarArchivo = async (evento) => {
    const elegido = evento.target.files?.[0] || null
    if (!elegido) { setArchivo(null); return }
    const extension = elegido.name.split('.').pop()?.toLowerCase()
    if (!EXTENSIONES.includes(extension) || elegido.size > MAX_BYTES) {
      evento.target.value = ''
      setArchivo(null)
      await alertaError('Archivo no permitido', 'Selecciona PDF, Word o imagen (JPG, PNG, WEBP) de máximo 10 MB.')
      return
    }
    setArchivo(elegido)
  }

  const descargarArchivo = async (ruta) => {
    if (!ruta) return
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 60)
    if (error || !data?.signedUrl) {
      await alertaError('No se pudo abrir el archivo', error?.message || 'Inténtalo nuevamente.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const guardarActividad = async (evento) => {
    evento.preventDefault()
    if (guardando || !grupoId) return
    const titulo = formulario.titulo.trim()
    const fecha = new Date(formulario.fecha_entrega)
    const puntos = Number(formulario.puntos_maximos)
    const esArchivo = formulario.tipo_publicacion === 'archivo'
    if (!titulo || !formulario.fecha_entrega || Number.isNaN(fecha.getTime()) ||
        !Number.isFinite(puntos) || puntos <= 0) {
      await alertaError('Revisa los datos', 'Escribe un título, una fecha válida y puntos mayores a cero.')
      return
    }
    if (esArchivo && !archivo && !formulario.archivo_ruta) {
      await alertaError('Falta el archivo', 'Selecciona un documento o imagen para publicar la actividad.')
      return
    }

    setGuardando(true)
    let rutaNueva = null
    let rutaFinal = esArchivo ? formulario.archivo_ruta || null : null
    try {
      if (esArchivo && archivo) {
        const extension = archivo.name.split('.').pop().toLowerCase()
        const identificador = crypto.randomUUID()
        rutaNueva = `grupos/${grupoId}/${identificador}.${extension}`
        const { error: errorSubida } = await supabase.storage
          .from(BUCKET).upload(rutaNueva, archivo, { upsert: false, contentType: archivo.type || undefined })
        if (errorSubida) throw errorSubida
        rutaFinal = rutaNueva
      }

      const datos = {
        titulo,
        descripcion: esArchivo ? formulario.descripcion.trim() : formulario.descripcion.trim(),
        fecha_entrega: fecha.toISOString(),
        puntos_maximos: puntos,
        tipo_publicacion: formulario.tipo_publicacion,
        archivo_ruta: rutaFinal
      }
      const consulta = editandoId
        ? supabase.from('actividades').update(datos).eq('id', editandoId).eq('grupo_id', grupoId)
        : supabase.from('actividades').insert({ ...datos, grupo_id: Number(grupoId) })
      const { data, error } = await consulta.select().single()
      if (error) throw error

      const anterior = actividades.find((a) => a.id === editandoId)
      if (anterior?.archivo_ruta && anterior.archivo_ruta !== rutaFinal) {
        const { error: errorLimpieza } = await supabase.storage.from(BUCKET).remove([anterior.archivo_ruta])
        if (errorLimpieza) console.warn('No se pudo borrar el archivo anterior:', errorLimpieza.message)
      }
      setActividades((anteriores) => {
        const lista = editandoId
          ? anteriores.map((a) => a.id === data.id ? data : a)
          : [...anteriores, data]
        return lista.sort((a, b) => new Date(a.fecha_entrega) - new Date(b.fecha_entrega))
      })
      cerrarFormulario()
      await alertaExito(editandoId ? 'Actividad actualizada' : 'Actividad creada', 'Los cambios se guardaron correctamente.')
    } catch (error) {
      if (rutaNueva) {
        await supabase.storage.from(BUCKET).remove([rutaNueva])
      }
      await alertaError('No se pudo guardar la actividad', error.message || 'Inténtalo nuevamente.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminarActividad = async (actividad) => {
    const confirmacion = await alertaConfirmacion(
      '¿Eliminar actividad?',
      `Se eliminará "${actividad.titulo}". Esta acción no se puede deshacer.`
    )
    if (!confirmacion?.isConfirmed) return
    const { error } = await supabase.from('actividades')
      .delete().eq('id', actividad.id).eq('grupo_id', grupoId)
    if (error) {
      await alertaError('No se pudo eliminar', error.message)
      return
    }
    setActividades((anteriores) => anteriores.filter((a) => a.id !== actividad.id))
    if (actividad.archivo_ruta) {
      const { error: errorArchivo } = await supabase.storage.from(BUCKET).remove([actividad.archivo_ruta])
      if (errorArchivo) console.warn('No se pudo borrar el archivo:', errorArchivo.message)
    }
    await alertaExito('Actividad eliminada', 'La actividad se eliminó correctamente.')
  }

  const grupo = grupos.find((g) => String(g.id) === grupoId)

  return (
    <section className="ap-page">
      <div className="profesor-page-heading">
        <p className="profesor-eyebrow">PANEL DOCENTE</p>
        <h1>📝 Actividades</h1>
        <p>Crea y administra las actividades de tus grupos.</p>
      </div>

      <div className="ap-toolbar">
        <div className="ap-selector">
          <label htmlFor="ap-grupo">Selecciona un grupo</label>
          <select id="ap-grupo" value={grupoId} onChange={(e) => cambiarGrupo(e.target.value)} disabled={!grupos.length}>
            {!grupos.length && <option value="">No tienes grupos</option>}
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.materia} — {g.nombre}</option>)}
          </select>
        </div>
        {grupoId && <button type="button" className="ap-primary" onClick={nuevaActividad}>+ Nueva actividad</button>}
      </div>

      {formularioVisible && (
        <form className="ap-form" onSubmit={guardarActividad}>
          <div className="ap-form-heading">
            <h2>{editandoId ? 'Editar actividad' : 'Nueva actividad'}</h2>
            <button type="button" className="ap-text-button" onClick={cerrarFormulario}>✕ Cerrar</button>
          </div>
          <p className="ap-hint">Grupo: {grupo?.materia} — {grupo?.nombre}</p>
          <div className="ap-fields">
            <label className="ap-full">Título de la actividad
              <input type="text" required maxLength={160} placeholder="Ej. Ejercicios de álgebra" value={formulario.titulo} onChange={(e) => setFormulario({ ...formulario, titulo: e.target.value })} />
            </label>
            <div className="ap-full ap-publish-mode">
              <span className="ap-mode-label">¿Cómo deseas publicar la actividad?</span>
              <div className="ap-mode-options">
                <label><input type="radio" name="tipo-publicacion" checked={formulario.tipo_publicacion === 'texto'} onChange={() => { setFormulario({ ...formulario, tipo_publicacion: 'texto' }); setArchivo(null) }} /> ✍️ Escribir como texto</label>
                <label><input type="radio" name="tipo-publicacion" checked={formulario.tipo_publicacion === 'archivo'} onChange={() => setFormulario({ ...formulario, tipo_publicacion: 'archivo' })} /> 📎 Subir como archivo</label>
              </div>
            </div>
            {formulario.tipo_publicacion === 'texto' ? (
              <label className="ap-full">Instrucciones de la actividad
                <textarea rows={4} required placeholder="Escribe aquí la actividad que verán los estudiantes" value={formulario.descripcion} onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })} />
              </label>
            ) : (
              <>
                <label className="ap-full">Archivo de la actividad (PDF, Word o imagen; máximo 10 MB)
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={seleccionarArchivo} />
                </label>
                {archivo && <p className="ap-full ap-file-note">📎 Nuevo archivo: {archivo.name}</p>}
                {!archivo && formulario.archivo_ruta && (
                  <div className="ap-full ap-file-note">📎 Archivo actual guardado. <button type="button" className="ap-file-link" onClick={() => descargarArchivo(formulario.archivo_ruta)}>Ver archivo</button></div>
                )}
                <label className="ap-full">Indicaciones adicionales (opcional)
                  <textarea rows={3} placeholder="Ej. Resuelve los ejercicios del documento" value={formulario.descripcion} onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })} />
                </label>
              </>
            )}
            <label>Fecha y hora de entrega
              <input type="datetime-local" required value={formulario.fecha_entrega} onChange={(e) => setFormulario({ ...formulario, fecha_entrega: e.target.value })} />
            </label>
            <label>Puntos máximos
              <input type="number" required min="0.1" step="0.1" value={formulario.puntos_maximos} onChange={(e) => setFormulario({ ...formulario, puntos_maximos: e.target.value })} />
            </label>
          </div>
          <div className="ap-form-actions">
            <button type="button" className="ap-secondary" onClick={cerrarFormulario}>Cancelar</button>
            <button type="submit" className="ap-primary" disabled={guardando}>{guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear actividad'}</button>
          </div>
        </form>
      )}

      {!grupoId ? (
        <div className="ap-empty">👥<h2>Aún no tienes grupos</h2><p>Crea un grupo desde Mis grupos para comenzar a asignar actividades.</p></div>
      ) : cargando ? (
        <div className="ap-empty"><p>Cargando actividades...</p></div>
      ) : actividades.length === 0 ? (
        <div className="ap-empty">📝<h2>Sin actividades todavía</h2><p>Crea la primera actividad para {grupo?.materia}.</p></div>
      ) : (
        <div className="ap-grid">
          {actividades.map((actividad) => {
            const vencida = new Date(actividad.fecha_entrega).getTime() < Date.now()
            return (
              <article className="ap-card" key={actividad.id}>
                <div className="ap-card-top">
                  <span className={vencida ? 'ap-status ap-expired' : 'ap-status'}>{vencida ? 'Fecha vencida' : 'Asignada'}</span>
                  <div className="ap-card-actions">
                    <button type="button" onClick={() => editarActividad(actividad)} title="Editar actividad" aria-label={`Editar ${actividad.titulo}`}>✏️</button>
                    <button type="button" onClick={() => eliminarActividad(actividad)} title="Eliminar actividad" aria-label={`Eliminar ${actividad.titulo}`}>🗑️</button>
                  </div>
                </div>
                <h2>{actividad.titulo}</h2>
                <p className="ap-description">{actividad.descripcion || (actividad.tipo_publicacion === 'archivo' ? 'Actividad adjunta en archivo.' : 'Sin instrucciones adicionales.')}</p>
                <p className="ap-kind">{actividad.tipo_publicacion === 'archivo' ? '📎 Publicada como archivo' : '✍️ Publicada como texto'}</p>
                {actividad.archivo_ruta && (
                  <button type="button" className="ap-file-link" onClick={() => descargarArchivo(actividad.archivo_ruta)}>📄 Ver archivo adjunto</button>
                )}
                <div className="ap-details">
                  <span>📅 Entrega: {mostrarFecha(actividad.fecha_entrega)}</span>
                  <span>🎯 Puntos máximos: {actividad.puntos_maximos}</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default ActividadesProfesor