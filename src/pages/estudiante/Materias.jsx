import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  alertaExito,
  alertaError,
  alertaConfirmacion
} from '../../utils/alertas'

function Materias({ usuario }) {
  const [materias, setMaterias] = useState([])
  const [grupos, setGrupos] = useState([])

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [materiaEditando, setMateriaEditando] = useState(null)

  const [nombre, setNombre] = useState('')
  const [profesor, setProfesor] = useState('')
  const [aula, setAula] = useState('')
  const [dias, setDias] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [color, setColor] = useState('#078b87')

  const [modoOffline, setModoOffline] = useState(
    !navigator.onLine
  )


  const claveMaterias = usuario?.id
    ? `study_materias_${usuario.id}`
    : null

  const claveGrupos = usuario?.id
    ? `study_grupos_${usuario.id}`
    : null


  const guardarMateriasLocales = (lista) => {
    if (!claveMaterias) return

    try {
      localStorage.setItem(
        claveMaterias,
        JSON.stringify(lista)
      )
    } catch (error) {
      console.error(
        'No se pudo guardar la copia local de materias:',
        error
      )
    }
  }

  const guardarGruposLocales = (lista) => {
    if (!claveGrupos) return

    try {
      localStorage.setItem(
        claveGrupos,
        JSON.stringify(lista)
      )
    } catch (error) {
      console.error(
        'No se pudo guardar la copia local de grupos:',
        error
      )
    }
  }


  useEffect(() => {
    const actualizarConexion = () => {
      setModoOffline(!navigator.onLine)
    }

    window.addEventListener('online', actualizarConexion)
    window.addEventListener('offline', actualizarConexion)

    return () => {
      window.removeEventListener('online', actualizarConexion)
      window.removeEventListener('offline', actualizarConexion)
    }
  }, [])


  useEffect(() => {
    if (!usuario?.id) {
      setMaterias([])
      setGrupos([])
      return
    }

    let activo = true

    const cargarMaterias = async () => {
      try {
        const materiasGuardadas = localStorage.getItem(
          `study_materias_${usuario.id}`
        )

        const gruposGuardados = localStorage.getItem(
          `study_grupos_${usuario.id}`
        )

        if (materiasGuardadas !== null) {
          const lista = JSON.parse(materiasGuardadas)

          if (activo && Array.isArray(lista)) {
            setMaterias(lista)
          }
        }

        if (gruposGuardados !== null) {
          const lista = JSON.parse(gruposGuardados)

          if (activo && Array.isArray(lista)) {
            setGrupos(lista)
          }
        }
      } catch (error) {
        console.error(
          'No se pudieron leer las materias locales:',
          error
        )
      }

      if (!navigator.onLine) {
        if (activo) setModoOffline(true)
        return
      }

      try {
        const { data, error } = await supabase
          .from('materias')
          .select('*')
          .eq('user_id', usuario.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        if (!activo) return

        const materiasActualizadas = data || []

        setMaterias(materiasActualizadas)

        try {
          localStorage.setItem(
            `study_materias_${usuario.id}`,
            JSON.stringify(materiasActualizadas)
          )
        } catch (errorLocal) {
          console.error(
            'No se pudo guardar la copia local:',
            errorLocal
          )
        }

        const { data: gruposData, error: errorGrupos } =
          await supabase.rpc('obtener_mis_grupos')

        if (errorGrupos) throw errorGrupos
        if (!activo) return

        const gruposActualizados = gruposData || []

        setGrupos(gruposActualizados)

        try {
          localStorage.setItem(
            `study_grupos_${usuario.id}`,
            JSON.stringify(gruposActualizados)
          )
        } catch (errorLocal) {
          console.error(
            'No se pudo guardar la copia local de grupos:',
            errorLocal
          )
        }

        setModoOffline(false)
      } catch (error) {
        console.error(
          'No se pudieron actualizar las materias:',
          error
        )

        if (activo) setModoOffline(true)
      }
    }

    cargarMaterias()

    return () => {
      activo = false
    }
  }, [usuario?.id])


  const limpiarFormulario = () => {
    setNombre('')
    setProfesor('')
    setAula('')
    setDias('')
    setHoraInicio('')
    setHoraFin('')
    setColor('#078b87')
    setMateriaEditando(null)
  }


  const guardarMateria = async (e) => {
    e.preventDefault()

    if (!usuario?.id) {
      await alertaError(
        'Usuario no encontrado',
        'No pudimos identificar tu sesión.'
      )
      return
    }

    if (!navigator.onLine) {
      await alertaError(
        'Sin conexión',
        'Necesitas internet para guardar cambios en tus materias.'
      )
      return
    }

    const datosMateria = {
      nombre,
      profesor,
      aula,
      dias,
      hora_inicio: horaInicio || null,
      hora_fin: horaFin || null,
      color
    }

    try {
      if (materiaEditando) {

        const { data, error } = await supabase
          .from('materias')
          .update(datosMateria)
          .eq('id', materiaEditando.id)
          .eq('user_id', usuario.id)
          .select()

        if (error) throw error

        const materiaActualizada = data?.[0]

        if (!materiaActualizada) {
          throw new Error(
            'No se encontró la materia para actualizar.'
          )
        }

        const materiasActualizadas = materias.map(
          (materia) =>
            materia.id === materiaActualizada.id
              ? materiaActualizada
              : materia
        )

        setMaterias(materiasActualizadas)
        guardarMateriasLocales(materiasActualizadas)

        await alertaExito(
          '¡Materia actualizada!',
          'Los cambios se guardaron correctamente.'
        )
      } else {

        const { data, error } = await supabase
          .from('materias')
          .insert([
            {
              ...datosMateria,
              user_id: usuario.id
            }
          ])
          .select()

        if (error) throw error

        const materiasActualizadas = [
          ...(data || []),
          ...materias
        ]

        setMaterias(materiasActualizadas)
        guardarMateriasLocales(materiasActualizadas)

        await alertaExito(
          '¡Materia agregada!',
          'La materia se guardó correctamente.'
        )
      }

      limpiarFormulario()
      setMostrarFormulario(false)
    } catch (error) {
      await alertaError(
        'No pudimos guardar la materia',
        error.message || 'Ocurrió un error inesperado.'
      )
    }
  }


  const eliminarMateria = async (materia) => {
    if (!navigator.onLine) {
      await alertaError(
        'Sin conexión',
        'Necesitas internet para eliminar materias.'
      )
      return
    }

    const resultado = await alertaConfirmacion(
      '¿Eliminar materia?',
      `¿Seguro que deseas eliminar "${materia.nombre}"?`
    )

    if (!resultado.isConfirmed) return

    try {
      const { data, error } = await supabase
        .from('materias')
        .delete()
        .eq('id', materia.id)
        .eq('user_id', usuario.id)
        .select('id')

      if (error) throw error

      if (!data?.length) {
        throw new Error(
          'No se encontró la materia para eliminar.'
        )
      }

      const materiasActualizadas = materias.filter(
        (item) => item.id !== materia.id
      )

      setMaterias(materiasActualizadas)
      guardarMateriasLocales(materiasActualizadas)

      await alertaExito(
        '¡Materia eliminada!',
        `"${materia.nombre}" fue eliminada correctamente.`
      )
    } catch (error) {
      await alertaError(
        'No pudimos eliminar la materia',
        error.message || 'Ocurrió un error inesperado.'
      )
    }
  }


  const editarMateria = (materia) => {
    if (!navigator.onLine) {
      alertaError(
        'Sin conexión',
        'Necesitas internet para editar materias.'
      )
      return
    }

    setMateriaEditando(materia)

    setNombre(materia.nombre || '')
    setProfesor(materia.profesor || '')
    setAula(materia.aula || '')
    setDias(materia.dias || '')

    setHoraInicio(
      materia.hora_inicio
        ? materia.hora_inicio.slice(0, 5)
        : ''
    )

    setHoraFin(
      materia.hora_fin
        ? materia.hora_fin.slice(0, 5)
        : ''
    )

    setColor(materia.color || '#078b87')
    setMostrarFormulario(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }


  const cerrarFormulario = () => {
    limpiarFormulario()
    setMostrarFormulario(false)
  }


  return (
    <div className="materias-page">

      {modoOffline && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            marginBottom: '18px',
            background: '#fff3cd',
            color: '#795700',
            borderRadius: '10px',
            fontWeight: 600
          }}
        >
          📡 Sin conexión con Supabase. Estás viendo
          las materias guardadas en este dispositivo.
          Para realizar cambios necesitas internet.
        </div>
      )}

      <header className="dashboard-header">
        <div>
          <p className="dashboard-small-title">
            ORGANIZACIÓN ACADÉMICA
          </p>

          <h1>📚 Mis materias</h1>

          <p>
            Organiza las materias que cursas este semestre.
          </p>
        </div>

        <button
          className="join-group-button"
          onClick={() => {
            if (!navigator.onLine) {
              alertaError(
                'Sin conexión',
                'Necesitas internet para agregar materias.'
              )
              return
            }

            limpiarFormulario()
            setMostrarFormulario(true)
          }}
        >
          + Agregar materia
        </button>
      </header>

      {mostrarFormulario && (
        <div className="dashboard-panel materia-form-card">
          <div className="panel-header">
            <div>
              <h2>
                {materiaEditando
                  ? 'Editar materia'
                  : 'Nueva materia'}
              </h2>

              <p>
                {materiaEditando
                  ? 'Modifica la información de tu clase.'
                  : 'Agrega la información de tu clase.'}
              </p>
            </div>

            <button
              type="button"
              className="small-button"
              onClick={cerrarFormulario}
            >
              ✕ Cerrar
            </button>
          </div>

          <form
            className="materia-form"
            onSubmit={guardarMateria}
          >
            <div className="form-group">
              <label>Nombre de la materia</label>

              <input
                type="text"
                placeholder="Ej. Matemáticas"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Profesor</label>

              <input
                type="text"
                placeholder="Ej. Laura Hernández"
                value={profesor}
                onChange={(e) => setProfesor(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Aula</label>

              <input
                type="text"
                placeholder="Ej. A-204"
                value={aula}
                onChange={(e) => setAula(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Días</label>

              <input
                type="text"
                placeholder="Ej. Lunes, miércoles y viernes"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Hora de inicio</label>

              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Hora de fin</label>

              <input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Color</label>

              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="join-group-button"
            >
              {materiaEditando
                ? 'Guardar cambios'
                : 'Guardar materia'}
            </button>
          </form>
        </div>
      )}


      {grupos.length > 0 && (
        <section
          aria-label="Materias de grupos inscritos"
          style={{ marginBottom: '28px' }}
        >
          <h2 style={{ marginBottom: '16px' }}>
            👥 Materias de mis grupos
          </h2>

          <div className="materias-grid">
            {grupos.map((grupo) => (
              <div
                className="materia-card"
                key={`grupo-${grupo.id}`}
              >
                <div
                  className="materia-color"
                  style={{ backgroundColor: '#078b87' }}
                />

                <div className="materia-card-content">
                  <div className="materia-card-header">
                    <h2>{grupo.materia}</h2>

                    <span
                      style={{
                        color: '#078b87',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}
                    >
                      Materia de grupo
                    </span>
                  </div>

                  <p>👥 {grupo.nombre}</p>

                  {grupo.descripcion && (
                    <p>{grupo.descripcion}</p>
                  )}

                  <p
                    style={{
                      fontSize: '0.9rem',
                      color: '#64748b'
                    }}
                  >
                    La información de esta materia la
                    administra el profesor. Tú organizas
                    tu horario por separado.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}


      {materias.length === 0 && grupos.length === 0 ? (
        <div className="dashboard-panel materias-empty">
          <div className="empty-icon">
            📚
          </div>

          <h2>Aún no tienes materias</h2>

          <p>
            Agrega tu primera materia para comenzar
            a organizar tus clases, tareas y calificaciones.
          </p>

          <button
            className="join-group-button"
            onClick={() => {
              if (!navigator.onLine) {
                alertaError(
                  'Sin conexión',
                  'Necesitas internet para agregar materias.'
                )
                return
              }

              limpiarFormulario()
              setMostrarFormulario(true)
            }}
          >
            + Agregar mi primera materia
          </button>
        </div>
      ) : (
        <div className="materias-grid">
          {materias.map((materia) => (
            <div
              className="materia-card"
              key={materia.id}
            >
              <div
                className="materia-color"
                style={{
                  backgroundColor:
                    materia.color || '#078b87'
                }}
              />

              <div className="materia-card-content">
                <div className="materia-card-header">
                  <h2>{materia.nombre}</h2>

                  <div className="materia-actions">
                    <button
                      type="button"
                      className="edit-materia-button"
                      onClick={() => editarMateria(materia)}
                      title="Editar materia"
                    >
                      ✏️
                    </button>

                    <button
                      type="button"
                      className="delete-materia-button"
                      onClick={() => eliminarMateria(materia)}
                      title="Eliminar materia"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <p>
                  👨‍🏫 {materia.profesor ||
                    'Profesor no especificado'}
                </p>

                <p>
                  📍 {materia.aula ||
                    'Aula no especificada'}
                </p>

                <p>
                  📅 {materia.dias ||
                    'Días no especificados'}
                </p>

                <p>
                  🕐{' '}
                  {materia.hora_inicio
                    ? materia.hora_inicio.slice(0, 5)
                    : '--:--'}
                  {' - '}
                  {materia.hora_fin
                    ? materia.hora_fin.slice(0, 5)
                    : '--:--'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Materias