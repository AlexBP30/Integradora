import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './AvisosEstudiante.css'

function AvisosEstudiante({ usuario, onAvisosActualizados }) {
  const [avisos, setAvisos] = useState([])
  const [idsLeidos, setIdsLeidos] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [marcandoId, setMarcandoId] = useState(null)

  const cargarAvisos = useCallback(async () => {
    if (!usuario?.id) {
      setAvisos([])
      setIdsLeidos(new Set())
      setCargando(false)
      return
    }

    setCargando(true)
    setError('')
    try {
      const { data: grupos, error: errorGrupos } = await supabase.rpc('obtener_mis_grupos')
      if (errorGrupos) throw errorGrupos

      const misGrupos = grupos || []
      const ids = misGrupos.map(grupo => grupo.id)
      if (ids.length === 0) {
        setAvisos([])
        setIdsLeidos(new Set())
        return
      }

      const [resultadoAvisos, resultadoLeidos] = await Promise.all([
        supabase.from('avisos')
          .select('id, grupo_id, titulo, contenido, created_at')
          .in('grupo_id', ids)
          .order('created_at', { ascending: false }),
        supabase.from('avisos_leidos')
          .select('aviso_id')
          .eq('alumno_id', usuario.id)
      ])

      if (resultadoAvisos.error) throw resultadoAvisos.error
      if (resultadoLeidos.error) throw resultadoLeidos.error

      const nombres = new Map(misGrupos.map(grupo => [String(grupo.id), grupo]))
      setAvisos((resultadoAvisos.data || []).map(aviso => ({
        ...aviso,
        grupo: nombres.get(String(aviso.grupo_id))
      })))
      setIdsLeidos(new Set((resultadoLeidos.data || []).map(item => String(item.aviso_id))))
      onAvisosActualizados?.()
    } catch (err) {
      setError('No se pudieron cargar los avisos: ' + (err.message || 'Error desconocido'))
      setAvisos([])
    } finally {
      setCargando(false)
    }
  }, [usuario?.id, onAvisosActualizados])

  useEffect(() => {
    cargarAvisos()
  }, [cargarAvisos])

  const marcarComoLeido = async avisoId => {
    if (!usuario?.id || idsLeidos.has(String(avisoId)) || marcandoId !== null) return
    setMarcandoId(avisoId)
    setError('')
    try {
      const { error: errorLectura } = await supabase
        .from('avisos_leidos')
        .insert({ aviso_id: avisoId, alumno_id: usuario.id })
      if (errorLectura) throw errorLectura
      setIdsLeidos(actual => new Set([...actual, String(avisoId)]))
      onAvisosActualizados?.()
    } catch (err) {
      setError('No se pudo marcar el aviso como leído: ' + (err.message || 'Error desconocido'))
    } finally {
      setMarcandoId(null)
    }
  }

  const formatearFecha = fecha => {
    if (!fecha) return 'Sin fecha'
    return new Date(fecha).toLocaleString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <section className="study-avisos">
      <div className="study-avisos-header">
        <div>
          <p className="study-avisos-eyebrow">COMUNICADOS DE TUS CLASES</p>
          <h1>🔔 Avisos</h1>
          <p>Consulta las publicaciones de los profesores de tus grupos.</p>
        </div>
        <button type="button" onClick={cargarAvisos} disabled={cargando} className="study-avisos-refresh">
          {cargando ? 'Actualizando...' : '↻ Actualizar'}
        </button>
      </div>

      {error && <p className="study-avisos-error" role="alert">{error}</p>}
      {cargando ? (
        <div className="study-avisos-empty">Cargando avisos...</div>
      ) : !error && avisos.length === 0 ? (
        <div className="study-avisos-empty">
          <span aria-hidden="true">📭</span>
          <h2>Aún no tienes avisos</h2>
          <p>Cuando tus profesores publiquen avisos en tus grupos, aparecerán aquí.</p>
        </div>
      ) : (
        <div className="study-avisos-list">
          {avisos.map(aviso => {
            const leido = idsLeidos.has(String(aviso.id))
            return (
              <article className="study-aviso-card" key={aviso.id} style={!leido ? { borderLeft: '4px solid #078b87' } : undefined}>
                <div className="study-aviso-top">
                  <span className="study-aviso-group">
                    📚 {[aviso.grupo?.materia, aviso.grupo?.nombre].filter(Boolean).join(' · ') || 'Tu grupo'}
                  </span>
                  <time dateTime={aviso.created_at}>{formatearFecha(aviso.created_at)}</time>
                </div>
                {!leido && <span style={{ display: 'inline-block', color: '#078b87', fontWeight: 700, marginTop: '8px' }}>● Nuevo · Sin leer</span>}
                <h2>{aviso.titulo}</h2>
                <p className="study-aviso-content">{aviso.contenido}</p>
                {!leido && (
                  <button type="button" className="study-avisos-refresh" disabled={marcandoId !== null} onClick={() => marcarComoLeido(aviso.id)} style={{ marginTop: '12px' }}>
                    {marcandoId === aviso.id ? 'Guardando...' : '✓ Marcar como leído'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default AvisosEstudiante