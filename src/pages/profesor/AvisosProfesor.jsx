import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './AvisosProfesor.css'

const inicial = { grupo_id: '', titulo: '', contenido: '' }

export default function AvisosProfesor({ usuario }) {
  const [grupos, setGrupos] = useState([])
  const [avisos, setAvisos] = useState([])
  const [formulario, setFormulario] = useState(inicial)
  const [editando, setEditando] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    if (!usuario?.id) return
    setCargando(true)
    setError('')
    try {
      const [gruposRes, avisosRes] = await Promise.all([
        supabase.from('grupos').select('id, nombre, materia').eq('profesor_id', usuario.id).order('nombre'),
        supabase.from('avisos').select('id, grupo_id, titulo, contenido, created_at').eq('profesor_id', usuario.id).order('created_at', { ascending: false })
      ])
      if (gruposRes.error) throw gruposRes.error
      if (avisosRes.error) throw avisosRes.error
      setGrupos(gruposRes.data || [])
      setAvisos(avisosRes.data || [])
    } catch (err) {
      setError(`No se pudieron cargar los avisos: ${err.message}`)
    } finally {
      setCargando(false)
    }
  }, [usuario?.id])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return
    setError('')
    setMensaje('')
    const grupoId = Number(formulario.grupo_id)
    if (!grupos.some(g => Number(g.id) === grupoId)) {
      setError('Selecciona uno de tus grupos.')
      return
    }
    const titulo = formulario.titulo.trim()
    const contenido = formulario.contenido.trim()
    if (!titulo || !contenido) {
      setError('Escribe el título y el contenido del aviso.')
      return
    }
    setGuardando(true)
    try {
      const datos = { grupo_id: grupoId, titulo, contenido }
      const resultado = editando !== null
        ? await supabase.from('avisos').update(datos).eq('id', editando).eq('profesor_id', usuario.id).select('id')
        : await supabase.from('avisos').insert({ ...datos, profesor_id: usuario.id }).select('id')
      if (resultado.error) throw resultado.error
      if (!resultado.data?.length) throw new Error('No se pudo guardar el aviso. Verifica los permisos del grupo.')
      setMensaje(editando !== null ? 'Aviso actualizado correctamente.' : 'Aviso publicado correctamente.')
      setFormulario(inicial)
      setEditando(null)
      await cargar()
    } catch (err) {
      setError(`No se pudo guardar el aviso: ${err.message}`)
    } finally {
      setGuardando(false)
    }
  }

  const empezarEdicion = (aviso) => {
    setEditando(aviso.id)
    setFormulario({ grupo_id: String(aviso.grupo_id), titulo: aviso.titulo, contenido: aviso.contenido })
    setError('')
    setMensaje('')
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const eliminar = async (aviso) => {
    if (!window.confirm(`¿Eliminar el aviso «${aviso.titulo}»?`)) return
    setError('')
    setMensaje('')
    const { data, error: fallo } = await supabase.from('avisos')
      .delete().eq('id', aviso.id).eq('profesor_id', usuario.id).select('id')
    if (fallo) {
      setError(`No se pudo eliminar: ${fallo.message}`)
      return
    }
    if (!data?.length) {
      setError('No se pudo eliminar el aviso. Verifica tus permisos.')
      return
    }
    if (editando === aviso.id) { setEditando(null); setFormulario(inicial) }
    setMensaje('Aviso eliminado correctamente.')
    await cargar()
  }

  const nombreGrupo = (id) => {
    const grupo = grupos.find(g => Number(g.id) === Number(id))
    return grupo ? `${grupo.materia} · ${grupo.nombre}` : 'Grupo'
  }

  return (
    <section className="avisos-profesor">
      <header className="avisos-profesor-encabezado">
        <div>
          <p className="avisos-profesor-etiqueta">COMUNICADOS DE TUS CLASES</p>
          <h1>🔔 Avisos</h1>
          <p>Publica comunicados para los estudiantes de tus grupos.</p>
        </div>
        <button type="button" className="avisos-profesor-secundario" onClick={cargar} disabled={cargando}>↻ Actualizar</button>
      </header>

      {error && <p className="avisos-profesor-error" role="alert">{error}</p>}
      {mensaje && <p className="avisos-profesor-exito" role="status">{mensaje}</p>}

      <form className="avisos-profesor-panel" onSubmit={guardar}>
        <h2>{editando !== null ? 'Editar aviso' : 'Nuevo aviso'}</h2>
        <label htmlFor="aviso-grupo">Grupo</label>
        <select id="aviso-grupo" value={formulario.grupo_id} onChange={e => setFormulario(f => ({ ...f, grupo_id: e.target.value }))} required>
          <option value="">Selecciona un grupo</option>
          {grupos.map(g => <option key={g.id} value={g.id}>{g.materia} · {g.nombre}</option>)}
        </select>
        <label htmlFor="aviso-titulo">Título</label>
        <input id="aviso-titulo" type="text" maxLength={150} value={formulario.titulo} onChange={e => setFormulario(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej. Cambio de horario" required />
        <label htmlFor="aviso-contenido">Contenido</label>
        <textarea id="aviso-contenido" rows={5} value={formulario.contenido} onChange={e => setFormulario(f => ({ ...f, contenido: e.target.value }))} placeholder="Escribe el comunicado para tus estudiantes..." required />
        <div className="avisos-profesor-acciones">
          <button className="avisos-profesor-principal" type="submit" disabled={guardando || !grupos.length}>{guardando ? 'Guardando...' : editando !== null ? 'Guardar cambios' : 'Publicar aviso'}</button>
          {editando !== null && <button type="button" className="avisos-profesor-secundario" onClick={() => { setEditando(null); setFormulario(inicial); setError('') }}>Cancelar edición</button>}
        </div>
        {!cargando && grupos.length === 0 && <p>Primero crea un grupo en «Mis grupos» para publicar avisos.</p>}
      </form>

      <div className="avisos-profesor-lista">
        <h2>Mis avisos publicados</h2>
        {cargando ? <p>Cargando avisos...</p> : avisos.length === 0 ? <div className="avisos-profesor-vacio">📭 Aún no has publicado avisos.</div> : (
          <div className="avisos-profesor-tarjetas">
            {avisos.map(aviso => (
              <article key={aviso.id} className="avisos-profesor-tarjeta">
                <div className="avisos-profesor-meta">{nombreGrupo(aviso.grupo_id)} · {new Date(aviso.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <h3>{aviso.titulo}</h3>
                <p>{aviso.contenido}</p>
                <div className="avisos-profesor-acciones">
                  <button type="button" className="avisos-profesor-secundario" onClick={() => empezarEdicion(aviso)}>Editar</button>
                  <button type="button" className="avisos-profesor-eliminar" onClick={() => eliminar(aviso)}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}