import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { alertaError, alertaExito, alertaConfirmacion } from '../../utils/alertas'
import './GruposEstudiante.css'

function GruposEstudiante({ usuario }) {
  const [codigo, setCodigo] = useState('')
  const [inscripciones, setInscripciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)

  const cargarGrupos = async () => {
    if (!usuario?.id) {
      setInscripciones([])
      setCargando(false)
      return
    }

    setCargando(true)
    const { data, error } = await supabase
      .from('grupo_alumnos')
      .select('id, grupo_id, created_at')
      .eq('alumno_id', usuario.id)
      .order('created_at', { ascending: false })

    if (error) {
      await alertaError('No pudimos cargar tus grupos', error.message)
      setCargando(false)
      return
    }

    if (!data?.length) {
      setInscripciones([])
      setCargando(false)
      return
    }
    
    const { data: grupos, error: gruposError } = await supabase.rpc('obtener_mis_grupos')

    if (gruposError) {
      await alertaError('No pudimos consultar los grupos', gruposError.message)
      setCargando(false)
      return
    }

    const gruposPorId = new Map((grupos || []).map((grupo) => [String(grupo.id), grupo]))
    setInscripciones(data.map((item) => ({
      ...item,
      grupo: gruposPorId.get(String(item.grupo_id)) || null
    })))
    setCargando(false)
  }

  useEffect(() => {
    cargarGrupos()
  }, [usuario?.id])

  const unirse = async (evento) => {
    evento.preventDefault()
    const codigoLimpio = codigo.trim().toUpperCase()
    if (!codigoLimpio || procesando) return

    setProcesando(true)
    const { error } = await supabase.rpc('unirse_a_grupo', {
      p_codigo: codigoLimpio
    })
    setProcesando(false)

    if (error) {
      await alertaError('No pudimos unirte al grupo', error.message)
      return
    }

    setCodigo('')
    await cargarGrupos()
    await alertaExito('¡Te uniste al grupo!', 'Ya puedes consultar tu inscripción.')
  }

  const abandonar = async (inscripcion) => {
    if (procesando) return
    const respuesta = await alertaConfirmacion(
      '¿Abandonar este grupo?',
      'Dejarás de aparecer entre los alumnos inscritos.'
    )
    if (!respuesta.isConfirmed) return

    setProcesando(true)
    const { error } = await supabase
      .from('grupo_alumnos')
      .delete()
      .eq('id', inscripcion.id)
      .eq('alumno_id', usuario.id)
    setProcesando(false)

    if (error) {
      await alertaError('No pudimos abandonar el grupo', error.message)
      return
    }

    await cargarGrupos()
    await alertaExito('Grupo abandonado', 'Tu inscripción se eliminó correctamente.')
  }

  return (
    <section className="ge-page">
      <header className="ge-header">
        <p className="dashboard-small-title">COMUNIDAD ACADÉMICA</p>
        <h1>👥 Mis grupos</h1>
        <p>Inscríbete con el código que te proporcione tu profesor.</p>
      </header>

      <form className="ge-join" onSubmit={unirse}>
        <div className="ge-join-info">
          <h2>Unirme a un grupo</h2>
          <p>Escribe el código de acceso de tu clase.</p>
        </div>
        <div className="ge-join-controls">
          <input
            type="text"
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value.toUpperCase())}
            placeholder="Ej. MAT-4821"
            aria-label="Código de grupo"
            maxLength={40}
            required
            disabled={procesando}
          />
          <button type="submit" className="ge-primary" disabled={procesando || !codigo.trim()}>
            {procesando ? 'Procesando...' : 'Unirme al grupo'}
          </button>
        </div>
      </form>

      <div className="ge-section-title">
        <h2>Grupos inscritos</h2>
        <span>{inscripciones.length} {inscripciones.length === 1 ? 'grupo' : 'grupos'}</span>
      </div>

      {cargando ? (
        <div className="ge-empty">Cargando tus grupos...</div>
      ) : inscripciones.length === 0 ? (
        <div className="ge-empty">
          <span className="ge-empty-icon">🎓</span>
          <h3>Aún no perteneces a ningún grupo</h3>
          <p>Cuando tu profesor te comparta un código, podrás inscribirte aquí.</p>
        </div>
      ) : (
        <div className="ge-grid">
          {inscripciones.map((inscripcion) => (
            <article className="ge-card" key={inscripcion.id}>
              <div className="ge-card-top">
                <span className="ge-subject-icon">📚</span>
                <span className="ge-status">Inscrito</span>
              </div>
              <h3>{inscripcion.grupo?.materia || 'Materia del grupo'}</h3>
              <p className="ge-group-name">{inscripcion.grupo?.nombre || `Grupo #${inscripcion.grupo_id}`}</p>
              {inscripcion.grupo?.descripcion && <p className="ge-description">{inscripcion.grupo.descripcion}</p>}
              <button
                type="button"
                className="ge-leave"
                disabled={procesando}
                onClick={() => abandonar(inscripcion)}
              >
                Abandonar grupo
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default GruposEstudiante