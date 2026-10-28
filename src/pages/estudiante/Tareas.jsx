import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  alertaExito,
  alertaError,
  alertaConfirmacion
} from '../../utils/alertas'

function Tareas({ usuario }) {
  const [tareas, setTareas] = useState([])
  const [materias, setMaterias] = useState([])

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [tareaEditando, setTareaEditando] = useState(null)

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [materiaId, setMateriaId] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [prioridad, setPrioridad] = useState('media')

  const [modoOffline, setModoOffline] = useState(!navigator.onLine)
  const [hayCopiaLocal, setHayCopiaLocal] = useState(false)

  const guardarTareasLocales = (lista) => {
    if (!usuario?.id) return
    try {
      localStorage.setItem(`study_tareas_${usuario.id}`, JSON.stringify(lista))
    } catch (error) {
      console.error('No se pudo guardar la copia de tareas:', error)
    }
  }

  useEffect(() => {
    const actualizarConexion = () => setModoOffline(!navigator.onLine)
    window.addEventListener('online', actualizarConexion)
    window.addEventListener('offline', actualizarConexion)
    return () => {
      window.removeEventListener('online', actualizarConexion)
      window.removeEventListener('offline', actualizarConexion)
    }
  }, [])

  useEffect(() => {
    if (!usuario?.id) {
      setTareas([])
      setMaterias([])
      setHayCopiaLocal(false)
      return
    }

    let activo = true
    const cargarDatos = async () => {
      const claveTareas = `study_tareas_${usuario.id}`
      const claveMaterias = `study_materias_${usuario.id}`

      try {
        const tareasGuardadas = localStorage.getItem(claveTareas)
        const materiasGuardadas = localStorage.getItem(claveMaterias)
        if (tareasGuardadas !== null) {
          const lista = JSON.parse(tareasGuardadas)
          if (activo && Array.isArray(lista)) {
            setTareas(lista)
            setHayCopiaLocal(true)
          }
        }
        if (materiasGuardadas !== null) {
          const lista = JSON.parse(materiasGuardadas)
          if (activo && Array.isArray(lista)) setMaterias(lista)
        }
      } catch (error) {
        console.error('No se pudo leer la copia local:', error)
      }

      if (!navigator.onLine) {
        if (activo) setModoOffline(true)
        return
      }

      try {
        const { data: materiasData, error: materiasError } = await supabase
          .from('materias')
          .select('*')
          .eq('user_id', usuario.id)
          .order('nombre')
        if (materiasError) throw materiasError

        const { data: tareasData, error: tareasError } = await supabase
          .from('tareas')
          .select('*')
          .eq('user_id', usuario.id)
          .order('fecha_entrega', { ascending: true })
        if (tareasError) throw tareasError
        if (!activo) return

        const nuevasMaterias = materiasData || []
        const nuevasTareas = tareasData || []
        setMaterias(nuevasMaterias)
        setTareas(nuevasTareas)
        setHayCopiaLocal(true)
        setModoOffline(false)

        try {
          localStorage.setItem(claveMaterias, JSON.stringify(nuevasMaterias))
          localStorage.setItem(claveTareas, JSON.stringify(nuevasTareas))
        } catch (error) {
          console.error('No se pudo actualizar la copia local:', error)
        }
      } catch (error) {
        console.error('Sin conexión con Supabase al cargar tareas:', error)
        if (activo) setModoOffline(true)
      }
    }

    cargarDatos()
    return () => { activo = false }
  }, [usuario?.id])

  const requerirInternet = async () => {
    if (navigator.onLine && !modoOffline) return true
    await alertaError('Sin conexión', 'Necesitas internet para modificar tus tareas.')
    return false
  }


const guardarTarea = async (e) => {
  e.preventDefault()
  if (!(await requerirInternet())) return

  if (!usuario) {
    await alertaError(
      'Usuario no encontrado',
      'No pudimos identificar tu sesión.'
    )
    return
  }

  if (!materiaId) {
    await alertaError(
      'Selecciona una materia',
      'Debes elegir la materia a la que pertenece esta tarea.'
    )
    return
  }

  const nuevaTarea = {
    user_id: usuario.id,
    materia_id: Number(materiaId),
    titulo,
    descripcion,
    fecha_entrega: fechaEntrega,
    prioridad,
    estado: 'pendiente'
  }

  if (tareaEditando) {


  const { data, error } = await supabase
    .from('tareas')
    .update({
      materia_id: Number(materiaId),
      titulo,
      descripcion,
      fecha_entrega: fechaEntrega,
      prioridad
    })
    .eq('id', tareaEditando.id)
    .eq('user_id', usuario.id)
    .select()

  if (error) {
    await alertaError(
      'No pudimos actualizar la tarea',
      error.message
    )
    return
  }

  const tareaActualizada = data?.[0]

  if (tareaActualizada) {
    setTareas((anteriores) => {
      const siguientes = anteriores.map((tarea) =>
        tarea.id === tareaActualizada.id ? tareaActualizada : tarea
      )
      guardarTareasLocales(siguientes)
      return siguientes
    })
  }

  await alertaExito(
    '¡Tarea actualizada!',
    'Los cambios se guardaron correctamente.'
  )

} else {


  const { data, error } = await supabase
    .from('tareas')
    .insert([nuevaTarea])
    .select()

  if (error) {
    await alertaError(
      'No pudimos guardar la tarea',
      error.message
    )
    return
  }

  setTareas((anteriores) => {
    const siguientes = [...(data || []), ...anteriores]
    guardarTareasLocales(siguientes)
    return siguientes
  })

  await alertaExito(
    '¡Tarea agregada!',
    'Tu tarea se guardó correctamente.'
  )
}

  setTitulo('')
  setDescripcion('')
  setMateriaId('')
  setFechaEntrega('')
  setPrioridad('media')
  setMostrarFormulario(false)
  setTareaEditando(null)
}


const completarTarea = async (tarea) => {
  if (!(await requerirInternet())) return
  const nuevoEstado =
    tarea.estado === 'completada'
      ? 'pendiente'
      : 'completada'

  const { data, error } = await supabase
    .from('tareas')
    .update({
      estado: nuevoEstado
    })
    .eq('id', tarea.id)
    .eq('user_id', usuario.id)
    .select()

  if (error) {
    await alertaError(
      'No pudimos actualizar la tarea',
      error.message
    )
    return
  }

  const tareaActualizada = data?.[0]

  if (tareaActualizada) {
    setTareas((anteriores) => {
      const siguientes = anteriores.map((item) =>
        item.id === tareaActualizada.id ? tareaActualizada : item
      )
      guardarTareasLocales(siguientes)
      return siguientes
    })
  }

  if (nuevoEstado === 'completada') {
    await alertaExito(
      '¡Tarea completada!',
      'Muy bien, terminaste esta actividad.'
    )
  }
}

const editarTarea = async (tarea) => {
  if (!(await requerirInternet())) return
  setTareaEditando(tarea)

  setTitulo(tarea.titulo || '')
  setDescripcion(tarea.descripcion || '')
  setMateriaId(String(tarea.materia_id || ''))
  setFechaEntrega(tarea.fecha_entrega || '')
  setPrioridad(tarea.prioridad || 'media')

  setMostrarFormulario(true)

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

const eliminarTarea = async (tarea) => {
  if (!(await requerirInternet())) return
  const resultado = await alertaConfirmacion(
    '¿Eliminar tarea?',
    `¿Seguro que deseas eliminar "${tarea.titulo}"?`
  )

  if (!resultado.isConfirmed) return

  const { error } = await supabase
    .from('tareas')
    .delete()
    .eq('id', tarea.id)
    .eq('user_id', usuario.id)

  if (error) {
    await alertaError(
      'No pudimos eliminar la tarea',
      error.message
    )
    return
  }

  setTareas((anteriores) => {
    const siguientes = anteriores.filter((item) => item.id !== tarea.id)
    guardarTareasLocales(siguientes)
    return siguientes
  })

  await alertaExito(
    '¡Tarea eliminada!',
    `"${tarea.titulo}" fue eliminada correctamente.`
  )
}

const cerrarFormulario = () => {
  setTitulo('')
  setDescripcion('')
  setMateriaId('')
  setFechaEntrega('')
  setPrioridad('media')
  setTareaEditando(null)
  setMostrarFormulario(false)
}

const formatearFecha = (fecha) => {
  if (!fecha) return ''

  const [anio, mes, dia] = fecha.split('-')

  const fechaLocal = new Date(
    Number(anio),
    Number(mes) - 1,
    Number(dia)
  )

  return fechaLocal.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const obtenerEstadoFecha = (fecha, estado) => {
  if (!fecha || estado === 'completada') return null

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const [anio, mes, dia] = fecha.split('-')

  const fechaEntrega = new Date(
    Number(anio),
    Number(mes) - 1,
    Number(dia)
  )

  if (fechaEntrega < hoy) {
    return 'vencida'
  }

  if (fechaEntrega.getTime() === hoy.getTime()) {
    return 'hoy'
  }

  return null
}

return (
  <div className="materias-page">
      {modoOffline && (
        <div role="status" style={{
          padding: '12px 16px', marginBottom: '18px',
          background: '#fff3cd', color: '#795700',
          borderRadius: '10px', fontWeight: 600
        }}>
          📡 Sin conexión con Supabase. {hayCopiaLocal
            ? 'Estás viendo las tareas guardadas en este dispositivo.'
            : 'No hay tareas guardadas todavía en este dispositivo.'}
          {' '}Para realizar cambios necesitas internet.
        </div>
      )}


      <div className="materias-header">
  <div>
    <p className="dashboard-small-title">
      ORGANIZACIÓN ACADÉMICA
    </p>

    <h1>
      ✅ Mis tareas
    </h1>

    <p>
      Organiza tus actividades y fechas de entrega.
    </p>
  </div>

  <button
    className="add-task-button"
    onClick={async () => {
       if (!(await requerirInternet())) return
       setMostrarFormulario(true)
     }}
  >
    + Nueva tarea
  </button>
</div>

      {mostrarFormulario && (
  <div className="subject-form-card">

    <div className="form-card-header">
      <div>
        <h2>
          {tareaEditando ? 'Editar tarea' : 'Nueva tarea'}
        </h2>

        <p>
          Agrega la información de tu actividad.
        </p>
      </div>

      <button
        type="button"
        className="close-form-button"
        onClick={cerrarFormulario}
      >
        ✕ Cerrar
      </button>
    </div>

    <form
  className="subject-form"
  onSubmit={guardarTarea}
>

      <div className="form-group">
        <label>Título de la tarea</label>

        <input
          type="text"
          placeholder="Ej. Entregar proyecto final"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>Materia</label>

        <select
          value={materiaId}
          onChange={(e) => setMateriaId(e.target.value)}
          required
        >
          <option value="">
            Selecciona una materia
          </option>

          {materias.map((materia) => (
            <option
              key={materia.id}
              value={materia.id}
            >
              {materia.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Descripción</label>

        <textarea
          placeholder="Ej. Terminar presentación y subir el archivo..."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows="4"
        />
      </div>

      <div className="form-row">

        <div className="form-group">
          <label>Fecha de entrega</label>

          <input
            type="date"
            value={fechaEntrega}
            onChange={(e) => setFechaEntrega(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Prioridad</label>

          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value)}
          >
            <option value="baja">
              🟢 Baja
            </option>

            <option value="media">
              🟡 Media
            </option>

            <option value="alta">
              🔴 Alta
            </option>
          </select>
        </div>

      </div>

      <div className="form-actions">

        <button
          type="button"
          className="btn btn-secondary"
          onClick={cerrarFormulario}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="btn btn-primary"
        >
          {tareaEditando
            ? 'Guardar cambios'
            : 'Guardar tarea'}
        </button>

      </div>

    </form>

  </div>
)}

      {tareas.length === 0 ? (

  <div className="empty-state">
    <div className="empty-icon">✅</div>

    <h3>No tienes tareas pendientes</h3>

    <p>
      Agrega tu primera tarea para comenzar a organizarte.
    </p>
  </div>

) : (

  <div className="tasks-grid">

    {tareas.map((tarea) => {

      const materia = materias.find(
        (item) => item.id === tarea.materia_id
      )

      return (
        <div
            className={`task-card ${
                tarea.estado === 'completada'
                ? 'task-card-completed'
                : ''
            }`}
            key={tarea.id}
        >

          <div className="task-card-header">

            <div>
              <span
                className={`task-priority priority-${tarea.prioridad}`}
              >
                {tarea.prioridad === 'alta' && '🔴 Alta'}
                {tarea.prioridad === 'media' && '🟡 Media'}
                {tarea.prioridad === 'baja' && '🟢 Baja'}
              </span>

              <h3>{tarea.titulo}</h3>
            </div>

            <span
  className={`task-status ${
    tarea.estado === 'completada'
      ? 'task-status-completed'
      : ''
  }`}
>
  {tarea.estado === 'completada'
    ? '✓ Completada'
    : 'Pendiente'}
</span>

          </div>

          <div className="task-subject">
            📚 {materia?.nombre || 'Sin materia'}
          </div>

          {tarea.descripcion && (
            <p className="task-description">
              {tarea.descripcion}
            </p>
          )}

          <div
            className={`task-date ${
                obtenerEstadoFecha(tarea.fecha_entrega, tarea.estado) === 'vencida'
                ? 'task-date-overdue'
                : obtenerEstadoFecha(tarea.fecha_entrega, tarea.estado) === 'hoy'
                    ? 'task-date-today'
                    : ''
            }`}
            >
            📅 Entrega: {formatearFecha(tarea.fecha_entrega)}

            {obtenerEstadoFecha(tarea.fecha_entrega, tarea.estado) === 'vencida' && (
                <span> · ⚠️ Vencida</span>
            )}

            {obtenerEstadoFecha(tarea.fecha_entrega, tarea.estado) === 'hoy' && (
                <span> · ⏰ Vence hoy</span>
            )}
            </div>

          <div className="task-actions">

            <button
  type="button"
  className="task-complete-button"
  onClick={() => completarTarea(tarea)}
>
  {tarea.estado === 'completada'
    ? '↩ Marcar pendiente'
    : '✓ Completar'}
</button>

            <button
  type="button"
  className="task-edit-button"
  onClick={() => editarTarea(tarea)}
>
  ✏️ Editar
</button>

            <button
  type="button"
  className="task-delete-button"
  onClick={() => eliminarTarea(tarea)}
>
  🗑️ Eliminar
</button>

          </div>

        </div>
      )
    })}

  </div>

)}

    </div>
  )
}

export default Tareas