
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

function Horario({ usuario }) {
  const [materias, setMaterias] = useState([])
  const [modoOffline, setModoOffline] = useState(
    !navigator.onLine
  )
  const [hayCopiaLocal, setHayCopiaLocal] = useState(false)
  const [cargando, setCargando] = useState(true)

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
    let activo = true

    if (!usuario?.id) {
      setMaterias([])
      setHayCopiaLocal(false)
      setCargando(false)
      return
    }

    const claveMaterias = `study_materias_${usuario.id}`

    const ordenarMaterias = (lista) => {
      return [...lista].sort((a, b) =>
        (a.hora_inicio || '').localeCompare(
          b.hora_inicio || ''
        )
      )
    }

    const cargarHorario = async () => {
      setCargando(true)
      setHayCopiaLocal(false)
      setMaterias([])

      try {
        const datosGuardados = localStorage.getItem(
          claveMaterias
        )

        if (datosGuardados !== null) {
          const lista = JSON.parse(datosGuardados)

          if (Array.isArray(lista) && activo) {
            setMaterias(ordenarMaterias(lista))
            setHayCopiaLocal(true)
          }
        }
      } catch (error) {
        console.error(
          'No se pudo recuperar el horario guardado:',
          error
        )
      }

      if (!navigator.onLine) {
        if (activo) {
          setModoOffline(true)
          setCargando(false)
        }
        return
      }

      try {
        const { data, error } = await supabase
          .from('materias')
          .select('*')
          .eq('user_id', usuario.id)
          .order('hora_inicio', { ascending: true })

        if (error) throw error
        if (!activo) return

        const materiasActualizadas = data || []

        setMaterias(materiasActualizadas)
        setModoOffline(false)

        try {
          localStorage.setItem(
            claveMaterias,
            JSON.stringify(materiasActualizadas)
          )

          setHayCopiaLocal(true)
        } catch (errorLocal) {
          console.error(
            'No se pudo guardar el horario local:',
            errorLocal
          )
        }
      } catch (error) {
        console.error(
          'No se pudo actualizar el horario:',
          error
        )

        if (activo) {
          setModoOffline(true)
        }
      } finally {
        if (activo) {
          setCargando(false)
        }
      }
    }

    cargarHorario()

    return () => {
      activo = false
    }
  }, [usuario?.id])

  const diasSemana = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes'
  ]

  const horas = [
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00'
  ]

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
          📡 Sin conexión con Supabase.{' '}
          {hayCopiaLocal
            ? 'Estás viendo tu horario guardado en este dispositivo.'
            : 'No hay un horario guardado todavía en este dispositivo.'}
          {' '}Para actualizar tus materias necesitas internet.
        </div>
      )}

      <div className="materias-header">
        <div>
          <p className="dashboard-small-title">
            ORGANIZACIÓN ACADÉMICA
          </p>

          <h1>📅 Mi horario</h1>

          <p>
            Consulta tus clases y horarios de la semana.
          </p>
        </div>
      </div>

      {cargando ? (
        <div className="materias-empty">
          <p>Cargando horario...</p>
        </div>
      ) : materias.length === 0 ? (
        <div className="materias-empty">
          <div className="empty-icon">
            📅
          </div>

          <h2>
            {modoOffline && !hayCopiaLocal
              ? 'No hay un horario guardado'
              : 'Aún no tienes clases en tu horario'}
          </h2>

          <p>
            {modoOffline && !hayCopiaLocal
              ? 'Conéctate a internet y entra a Mi horario para guardar una copia.'
              : 'Agrega tus materias con sus días y horarios para generar automáticamente tu horario.'}
          </p>
        </div>
      ) : (
        <div className="schedule-container">
          <div className="weekly-schedule">

            <div className="schedule-corner">
              Hora
            </div>

            {diasSemana.map((dia) => (
              <div
                className="weekly-day-header"
                key={dia}
              >
                {dia}
              </div>
            ))}

            {horas.map((hora) => (
              <div
                className="schedule-row"
                key={hora}
              >

                <div className="schedule-hour">
                  {hora}
                </div>

                {diasSemana.map((dia) => {
                  const materiasEnEstaHora = materias.filter(
                    (materia) => {
                      const estaEnEsteDia =
                        materia.dias
                          ?.toLowerCase()
                          .includes(dia.toLowerCase())

                      const horaInicio =
                        materia.hora_inicio?.slice(0, 5)

                      return (
                        estaEnEsteDia &&
                        horaInicio === hora
                      )
                    }
                  )

                  return (
                    <div
                      className="schedule-cell"
                      key={`${dia}-${hora}`}
                    >
                      {materiasEnEstaHora.map((materia) => (
                        <div
                          className="weekly-class"
                          key={materia.id}
                          style={{
                            '--subject-color':
                              materia.color || '#078b87'
                          }}
                        >
                          <div className="weekly-class-color" />

                          <div className="weekly-class-info">
                            <strong>
                              {materia.nombre}
                            </strong>

                            {materia.aula && (
                              <span>{materia.aula}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}

              </div>
            ))}

          </div>
        </div>
      )}

    </div>
  )
}

export default Horario