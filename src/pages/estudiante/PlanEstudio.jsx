import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  alertaExito,
  alertaError,
  alertaConfirmacion
} from '../../utils/alertas'

function PlanEstudio({ usuario }) {
  const [materias, setMaterias] = useState([])
  const [calificaciones, setCalificaciones] = useState([])
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [generandoPlan, setGenerandoPlan] = useState(false)
  const [terminandoPlan, setTerminandoPlan] = useState(false)

  const [materiaSeleccionada, setMateriaSeleccionada] = useState(null)
  const [temas, setTemas] = useState([''])
  const [diasSeleccionados, setDiasSeleccionados] = useState([])
  const [tiempoSesion, setTiempoSesion] = useState('30')
  const [sugerencia, setSugerencia] = useState(null)

  const diasSemana = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo'
  ]

  const cargarDatos = async () => {
    if (!usuario) return

    setCargando(true)

    try {
      const [materiasRespuesta, calificacionesRespuesta, planesRespuesta] =
        await Promise.all([
          supabase
            .from('materias')
            .select('*')
            .eq('user_id', usuario.id)
            .order('nombre', { ascending: true }),
          supabase
            .from('calificaciones')
            .select('*')
            .eq('user_id', usuario.id),
          supabase
            .from('planes_estudio')
            .select('*')
            .eq('user_id', usuario.id)
            .order('numero_plan', { ascending: false })
        ])

      if (materiasRespuesta.error) throw materiasRespuesta.error
      if (calificacionesRespuesta.error) throw calificacionesRespuesta.error
      if (planesRespuesta.error) throw planesRespuesta.error

      setMaterias(materiasRespuesta.data || [])
      setCalificaciones(calificacionesRespuesta.data || [])
      setPlanes(planesRespuesta.data || [])
    } catch (error) {
      await alertaError(
        'No pudimos cargar tus planes de estudio',
        error.message || 'Ocurrió un error inesperado.'
      )
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [usuario])

  const obtenerPromedioMateria = (materiaId) => {
    const parciales = calificaciones.filter(
      (calificacion) => calificacion.materia_id === materiaId
    )

    if (parciales.length === 0) return null

    const suma = parciales.reduce(
      (total, parcial) => total + Number(parcial.promedio),
      0
    )

    return suma / parciales.length
  }

  const obtenerPlanActivo = (materiaId) => {
    return (
      planes.find(
        (plan) =>
          plan.materia_id === materiaId && plan.estado === 'activo'
      ) || null
    )
  }

  const obtenerSiguienteNumeroPlan = (materiaId) => {
    const planesMateria = planes.filter(
      (plan) => plan.materia_id === materiaId
    )

    if (planesMateria.length === 0) return 1

    const numeroMayor = Math.max(
      ...planesMateria.map((plan) => Number(plan.numero_plan) || 0)
    )

    return numeroMayor + 1
  }

  const abrirSugerencia = (materia) => {
    if (obtenerPlanActivo(materia.id)) return

    setSugerencia(null)
    setMateriaSeleccionada(materia)
    setTemas([''])
    setDiasSeleccionados([])
    setTiempoSesion('30')
  }

  const cerrarSugerencia = () => {
    if (generandoPlan) return

    setMateriaSeleccionada(null)
    setTemas([''])
    setDiasSeleccionados([])
    setTiempoSesion('30')
  }

  const cambiarTema = (indice, valor) => {
    const nuevosTemas = [...temas]
    nuevosTemas[indice] = valor
    setTemas(nuevosTemas)
  }

  const agregarTema = () => {
    setTemas((anteriores) => [...anteriores, ''])
  }

  const eliminarTema = (indice) => {
    if (temas.length === 1) {
      setTemas([''])
      return
    }

    setTemas((anteriores) =>
      anteriores.filter((_, posicion) => posicion !== indice)
    )
  }

  const seleccionarDia = (dia) => {
    if (diasSeleccionados.includes(dia)) {
      setDiasSeleccionados(
        diasSeleccionados.filter((diaActual) => diaActual !== dia)
      )
    } else {
      setDiasSeleccionados([...diasSeleccionados, dia])
    }
  }

  const convertirPlanGuardado = (registro) => {
    const materia = materias.find(
      (materiaActual) => materiaActual.id === registro.materia_id
    )

    const planGuardado = registro.plan || {}
    const tiempo = Number(registro.tiempo_sesion) || 0
    const sesiones = (planGuardado.sesiones || []).map((sesion, indice) => ({
      ...sesion,
      numero: indice + 1,
      tiempo
    }))

    return {
      id: registro.id,
      numeroPlan: Number(registro.numero_plan),
      materia,
      promedio: obtenerPromedioMateria(registro.materia_id),
      temas: Array.isArray(registro.temas) ? registro.temas : [],
      dias: Array.isArray(registro.dias) ? registro.dias : [],
      sesiones,
      tiempoTotal: sesiones.length * tiempo,
      recomendacionFinal:
        planGuardado.recomendacionFinal ||
        'Continúa practicando los temas que te resulten más difíciles.'
    }
  }

  const verPlan = (plan) => {
    const planConvertido = convertirPlanGuardado(plan)

    if (!planConvertido.materia) {
      alertaError(
        'No pudimos abrir el plan',
        'La materia asociada a este plan ya no está disponible.'
      )
      return
    }

    setSugerencia(planConvertido)
    setMateriaSeleccionada(null)
  }

  const generarSugerencia = async () => {
    if (generandoPlan) return

    const temasValidos = temas
      .map((tema) => tema.trim())
      .filter((tema) => tema !== '')

    if (temasValidos.length === 0) {
      await alertaError(
        'Agrega al menos un tema',
        'Escribe un tema que quieras reforzar.'
      )
      return
    }

    if (diasSeleccionados.length === 0) {
      await alertaError(
        'Selecciona tus días',
        'Elige al menos un día disponible para estudiar.'
      )
      return
    }

    if (!materiaSeleccionada) {
      await alertaError(
        'No hay una materia seleccionada',
        'Vuelve a seleccionar la materia.'
      )
      return
    }

    const materiaActual = materiaSeleccionada

    if (obtenerPlanActivo(materiaActual.id)) {
      await alertaError(
        'Ya tienes un plan activo',
        'Termina tu plan actual antes de generar uno nuevo.'
      )
      return
    }

    const promedio = obtenerPromedioMateria(materiaActual.id)
    const tiempo = Number(tiempoSesion)
    const numeroPlan = obtenerSiguienteNumeroPlan(materiaActual.id)

    setGenerandoPlan(true)

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (!sessionData.session) {
        throw new Error(
          'Tu sesión ha expirado. Inicia sesión nuevamente.'
        )
      }

      const { data, error } = await supabase.functions.invoke(
        'generar-plan-estudio',
        {
          body: {
            materia: materiaActual.nombre,
            temas: temasValidos,
            dias: diasSeleccionados,
            tiempoSesion: tiempo,
            promedio
          }
        }
      )

      if (error) {
        console.error('Error al invocar generar-plan-estudio:', error)

        let mensaje = 'No pudimos generar tu plan de estudio.'

        if (error.context) {
          try {
            const detalle = await error.context.json()
            if (detalle?.error) mensaje = detalle.error
          } catch {
          }
        }

        throw new Error(mensaje)
      }

      if (!data?.ok || !data?.plan) {
        throw new Error(
          data?.error || 'Study recibió una respuesta inesperada.'
        )
      }

      const sesionesIA = data.plan.sesiones || []

      if (sesionesIA.length === 0) {
        throw new Error('Study no pudo crear ninguna sesión.')
      }

      const { data: planGuardado, error: guardarError } = await supabase
        .from('planes_estudio')
        .insert({
          user_id: usuario.id,
          materia_id: materiaActual.id,
          numero_plan: numeroPlan,
          temas: temasValidos,
          dias: diasSeleccionados,
          tiempo_sesion: tiempo,
          plan: data.plan,
          estado: 'activo'
        })
        .select()
        .single()

      if (guardarError) throw guardarError

      const nuevoPlan = {
        ...planGuardado,
        numero_plan: Number(planGuardado.numero_plan)
      }

      setPlanes((anteriores) => [nuevoPlan, ...anteriores])

      const sesiones = sesionesIA.map((sesion, indice) => ({
        ...sesion,
        numero: indice + 1,
        tiempo
      }))

      setSugerencia({
        id: planGuardado.id,
        numeroPlan,
        materia: materiaActual,
        promedio,
        temas: temasValidos,
        dias: diasSeleccionados,
        sesiones,
        tiempoTotal: sesiones.length * tiempo,
        recomendacionFinal:
          data.plan.recomendacionFinal ||
          'Continúa practicando los temas que te resulten más difíciles.'
      })

      setMateriaSeleccionada(null)
      setTemas([''])
      setDiasSeleccionados([])
      setTiempoSesion('30')

      await alertaExito(
        `Plan ${numeroPlan} creado`,
        `Tu plan de ${materiaActual.nombre} quedó guardado.`
      )
    } catch (error) {
      console.error('Error generando el plan:', error)

      await alertaError(
        'No pudimos generar tu plan',
        error instanceof Error
          ? error.message
          : 'Ocurrió un error inesperado.'
      )
    } finally {
      setGenerandoPlan(false)
    }
  }

  const terminarPlan = async () => {
    if (!sugerencia?.id || terminandoPlan) return

    const confirmacion = await alertaConfirmacion(
      `¿Terminaste el Plan ${sugerencia.numeroPlan}?`,
      'El plan se marcará como completado y podrás crear uno nuevo para esta materia.'
    )

    if (!confirmacion.isConfirmed) return

    setTerminandoPlan(true)

    try {
      const { error } = await supabase
        .from('planes_estudio')
        .update({
          estado: 'completado',
          completed_at: new Date().toISOString()
        })
        .eq('id', sugerencia.id)
        .eq('user_id', usuario.id)

      if (error) throw error

      const planTerminado = sugerencia

      setPlanes((anteriores) =>
        anteriores.map((plan) =>
          plan.id === planTerminado.id
            ? {
                ...plan,
                estado: 'completado',
                completed_at: new Date().toISOString()
              }
            : plan
        )
      )

      setSugerencia(null)

      await alertaExito(
        `¡Plan ${planTerminado.numeroPlan} terminado!`,
        `Ya puedes crear el Plan ${planTerminado.numeroPlan + 1} de ${planTerminado.materia.nombre}.`
      )
    } catch (error) {
      await alertaError(
        'No pudimos terminar el plan',
        error.message || 'Ocurrió un error inesperado.'
      )
    } finally {
      setTerminandoPlan(false)
    }
  }

  return (
    <div className="materias-page">
      <div className="materias-header">
        <div>
          <p className="dashboard-small-title">ORGANIZACIÓN ACADÉMICA</p>
          <h1>🧠 Mi plan de estudio</h1>
          <p>
            Study puede ayudarte a organizar los temas que quieres reforzar.
          </p>
        </div>
      </div>

      {cargando ? (
        <div className="materias-empty">
          <p>Analizando tus materias...</p>
        </div>
      ) : materias.length === 0 ? (
        <div className="materias-empty">
          <div className="empty-icon">🧠</div>
          <h2>Aún no tienes materias</h2>
          <p>
            Agrega tus materias para comenzar a crear planes de estudio.
          </p>
        </div>
      ) : (
        <div className="study-plan-grid">
          {materias.map((materia) => {
            const promedio = obtenerPromedioMateria(materia.id)
            const planActivo = obtenerPlanActivo(materia.id)
            const siguienteNumero = obtenerSiguienteNumeroPlan(materia.id)

            return (
              <div className="study-plan-card" key={materia.id}>
                <div
                  className="study-plan-color"
                  style={{ background: materia.color || '#078b87' }}
                />

                <div className="study-plan-content">
                  <div className="study-plan-header">
                    <div>
                      <h2>{materia.nombre}</h2>
                      {materia.profesor && <p>{materia.profesor}</p>}
                    </div>

                    <div className="study-plan-average">
                      <span>Promedio</span>
                      <strong>
                        {promedio !== null ? promedio.toFixed(1) : '—'}
                      </strong>
                    </div>
                  </div>

                  <div className="study-plan-footer">
                    {promedio === null ? (
                      <span className="study-plan-message">
                        Aún no hay calificaciones
                      </span>
                    ) : planActivo ? (
                      <span className="study-plan-message">
                        🧠 Plan {planActivo.numero_plan} activo
                      </span>
                    ) : (
                      <span className="study-plan-message">
                        Listo para crear el Plan {siguienteNumero}
                      </span>
                    )}

                    {planActivo ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => verPlan(planActivo)}
                      >
                        Ver Plan {planActivo.numero_plan}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={promedio === null}
                        onClick={() => abrirSugerencia(materia)}
                      >
                        ✨ Crear Plan {siguienteNumero}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sugerencia && (
        <div className="study-detailed-plan">
          <div className="study-detailed-header">
            <div>
              <p className="dashboard-small-title">
                PLAN {sugerencia.numeroPlan} · STUDY
              </p>
              <h2>📚 Plan para {sugerencia.materia.nombre}</h2>
              <p>
                Trabaja las sesiones paso a paso y marca el plan como terminado
                cuando completes todas las actividades.
              </p>
            </div>

            <button
              type="button"
              className="study-modal-close"
              disabled={terminandoPlan}
              onClick={() => setSugerencia(null)}
            >
              ✕
            </button>
          </div>

          <div className="study-plan-summary">
            <div className="study-summary-item">
              <span>🧠 Plan</span>
              <strong>{sugerencia.numeroPlan}</strong>
            </div>

            <div className="study-summary-item">
              <span>📚 Temas</span>
              <strong>{sugerencia.temas.length}</strong>
            </div>

            <div className="study-summary-item">
              <span>📅 Sesiones</span>
              <strong>{sugerencia.sesiones.length}</strong>
            </div>

            <div className="study-summary-item">
              <span>⏱️ Tiempo total</span>
              <strong>{sugerencia.tiempoTotal} min</strong>
            </div>

            <div className="study-summary-item">
              <span>📊 Promedio actual</span>
              <strong>
                {sugerencia.promedio !== null
                  ? sugerencia.promedio.toFixed(1)
                  : '—'}
              </strong>
            </div>
          </div>

          <div className="study-detailed-sessions">
            {sugerencia.sesiones.map((sesion, indice) => (
              <div
                className="study-detailed-session"
                key={`${sesion.dia}-${indice}`}
              >
                <div className="study-session-top">
                  <div className="study-session-number">
                    {sesion.numero}
                  </div>

                  <div className="study-session-title">
                    <span>{sesion.dia}</span>
                    <h3>{sesion.tema}</h3>
                  </div>

                  <div className="study-session-time">
                    ⏱️ {sesion.tiempo} min
                  </div>
                </div>

                <div className="study-session-focus">
                  <strong>🎯 Enfoque de la sesión</strong>
                  <p>{sesion.enfoque}</p>
                </div>

                <div className="study-activities">
                  {sesion.actividades?.map((actividad, actividadIndice) => (
                    <div className="study-activity" key={actividadIndice}>
                      <div className="study-activity-icon">
                        {actividad.icono}
                      </div>

                      <div className="study-activity-content">
                        <div className="study-activity-title">
                          <strong>{actividad.titulo}</strong>
                          <span>{actividad.tiempo} min</span>
                        </div>
                        <p>{actividad.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="study-session-tip">
                  💡 <strong>Al terminar:</strong> {sesion.consejo}
                </div>
              </div>
            ))}
          </div>

          <div className="study-plan-final-tip">
            <div className="study-final-tip-icon">💡</div>
            <div>
              <strong>Recomendación de Study</strong>
              <p>{sugerencia.recomendacionFinal}</p>
            </div>
          </div>

          <div
            className="grade-modal-actions"
            style={{ marginTop: '24px' }}
          >
            <button
              type="button"
              className="btn btn-primary"
              disabled={terminandoPlan}
              onClick={terminarPlan}
            >
              {terminandoPlan
                ? '⏳ Guardando...'
                : `✅ Terminé el Plan ${sugerencia.numeroPlan}`}
            </button>
          </div>
        </div>
      )}

      {materiaSeleccionada && (
        <div className="grade-modal-overlay">
          <div className="study-plan-modal">
            <div className="study-modal-header">
              <div>
                <p className="dashboard-small-title">PLAN DE ESTUDIO</p>
                <h2>
                  🧠 Crear Plan {obtenerSiguienteNumeroPlan(materiaSeleccionada.id)}
                </h2>
                <span>{materiaSeleccionada.nombre}</span>
              </div>

              <button
                type="button"
                className="study-modal-close"
                disabled={generandoPlan}
                onClick={cerrarSugerencia}
              >
                ✕
              </button>
            </div>

            <div className="study-modal-section">
              <h3>¿Qué temas quieres reforzar?</h3>
              <p>
                Escribe los temas que estás viendo. Study creará actividades
                específicas para cada uno.
              </p>

              <div className="study-topics">
                {temas.map((tema, indice) => (
                  <div className="study-topic-row" key={indice}>
                    <input
                      type="text"
                      placeholder={`Tema ${indice + 1}`}
                      value={tema}
                      disabled={generandoPlan}
                      onChange={(e) => cambiarTema(indice, e.target.value)}
                    />

                    <button
                      type="button"
                      className="study-topic-delete"
                      title="Eliminar tema"
                      disabled={generandoPlan}
                      onClick={() => eliminarTema(indice)}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="study-add-topic"
                disabled={generandoPlan}
                onClick={agregarTema}
              >
                + Agregar otro tema
              </button>
            </div>

            <div className="study-modal-section">
              <h3>¿Qué días puedes estudiar?</h3>
              <p>
                Study organizará las sesiones en los días que selecciones.
              </p>

              <div className="study-days">
                {diasSemana.map((dia) => (
                  <button
                    type="button"
                    key={dia}
                    disabled={generandoPlan}
                    className={
                      diasSeleccionados.includes(dia)
                        ? 'study-day selected'
                        : 'study-day'
                    }
                    onClick={() => seleccionarDia(dia)}
                  >
                    {dia}
                  </button>
                ))}
              </div>
            </div>

            <div className="study-modal-section">
              <h3>¿Cuánto tiempo tienes por sesión?</h3>
              <p>
                Study creará las actividades respetando el tiempo disponible de
                cada sesión.
              </p>

              <select
                className="study-time-select"
                value={tiempoSesion}
                disabled={generandoPlan}
                onChange={(e) => setTiempoSesion(e.target.value)}
              >
                <option value="15">15 minutos</option>
                <option value="20">20 minutos</option>
                <option value="30">30 minutos</option>
                <option value="45">45 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1 hora 30 minutos</option>
              </select>
            </div>

            <div className="grade-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={generandoPlan}
                onClick={cerrarSugerencia}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={generandoPlan}
                onClick={generarSugerencia}
              >
                {generandoPlan
                  ? '⏳ Generando plan...'
                  : `✨ Generar Plan ${obtenerSiguienteNumeroPlan(
                      materiaSeleccionada.id
                    )}`}
              </button>
            </div>

            {generandoPlan && (
              <div
                style={{
                  marginTop: '14px',
                  textAlign: 'center',
                  color: '#667085',
                  fontSize: '12px'
                }}
              >
                Study está preparando actividades personalizadas. Esto puede
                tardar unos segundos.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PlanEstudio
