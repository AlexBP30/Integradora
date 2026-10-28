
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  alertaExito,
  alertaError,
  alertaConfirmacion
} from '../../utils/alertas'
import './CalificacionesProfesor.css'

const promedioDe = (notas) => {
  if (!notas.length) return null

  return notas.reduce(
    (suma, nota) => suma + Number(nota.promedio),
    0
  ) / notas.length
}

function CalificacionesProfesor({ usuario }) {
  const [grupos, setGrupos] = useState([])
  const [grupoId, setGrupoId] = useState('')
  const [alumnos, setAlumnos] = useState([])
  const [notas, setNotas] = useState([])

  const [cargandoGrupos, setCargandoGrupos] = useState(true)
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false)

  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null)
  const [notaEditando, setNotaEditando] = useState(null)

  const [periodo, setPeriodo] = useState('')
  const [promedio, setPromedio] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [busquedaAlumno, setBusquedaAlumno] = useState('')

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      setCargandoGrupos(true)

      const { data, error } = await supabase
        .from('grupos')
        .select('id, nombre, materia')
        .eq('profesor_id', usuario.id)
        .order('created_at', { ascending: false })

      if (!activo) return

      if (error) {
        await alertaError(
          'No pudimos cargar tus grupos',
          error.message
        )
      } else {
        setGrupos(data || [])

        setGrupoId((actual) =>
          (data || []).some(
            (grupo) => String(grupo.id) === actual
          )
            ? actual
            : data?.[0]
              ? String(data[0].id)
              : ''
        )
      }

      setCargandoGrupos(false)
    }

    if (usuario?.id) cargar()

    return () => {
      activo = false
    }
  }, [usuario?.id])

  const cargarAlumnosYNotas = useCallback(
    async (id, activo = () => true) => {
      setCargandoAlumnos(true)

      const [respuestaAlumnos, respuestaNotas] =
        await Promise.all([
          supabase.rpc('obtener_alumnos_grupo', {
            p_grupo_id: Number(id)
          }),

          supabase
            .from('calificaciones_grupo')
            .select(
              'id, grupo_id, alumno_id, periodo, promedio, created_at'
            )
            .eq('grupo_id', Number(id))
            .order('created_at', { ascending: true })
        ])

      if (!activo()) return

      if (respuestaAlumnos.error || respuestaNotas.error) {
        await alertaError(
          'No pudimos cargar las calificaciones',
          respuestaAlumnos.error?.message ||
            respuestaNotas.error?.message
        )
      } else {
        setAlumnos(respuestaAlumnos.data || [])
        setNotas(respuestaNotas.data || [])
      }

      setCargandoAlumnos(false)
    },
    []
  )

  useEffect(() => {
    let activo = true

    setAlumnos([])
    setNotas([])
    setAlumnoSeleccionado(null)
    setBusquedaAlumno('')

    if (grupoId) {
      cargarAlumnosYNotas(grupoId, () => activo)
    } else {
      setCargandoAlumnos(false)
    }

    return () => {
      activo = false
    }
  }, [grupoId, cargarAlumnosYNotas])

  const grupoActual = grupos.find(
    (grupo) => String(grupo.id) === grupoId
  )

  const normalizarTexto = (texto) =>
    String(texto || '')
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

  const alumnosFiltrados = alumnos.filter((alumno) =>
    normalizarTexto(alumno.nombre || 'Estudiante')
      .includes(normalizarTexto(busquedaAlumno.trim()))
  )

  const abrirFormulario = (alumno, nota = null) => {
    setAlumnoSeleccionado(alumno)
    setNotaEditando(nota)
    setPeriodo(nota?.periodo || '')
    setPromedio(nota ? String(nota.promedio) : '')
  }

  const cerrarFormulario = () => {
    if (guardando) return

    setAlumnoSeleccionado(null)
    setNotaEditando(null)
    setPeriodo('')
    setPromedio('')
  }

  const guardarNota = async (evento) => {
    evento.preventDefault()

    if (!alumnoSeleccionado || !grupoId || guardando) return

    const valor = Number(promedio)

    if (
      !periodo.trim() ||
      promedio.trim() === '' ||
      !Number.isFinite(valor) ||
      valor < 0 ||
      valor > 10
    ) {
      await alertaError(
        'Datos incorrectos',
        'Escribe el periodo y una calificación entre 0 y 10.'
      )
      return
    }

    setGuardando(true)

    const datos = {
      periodo: periodo.trim(),
      promedio: valor
    }

    const respuesta = notaEditando
      ? await supabase
          .from('calificaciones_grupo')
          .update(datos)
          .eq('id', notaEditando.id)
          .eq('grupo_id', Number(grupoId))
          .eq('alumno_id', alumnoSeleccionado.alumno_id)
          .select()
          .single()
      : await supabase
          .from('calificaciones_grupo')
          .insert({
            ...datos,
            grupo_id: Number(grupoId),
            alumno_id: alumnoSeleccionado.alumno_id
          })
          .select()
          .single()

    setGuardando(false)

    if (respuesta.error) {
      await alertaError(
        'No pudimos guardar la calificación',
        respuesta.error.message
      )
      return
    }

    setAlumnoSeleccionado(null)
    setNotaEditando(null)
    setPeriodo('')
    setPromedio('')

    await cargarAlumnosYNotas(grupoId)

    await alertaExito(
      'Calificación guardada',
      'Los cambios se guardaron correctamente.'
    )
  }

  const eliminarNota = async (nota) => {
    const confirmacion = await alertaConfirmacion(
      '¿Eliminar parcial?',
      `Se eliminará "${nota.periodo}" de este alumno.`
    )

    if (!confirmacion.isConfirmed) return

    const { error } = await supabase
      .from('calificaciones_grupo')
      .delete()
      .eq('id', nota.id)
      .eq('grupo_id', Number(grupoId))

    if (error) {
      await alertaError(
        'No pudimos eliminar el parcial',
        error.message
      )
      return
    }

    await cargarAlumnosYNotas(grupoId)

    await alertaExito(
      'Parcial eliminado',
      'La calificación se eliminó correctamente.'
    )
  }

  return (
    <div className="cp-page">

      {  }
      <header className="profesor-page-heading">
        <p className="profesor-eyebrow">
          PANEL DOCENTE
        </p>

        <h1>📊 Calificaciones</h1>

        <p>
          Registra los parciales de tus alumnos.
          Cada estudiante podrá consultarlos desde su cuenta.
        </p>
      </header>

      {  }
      <div className="cp-barra-filtros">

        <section className="cp-selector">
          <label htmlFor="cp-grupo">
            Selecciona un grupo
          </label>

          <select
            id="cp-grupo"
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
            disabled={cargandoGrupos}
          >
            {grupos.length === 0 && (
              <option value="">
                No tienes grupos todavía
              </option>
            )}

            {grupos.map((grupo) => (
              <option
                key={grupo.id}
                value={String(grupo.id)}
              >
                {grupo.materia} — {grupo.nombre}
              </option>
            ))}
          </select>
        </section>

        <div className="cp-busqueda-grupo">
          <label htmlFor="cp-buscar-alumno">
            Buscar estudiante
          </label>

          <div className="cp-buscador">
            <span aria-hidden="true">🔎</span>

            <input
              id="cp-buscar-alumno"
              type="search"
              placeholder="Escribe el nombre del alumno..."
              value={busquedaAlumno}
              onChange={(e) =>
                setBusquedaAlumno(e.target.value)
              }
              disabled={
                !grupoId ||
                cargandoGrupos ||
                cargandoAlumnos
              }
            />
          </div>
        </div>

      </div>

      {  }
      {cargandoGrupos || cargandoAlumnos ? (
        <div className="cp-empty">
          Cargando alumnos y calificaciones...
        </div>
      ) : !grupoId ? (
        <div className="cp-empty">
          Primero crea un grupo en la sección Mis grupos.
        </div>
      ) : (
        <>
          {   }
          <div className="cp-section-heading">
            <div>
              <h2>
                {grupoActual?.materia || 'Materia'}
              </h2>

              <p>
                {grupoActual?.nombre || 'Grupo'}
              </p>
            </div>

            <span>
              {alumnos.length}{' '}
              {alumnos.length === 1
                ? 'alumno'
                : 'alumnos'}
            </span>
          </div>

          {  }
          {alumnos.length === 0 ? (
            <div className="cp-empty">
              Todavía no hay alumnos inscritos en este grupo.
            </div>
          ) : alumnosFiltrados.length === 0 ? (
            <div className="cp-empty">
              No se encontraron estudiantes con ese nombre.
            </div>
          ) : (
            <div className="cp-grid">

              {alumnosFiltrados.map((alumno) => {
                const parciales = notas.filter(
                  (nota) =>
                    nota.alumno_id === alumno.alumno_id
                )

                const media = promedioDe(parciales)

                return (
                  <article
                    className="cp-card"
                    key={alumno.alumno_id}
                  >

                    { }
                    <div className="cp-card-header">
                      <div>
                        <h3>
                          🎓 {alumno.nombre || 'Estudiante'}
                        </h3>

                        <p>
                          {alumno.carrera ||
                            'Carrera no especificada'}
                          {' · '}
                          Semestre {alumno.semestre || '—'}
                        </p>
                      </div>

                      <div className="cp-average">
                        <small>Promedio</small>

                        <strong>
                          {media === null
                            ? '—'
                            : media.toFixed(1)}
                        </strong>
                      </div>
                    </div>

                    {  }
                    {parciales.length === 0 ? (
                      <p className="cp-no-grades">
                        Todavía no hay parciales registrados.
                      </p>
                    ) : (
                      <div className="cp-periods">
                        {parciales.map((nota) => (
                          <div
                            className="cp-period"
                            key={nota.id}
                          >
                            <span>
                              {nota.periodo}
                            </span>

                            <div className="cp-period-actions">
                              <strong>
                                {Number(
                                  nota.promedio
                                ).toFixed(1)}
                              </strong>

                              <button
                                type="button"
                                title="Editar parcial"
                                onClick={() =>
                                  abrirFormulario(alumno, nota)
                                }
                              >
                                ✏️
                              </button>

                              <button
                                type="button"
                                title="Eliminar parcial"
                                onClick={() =>
                                  eliminarNota(nota)
                                }
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      className="cp-primary"
                      type="button"
                      onClick={() =>
                        abrirFormulario(alumno)
                      }
                    >
                      + Agregar parcial
                    </button>
                  </article>
                )
              })}

            </div>
          )}
        </>
      )}

      { }
      {alumnoSeleccionado && (
        <div
          className="cp-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              cerrarFormulario()
            }
          }}
        >
          <form
            className="cp-modal"
            onSubmit={guardarNota}
          >
            <div className="cp-modal-heading">
              <div>
                <h2>
                  {notaEditando
                    ? 'Editar parcial'
                    : 'Agregar parcial'}
                </h2>

                <p>
                  {alumnoSeleccionado.nombre ||
                    'Estudiante'}
                  {' · '}
                  {grupoActual?.materia}
                </p>
              </div>

              <button
                type="button"
                className="cp-close"
                onClick={cerrarFormulario}
                disabled={guardando}
              >
                ✕
              </button>
            </div>

            <label htmlFor="cp-periodo">
              Nombre del periodo
            </label>

            <input
              id="cp-periodo"
              type="text"
              placeholder="Ej. Parcial 1"
              value={periodo}
              onChange={(e) =>
                setPeriodo(e.target.value)
              }
              maxLength={100}
              required
            />

            <label htmlFor="cp-promedio">
              Calificación (0 a 10)
            </label>

            <input
              id="cp-promedio"
              type="number"
              min="0"
              max="10"
              step="0.1"
              placeholder="Ej. 9.5"
              value={promedio}
              onChange={(e) =>
                setPromedio(e.target.value)
              }
              required
            />

            <div className="cp-modal-actions">
              <button
                type="button"
                className="cp-secondary"
                onClick={cerrarFormulario}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="cp-primary"
                disabled={guardando}
              >
                {guardando
                  ? 'Guardando...'
                  : 'Guardar parcial'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default CalificacionesProfesor