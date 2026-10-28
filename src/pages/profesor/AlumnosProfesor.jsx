import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './AlumnosProfesor.css'

function AlumnosProfesor({ usuario }) {
  const [grupos, setGrupos] = useState([])
  const [grupoId, setGrupoId] = useState('')
  const [alumnos, setAlumnos] = useState([])
  const [cargandoGrupos, setCargandoGrupos] = useState(true)
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true

    async function cargarGrupos() {
      setCargandoGrupos(true)
      setError('')

      const { data, error: consultaError } = await supabase
        .from('grupos')
        .select('id, nombre, materia')
        .eq('profesor_id', usuario.id)
        .order('created_at', { ascending: false })

      if (!activo) return

      if (consultaError) {
        setError('No pudimos cargar tus grupos: ' + consultaError.message)
        setGrupos([])
      } else {
        const lista = data || []
        setGrupos(lista)
        setGrupoId((actual) =>
          lista.some((grupo) => String(grupo.id) === actual)
            ? actual
            : lista.length ? String(lista[0].id) : ''
        )
      }
      setCargandoGrupos(false)
    }

    if (usuario?.id) cargarGrupos()
    else {
      setError('Debes iniciar sesión como profesor.')
      setCargandoGrupos(false)
    }

    return () => { activo = false }
  }, [usuario?.id])

  useEffect(() => {
    let activo = true

    async function cargarAlumnos() {
      setCargandoAlumnos(true)
      setAlumnos([])
      setError('')

      const { data, error: consultaError } = await supabase.rpc(
        'obtener_alumnos_grupo',
        { p_grupo_id: Number(grupoId) }
      )

      if (!activo) return

      if (consultaError) {
        setError('No pudimos consultar los alumnos: ' + consultaError.message)
      } else {
        setAlumnos(data || [])
      }
      setCargandoAlumnos(false)
    }

    if (grupoId) cargarAlumnos()
    else setAlumnos([])

    return () => { activo = false }
  }, [grupoId])

  const grupoActual = grupos.find((grupo) => String(grupo.id) === grupoId)

  return (
    <section className="alumnos-profesor">
      <header className="alumnos-profesor-encabezado">
        <p className="alumnos-profesor-etiqueta">PANEL DOCENTE</p>
        <h1>🎓 Alumnos</h1>
        <p>Consulta los estudiantes inscritos en cada uno de tus grupos.</p>
      </header>

      <div className="alumnos-profesor-panel">
        <label htmlFor="grupo-profesor-select">Selecciona un grupo</label>
        <select
          id="grupo-profesor-select"
          value={grupoId}
          onChange={(evento) => setGrupoId(evento.target.value)}
          disabled={cargandoGrupos || grupos.length === 0}
        >
          {grupos.length === 0 && <option value="">No tienes grupos creados</option>}
          {grupos.map((grupo) => (
            <option key={grupo.id} value={String(grupo.id)}>
              {grupo.materia} — {grupo.nombre}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="alumnos-profesor-error" role="alert">{error}</p>}

      {cargandoGrupos || cargandoAlumnos ? (
        <div className="alumnos-profesor-vacio">Cargando información...</div>
      ) : grupos.length === 0 ? (
        <div className="alumnos-profesor-vacio">
          <span>👥</span>
          <h2>Aún no tienes grupos</h2>
          <p>Crea uno desde la sección Mis grupos.</p>
        </div>
      ) : (
        <>
          <div className="alumnos-profesor-resumen">
            <div>
              <h2>{grupoActual?.materia}</h2>
              <p>{grupoActual?.nombre}</p>
            </div>
            <span>{alumnos.length} {alumnos.length === 1 ? 'alumno' : 'alumnos'}</span>
          </div>

          {alumnos.length === 0 ? (
            <div className="alumnos-profesor-vacio">
              <span>🎓</span>
              <h2>Aún no hay alumnos inscritos</h2>
              <p>Cuando los estudiantes utilicen el código del grupo, aparecerán aquí.</p>
            </div>
          ) : (
            <div className="alumnos-profesor-lista">
              {alumnos.map((alumno) => (
                <article className="alumnos-profesor-tarjeta" key={alumno.alumno_id}>
                  <div className="alumnos-profesor-avatar">🎓</div>
                  <div className="alumnos-profesor-datos">
                    <h3>{alumno.nombre || 'Estudiante sin nombre'}</h3>
                    <p>📚 {alumno.carrera || 'Carrera no registrada'}</p>
                    <p>📅 Semestre: {alumno.semestre || 'No registrado'}</p>
                  </div>
                  <span className="alumnos-profesor-inscrito">Inscrito</span>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default AlumnosProfesor
