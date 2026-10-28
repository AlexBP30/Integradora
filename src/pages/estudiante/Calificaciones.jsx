
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  alertaExito,
  alertaError,
  alertaConfirmacion
} from '../../utils/alertas'
import './Calificaciones.css'

function Calificaciones({ usuario }) {
  const [materias, setMaterias] = useState([])
  const [grupos, setGrupos] = useState([])
  const [calificaciones, setCalificaciones] = useState([])
  const [calificacionesGrupo, setCalificacionesGrupo] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modoOffline, setModoOffline] = useState(!navigator.onLine)
  const [hayCopiaLocal, setHayCopiaLocal] = useState(false)

  const [materiaSeleccionada, setMateriaSeleccionada] = useState(null)
  const [parcialEditando, setParcialEditando] = useState(null)
  const [periodo, setPeriodo] = useState('')
  const [promedio, setPromedio] = useState('')

  const claveCalificaciones = usuario?.id
    ? `study_calificaciones_${usuario.id}`
    : null

  const guardarCopiaLocal = (datos) => {
    if (!claveCalificaciones) return

    try {
      localStorage.setItem(
        claveCalificaciones,
        JSON.stringify(datos)
      )
      setHayCopiaLocal(true)
    } catch (error) {
      console.error(
        'No se pudieron guardar las calificaciones:',
        error
      )
    }
  }

  const actualizarCalificacionesLocales = (nuevasCalificaciones) => {
    if (!claveCalificaciones) return

    try {
      const guardado = localStorage.getItem(claveCalificaciones)

      if (!guardado) return

      const datos = JSON.parse(guardado)

      guardarCopiaLocal({
        ...datos,
        calificaciones: nuevasCalificaciones
      })
    } catch (error) {
      console.error(
        'No se pudo actualizar la copia local:',
        error
      )
    }
  }

  useEffect(() => {
    let activo = true

    const cargarDatos = async () => {
      setCargando(true)
      setHayCopiaLocal(false)
      setMaterias([])
      setGrupos([])
      setCalificaciones([])
      setCalificacionesGrupo([])

      if (!usuario?.id) {
        setCargando(false)
        return
      }

      const clave = `study_calificaciones_${usuario.id}`

      try {
        const guardado = localStorage.getItem(clave)

        if (guardado !== null) {
          const datos = JSON.parse(guardado)

          if (datos && typeof datos === 'object' && activo) {
            setMaterias(
              Array.isArray(datos.materias) ? datos.materias : []
            )
            setGrupos(
              Array.isArray(datos.grupos) ? datos.grupos : []
            )
            setCalificaciones(
              Array.isArray(datos.calificaciones)
                ? datos.calificaciones
                : []
            )
            setCalificacionesGrupo(
              Array.isArray(datos.calificacionesGrupo)
                ? datos.calificacionesGrupo
                : []
            )
            setHayCopiaLocal(true)
          }
        }
      } catch (error) {
        console.error(
          'No se pudieron recuperar las calificaciones:',
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
        const [
          materiasRes,
          calificacionesRes,
          gruposRes
        ] = await Promise.all([
          supabase
            .from('materias')
            .select('*')
            .eq('user_id', usuario.id)
            .order('nombre'),

          supabase
            .from('calificaciones')
            .select('*')
            .eq('user_id', usuario.id)
            .order('created_at'),

          supabase.rpc('obtener_mis_grupos')
        ])

        const errorInicial =
          materiasRes.error ||
          calificacionesRes.error ||
          gruposRes.error

        if (errorInicial) throw errorInicial

        const gruposInscritos = gruposRes.data || []
        let notasGrupo = []

        if (gruposInscritos.length > 0) {
          const { data, error } = await supabase
            .from('calificaciones_grupo')
            .select(
              'id, grupo_id, alumno_id, periodo, promedio, created_at'
            )
            .eq('alumno_id', usuario.id)
            .in(
              'grupo_id',
              gruposInscritos.map((grupo) => grupo.id)
            )
            .order('created_at', { ascending: true })

          if (error) throw error

          notasGrupo = data || []
        }

        if (!activo) return

        const nuevosDatos = {
          materias: materiasRes.data || [],
          calificaciones: calificacionesRes.data || [],
          grupos: gruposInscritos,
          calificacionesGrupo: notasGrupo
        }

        setMaterias(nuevosDatos.materias)
        setCalificaciones(nuevosDatos.calificaciones)
        setGrupos(nuevosDatos.grupos)
        setCalificacionesGrupo(nuevosDatos.calificacionesGrupo)

        setModoOffline(false)

        try {
          localStorage.setItem(
            clave,
            JSON.stringify(nuevosDatos)
          )
          setHayCopiaLocal(true)
        } catch (errorLocal) {
          console.error(
            'No se pudo guardar la copia local:',
            errorLocal
          )
        }
      } catch (error) {
        console.error(
          'No se pudieron actualizar las calificaciones:',
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

    cargarDatos()

    return () => {
      activo = false
    }
  }, [usuario?.id])

  useEffect(() => {
    const sinConexion = () => {
      setModoOffline(true)
    }

    const conConexion = () => {
      setModoOffline(false)
    }

    window.addEventListener('offline', sinConexion)
    window.addEventListener('online', conConexion)

    return () => {
      window.removeEventListener('offline', sinConexion)
      window.removeEventListener('online', conConexion)
    }
  }, [])

  const materiasMostradas = [
    ...grupos.map((grupo) => ({
      id: `grupo-${grupo.id}`,
      grupoId: grupo.id,
      nombre: grupo.materia,
      profesor: '',
      nombreGrupo: grupo.nombre,
      color: '#078b87',
      esGrupo: true
    })),

    ...materias.map((materia) => ({
      ...materia,
      esGrupo: false
    }))
  ]

  const obtenerParciales = (materia) =>
    materia.esGrupo
      ? calificacionesGrupo.filter(
          (nota) => nota.grupo_id === materia.grupoId
        )
      : calificaciones.filter(
          (nota) => nota.materia_id === materia.id
        )

  const calcularPromedio = (parciales) => {
    if (!parciales.length) return null

    return (
      parciales.reduce(
        (total, nota) => total + Number(nota.promedio),
        0
      ) / parciales.length
    )
  }

  const promediosMaterias = materiasMostradas
    .map((materia) =>
      calcularPromedio(obtenerParciales(materia))
    )
    .filter((valor) => valor !== null)

  const promedioGeneral = promediosMaterias.length
    ? promediosMaterias.reduce(
        (total, valor) => total + valor,
        0
      ) / promediosMaterias.length
    : null


  const cerrarFormulario = () => {
    setMateriaSeleccionada(null)
    setParcialEditando(null)
    setPeriodo('')
    setPromedio('')
  }

  const abrirFormulario = async (materia, parcial = null) => {
    if (materia.esGrupo) return

    if (modoOffline || !navigator.onLine) {
      await alertaError(
        'Sin conexión',
        'Necesitas internet para agregar o editar calificaciones.'
      )
      return
    }

    setMateriaSeleccionada(materia)
    setParcialEditando(parcial)
    setPeriodo(parcial?.periodo || '')
    setPromedio(
      parcial ? String(parcial.promedio) : ''
    )
  }

  const guardarParcial = async () => {
    if (!materiaSeleccionada || materiaSeleccionada.esGrupo) {
      return
    }

    if (modoOffline || !navigator.onLine) {
      await alertaError(
        'Sin conexión',
        'Necesitas internet para guardar calificaciones.'
      )
      return
    }

    if (!periodo.trim()) {
      await alertaError(
        'Falta el periodo',
        'Escribe el nombre del periodo.'
      )
      return
    }

    if (
      promedio === '' ||
      !Number.isFinite(Number(promedio)) ||
      Number(promedio) < 0 ||
      Number(promedio) > 10
    ) {
      await alertaError(
        'Promedio no válido',
        'El promedio debe estar entre 0 y 10.'
      )
      return
    }

    const datos = {
      periodo: periodo.trim(),
      promedio: Number(promedio)
    }

    try {
      let resultado

      if (parcialEditando) {
        resultado = await supabase
          .from('calificaciones')
          .update(datos)
          .eq('id', parcialEditando.id)
          .eq('user_id', usuario.id)
          .eq('materia_id', materiaSeleccionada.id)
          .select()
          .single()
      } else {
        resultado = await supabase
          .from('calificaciones')
          .insert({
            ...datos,
            user_id: usuario.id,
            materia_id: materiaSeleccionada.id
          })
          .select()
          .single()
      }

      if (resultado.error) throw resultado.error

      const nuevasCalificaciones = parcialEditando
        ? calificaciones.map((nota) =>
            nota.id === parcialEditando.id
              ? resultado.data
              : nota
          )
        : [...calificaciones, resultado.data]

      setCalificaciones(nuevasCalificaciones)
      actualizarCalificacionesLocales(nuevasCalificaciones)

      cerrarFormulario()

      await alertaExito(
        'Calificación guardada',
        'Los cambios se guardaron correctamente.'
      )
    } catch (error) {
      await alertaError(
        'No pudimos guardar el parcial',
        error.message || 'Revisa tu conexión a internet.'
      )
    }
  }

  const eliminarParcial = async (parcial) => {
    if (modoOffline || !navigator.onLine) {
      await alertaError(
        'Sin conexión',
        'Necesitas internet para eliminar calificaciones.'
      )
      return
    }

    const confirmado = await alertaConfirmacion(
      '¿Eliminar este parcial?',
      `${parcial.periodo} se eliminará de tus calificaciones.`
    )

    if (!confirmado.isConfirmed) return

    try {
      const { error } = await supabase
        .from('calificaciones')
        .delete()
        .eq('id', parcial.id)
        .eq('user_id', usuario.id)

      if (error) throw error

      const nuevasCalificaciones = calificaciones.filter(
        (nota) => nota.id !== parcial.id
      )

      setCalificaciones(nuevasCalificaciones)
      actualizarCalificacionesLocales(nuevasCalificaciones)

      await alertaExito(
        'Parcial eliminado',
        'La calificación se eliminó correctamente.'
      )
    } catch (error) {
      await alertaError(
        'No pudimos eliminar el parcial',
        error.message || 'Revisa tu conexión a internet.'
      )
    }
  }

  return (
    <div className="materias-page">

      {  }

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
            ? 'Estás viendo tus calificaciones guardadas en este dispositivo.'
            : 'No hay calificaciones guardadas todavía en este dispositivo.'}
          {' '}Para realizar cambios necesitas internet.
        </div>
      )}

      {  }

      <div className="materias-header">
        <div>
          <p className="dashboard-small-title">
            RENDIMIENTO ACADÉMICO
          </p>

          <h1>📊 Mis calificaciones</h1>

          <p>
            Consulta tus calificaciones y lleva el control
            de tu promedio académico.
          </p>
        </div>

        {promedioGeneral !== null && (
          <div className="general-average-card">
            <div className="general-average-icon">
              🎓
            </div>

            <div className="general-average-info">
              <span>Promedio general</span>

              <p>
                Calculado con {promediosMaterias.length}{' '}
                {promediosMaterias.length === 1
                  ? 'materia'
                  : 'materias'}
              </p>
            </div>

            <strong>
              {promedioGeneral.toFixed(1)}
            </strong>
          </div>
        )}
      </div>

      { }

      {cargando ? (
        <div className="materias-empty">
          <p>Cargando calificaciones...</p>
        </div>
      ) : materiasMostradas.length === 0 ? (
        <div className="materias-empty">
          <div className="empty-icon">
            📚
          </div>

          <h2>
            {modoOffline && !hayCopiaLocal
              ? 'No hay calificaciones guardadas'
              : 'Aún no tienes materias'}
          </h2>

          <p>
            {modoOffline && !hayCopiaLocal
              ? 'Conéctate a internet y entra a Mis calificaciones para guardar una copia.'
              : 'Agrega una materia personal o inscríbete en un grupo para consultar tus calificaciones.'}
          </p>
        </div>
      ) : (
        <div className="grades-grid">

          {materiasMostradas.map((materia) => {
            const parciales = obtenerParciales(materia)
            const promedioMateria = calcularPromedio(parciales)

            return (
              <div
                className="grade-card"
                key={
                  materia.esGrupo
                    ? `grupo-${materia.grupoId}`
                    : `personal-${materia.id}`
                }
              >
                <div
                  className="grade-card-color"
                  style={{
                    background: materia.color || '#078b87'
                  }}
                />

                <div className="grade-card-content">
                  <div className="grade-card-header">
                    <div>
                      <h2>{materia.nombre}</h2>

                      {materia.esGrupo ? (
                        <>
                          <p>
                            👥 {materia.nombreGrupo} · Materia de grupo
                          </p>

                          <p>
                            🔒 Calificaciones administradas
                            por tu profesor
                          </p>
                        </>
                      ) : materia.profesor ? (
                        <p>{materia.profesor}</p>
                      ) : null}
                    </div>

                    <div className="grade-average">
                      <span>Promedio</span>

                      <strong>
                        {promedioMateria === null
                          ? '—'
                          : promedioMateria.toFixed(1)}
                      </strong>
                    </div>
                  </div>

                  { }

                  {parciales.length === 0 ? (
                    <div className="grade-empty">
                      <p>
                        {materia.esGrupo
                          ? 'Tu profesor todavía no ha registrado calificaciones.'
                          : 'Aún no has registrado parciales.'}
                      </p>

                      {!materia.esGrupo && (
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => abrirFormulario(materia)}
                        >
                          + Agregar parcial
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grade-periods">
                      <div className="grade-periods-list">

                        {parciales.map((parcial) => (
                          <div
                            className="grade-period"
                            key={parcial.id}
                          >
                            <span>{parcial.periodo}</span>

                            <div className="grade-period-right">
                              <strong>
                                {Number(
                                  parcial.promedio
                                ).toFixed(1)}
                              </strong>

                              {!materia.esGrupo && (
                                <>
                                  <button
                                    type="button"
                                    className="grade-action-button"
                                    title="Editar parcial"
                                    onClick={() =>
                                      abrirFormulario(
                                        materia,
                                        parcial
                                      )
                                    }
                                  >
                                    ✏️
                                  </button>

                                  <button
                                    type="button"
                                    className="grade-action-button grade-delete-button"
                                    title="Eliminar parcial"
                                    onClick={() =>
                                      eliminarParcial(parcial)
                                    }
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {!materia.esGrupo && (
                        <div className="grade-periods-actions">
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() =>
                              abrirFormulario(materia)
                            }
                          >
                            + Agregar parcial
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      { }

      {materiaSeleccionada && !materiaSeleccionada.esGrupo && (
        <div className="grade-modal-overlay">
          <div className="grade-modal">

            <div className="form-card-header">
              <div>
                <h2>
                  {parcialEditando
                    ? 'Editar parcial'
                    : 'Agregar parcial'}
                </h2>

                <p>{materiaSeleccionada.nombre}</p>
              </div>

              <button
                type="button"
                className="close-form-button"
                onClick={cerrarFormulario}
              >
                ✕
              </button>
            </div>

            <div className="form-group">
              <label>Nombre del periodo</label>

              <input
                type="text"
                placeholder="Ej. Parcial 1"
                value={periodo}
                onChange={(e) =>
                  setPeriodo(e.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label>Promedio</label>

              <input
                type="number"
                placeholder="Ej. 8.5"
                min="0"
                max="10"
                step="0.1"
                value={promedio}
                onChange={(e) =>
                  setPromedio(e.target.value)
                }
              />
            </div>

            <div className="grade-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cerrarFormulario}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={guardarParcial}
              >
                {parcialEditando
                  ? 'Guardar cambios'
                  : 'Guardar parcial'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

export default Calificaciones
