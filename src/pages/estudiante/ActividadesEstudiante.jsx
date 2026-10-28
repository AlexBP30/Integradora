import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import EntregaActividad from './EntregaActividad'
import './ActividadesEstudiante.css'

const FILTROS = [
  { id: 'todas', icono: '📋', nombre: 'Todas' },
  { id: 'pendientes', icono: '⏳', nombre: 'Pendientes' },
  { id: 'entregadas', icono: '📤', nombre: 'Entregadas' },
  { id: 'calificadas', icono: '🏅', nombre: 'Calificadas' },
  { id: 'correcciones', icono: '🔄', nombre: 'Por corregir' }
]

function estadoActividad(entrega) {
  if (!entrega) return 'pendientes'
  if (entrega.estado === 'calificada') return 'calificadas'
  if (entrega.estado === 'correccion_solicitada') return 'correcciones'
  return 'entregadas' 
}

function ActividadesEstudiante({ usuario }) {
  const [grupos, setGrupos] = useState([])
  const [actividades, setActividades] = useState([])
  const [entregas, setEntregas] = useState({})
  const [grupoId, setGrupoId] = useState('todos')
  const [filtro, setFiltro] = useState('todas')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abriendoId, setAbriendoId] = useState(null)
  const [actividadAbierta, setActividadAbierta] = useState(null)

  const cargarActividades = useCallback(async () => {
    if (!usuario?.id) {
      setGrupos([])
      setActividades([])
      setEntregas({})
      setCargando(false)
      return
    }

    setCargando(true)
    setError('')

    try {
      const { data: misGrupos, error: errorGrupos } =
        await supabase.rpc('obtener_mis_grupos')
      if (errorGrupos) throw errorGrupos

      const listaGrupos = misGrupos || []
      setGrupos(listaGrupos)

      if (!listaGrupos.length) {
        setActividades([])
        setEntregas({})
        return
      }

      const { data, error: errorActividades } = await supabase
        .from('actividades')
        .select('id, grupo_id, titulo, descripcion, fecha_entrega, puntos_maximos, tipo_publicacion, archivo_ruta, created_at')
        .in('grupo_id', listaGrupos.map(g => g.id))
        .order('fecha_entrega', { ascending: true })

      if (errorActividades) throw errorActividades
      const listaActividades = data || []
      setActividades(listaActividades)

      if (!listaActividades.length) {
        setEntregas({})
        return
      }

      const { data: misEntregas, error: errorEntregas } = await supabase
        .from('entregas_actividades')
        .select('id, actividad_id, estado')
        .eq('alumno_id', usuario.id)
        .in('actividad_id', listaActividades.map(a => a.id))

      if (errorEntregas) throw errorEntregas
      setEntregas(Object.fromEntries((misEntregas || []).map(e => [String(e.actividad_id), e])))
    } catch (fallo) {
      setError('No se pudieron cargar las actividades: ' + fallo.message)
    } finally {
      setCargando(false)
    }
  }, [usuario?.id])

  useEffect(() => {
    cargarActividades()
  }, [cargarActividades])

  async function abrirArchivo(actividad) {
    if (!actividad.archivo_ruta) return
    const ventana = window.open('', '_blank')
    setAbriendoId(actividad.id)
    setError('')

    try {
      const { data, error: errorArchivo } = await supabase.storage
        .from('actividades-archivos')
        .createSignedUrl(actividad.archivo_ruta, 60)

      if (errorArchivo || !data?.signedUrl) {
        throw new Error(errorArchivo?.message || 'Enlace no disponible')
      }

      if (ventana) {
        ventana.opener = null
        ventana.location.href = data.signedUrl
      } else {
        window.location.assign(data.signedUrl)
      }
    } catch (fallo) {
      ventana?.close()
      setError('No se pudo abrir el archivo: ' + fallo.message)
    } finally {
      setAbriendoId(null)
    }
  }

  function alternarEntrega(id) {
    setActividadAbierta(actual => actual === id ? null : id)
  }

  function nombreGrupo(id) {
    const grupo = grupos.find(g => String(g.id) === String(id))
    return grupo ? `${grupo.materia} — ${grupo.nombre}` : 'Mi grupo'
  }

  const actividadesDelGrupo = grupoId === 'todos'
    ? actividades
    : actividades.filter(a => String(a.grupo_id) === grupoId)

  const conteos = Object.fromEntries(FILTROS.map(f => [f.id, 0]))
  conteos.todas = actividadesDelGrupo.length
  actividadesDelGrupo.forEach(a => {
    conteos[estadoActividad(entregas[String(a.id)])] += 1
  })

  const visibles = filtro === 'todas'
    ? actividadesDelGrupo
    : actividadesDelGrupo.filter(a => estadoActividad(entregas[String(a.id)]) === filtro)

  const etiquetas = {
    pendientes: 'Pendiente',
    entregadas: 'Entregada',
    calificadas: 'Calificada',
    correcciones: 'Corrección solicitada'
  }

  return (
    <section className="ae-pagina">
      <div className="ae-encabezado">
        <div>
          <p className="ae-etiqueta">PANEL DEL ESTUDIANTE</p>
          <h1>📝 Actividades</h1>
          <p>Consulta tus trabajos, entregas y calificaciones.</p>
        </div>
        <button type="button" className="ae-refrescar" onClick={cargarActividades} disabled={cargando}>
          ↻ Actualizar
        </button>
      </div>

      {error && <div className="ae-error" role="alert">{error}</div>}

      {cargando ? (
        <div className="ae-vacio">Cargando actividades...</div>
      ) : grupos.length === 0 ? (
        <div className="ae-vacio">
          <h2>👥 Todavía no estás inscrito en un grupo</h2>
          <p>Únete con el código de tu profesor para ver sus actividades.</p>
        </div>
      ) : (
        <>
          <div className="ae-filtros">
            <label htmlFor="ae-grupo">Mostrar actividades de</label>
            <select id="ae-grupo" value={grupoId} onChange={e => setGrupoId(e.target.value)}>
              <option value="todos">Todos mis grupos</option>
              {grupos.map(grupo => (
                <option key={grupo.id} value={String(grupo.id)}>
                  {grupo.materia} — {grupo.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="ae-filtros-estado" role="group" aria-label="Filtrar actividades por estado">
            {FILTROS.map(opcion => (
              <button
                key={opcion.id}
                type="button"
                className={`ae-filtro-estado ${filtro === opcion.id ? 'activo' : ''}`}
                onClick={() => setFiltro(opcion.id)}
                aria-pressed={filtro === opcion.id}
              >
                <span>{opcion.icono} {opcion.nombre}</span>
                <strong>{conteos[opcion.id]}</strong>
              </button>
            ))}
          </div>

          {visibles.length === 0 ? (
            <div className="ae-vacio">
              <h2>📭 No hay actividades en esta categoría</h2>
              <p>Prueba otro filtro o selecciona otro grupo.</p>
            </div>
          ) : (
            <div className="ae-lista">
              {visibles.map(actividad => {
                const vencida = new Date(actividad.fecha_entrega).getTime() < Date.now()
                const abierta = actividadAbierta === actividad.id
                const estado = estadoActividad(entregas[String(actividad.id)])

                return (
                  <article className="ae-tarjeta" key={actividad.id}>
                    <div className="ae-tarjeta-superior">
                      <span className="ae-grupo">📚 {nombreGrupo(actividad.grupo_id)}</span>
                      <span className={`ae-estado ${estado === 'pendientes' && vencida ? 'ae-vencida' : ''}`}>
                        {etiquetas[estado]}{estado === 'pendientes' && vencida ? ' · Fecha vencida' : ''}
                      </span>
                    </div>

                    <h2>{actividad.titulo}</h2>
                    {actividad.descripcion && <p className="ae-descripcion">{actividad.descripcion}</p>}

                    {actividad.tipo_publicacion === 'archivo' ? (
                      <div className="ae-archivo">
                        <span>📎 Actividad publicada como archivo</span>
                        {actividad.archivo_ruta ? (
                          <button type="button" onClick={() => abrirArchivo(actividad)} disabled={abriendoId === actividad.id}>
                            {abriendoId === actividad.id ? 'Abriendo...' : '📄 Ver archivo adjunto'}
                          </button>
                        ) : <p>El profesor aún no ha adjuntado un archivo.</p>}
                      </div>
                    ) : (
                      <span className="ae-tipo">✍️ Actividad publicada como texto</span>
                    )}

                    <div className="ae-detalles">
                      <span>📅 Entrega: {new Date(actividad.fecha_entrega).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      <span>🎯 Puntos máximos: {actividad.puntos_maximos}</span>
                    </div>

                    <div style={{ marginTop: '22px' }}>
                      <button
                        type="button"
                        className="ae-refrescar"
                        onClick={() => alternarEntrega(actividad.id)}
                        aria-expanded={abierta}
                      >
                        {abierta ? '✕ Cerrar entrega' : '📤 Ver / entregar actividad'}
                      </button>
                    </div>

                    {abierta && (
                      <div style={{ marginTop: '20px' }}>
                        <EntregaActividad
                          actividad={actividad}
                          usuario={usuario}
                          onEntregaGuardada={guardada => {
                            setEntregas(actual => ({
                              ...actual,
                              [String(actividad.id)]: {
                                id: guardada.id,
                                actividad_id: actividad.id,
                                estado: guardada.estado
                              }
                            }))
                          }}
                        />
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default ActividadesEstudiante