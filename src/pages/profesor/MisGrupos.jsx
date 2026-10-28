import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { alertaExito, alertaError, alertaConfirmacion } from '../../utils/alertas'
import './MisGrupos.css'

const inicial = { nombre: '', materia: '', descripcion: '' }

function crearCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const numeros = new Uint32Array(8)
  crypto.getRandomValues(numeros)
  return Array.from(numeros, (numero) => letras[numero % letras.length]).join('')
}

function MisGrupos({ usuario }) {
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formulario, setFormulario] = useState(inicial)

  const cargarGrupos = async () => {
    if (!usuario?.id) {
      setCargando(false)
      return
    }
    setCargando(true)
    const { data, error } = await supabase
      .from('grupos')
      .select('id, created_at, profesor_id, nombre, materia, codigo, descripcion')
      .eq('profesor_id', usuario.id)
      .order('created_at', { ascending: false })
    if (error) {
      await alertaError('No pudimos cargar tus grupos', error.message)
    } else {
      setGrupos(data || [])
    }
    setCargando(false)
  }

  useEffect(() => {
    cargarGrupos()
  }, [usuario?.id])

  const cerrarFormulario = () => {
    if (guardando) return
    setMostrarFormulario(false)
    setEditando(null)
    setFormulario(inicial)
  }

  const nuevoGrupo = () => {
    setEditando(null)
    setFormulario(inicial)
    setMostrarFormulario(true)
  }

  const editarGrupo = (grupo) => {
    setEditando(grupo)
    setFormulario({
      nombre: grupo.nombre || '',
      materia: grupo.materia || '',
      descripcion: grupo.descripcion || ''
    })
    setMostrarFormulario(true)
  }

  const guardarGrupo = async (evento) => {
    evento.preventDefault()
    if (guardando) return
    if (!usuario?.id) {
      await alertaError('Sesión no disponible', 'Inicia sesión de nuevo.')
      return
    }
    const nombre = formulario.nombre.trim()
    const materia = formulario.materia.trim()
    const descripcion = formulario.descripcion.trim()
    if (!nombre || !materia) {
      await alertaError('Faltan datos', 'Escribe el nombre del grupo y la materia.')
      return
    }

    setGuardando(true)
    try {
      if (editando) {
        const { error } = await supabase
          .from('grupos')
          .update({ nombre, materia, descripcion })
          .eq('id', editando.id)
          .eq('profesor_id', usuario.id)
        if (error) throw error
        await alertaExito('Grupo actualizado', 'Los cambios se guardaron correctamente.')
      } else {
        let creado = false
        for (let intento = 0; intento < 3 && !creado; intento++) {
          const { error } = await supabase.from('grupos').insert({
            profesor_id: usuario.id,
            nombre,
            materia,
            descripcion,
            codigo: crearCodigo()
          })
          if (!error) {
            creado = true
          } else if (error.code !== '23505') {
            throw error
          }
        }
        if (!creado) throw new Error('No se pudo generar un código único. Inténtalo de nuevo.')
        await alertaExito('¡Grupo creado!', 'Ya puedes compartir su código con tus alumnos cuando habilitemos las inscripciones.')
      }
      setMostrarFormulario(false)
      setEditando(null)
      setFormulario(inicial)
      await cargarGrupos()
    } catch (error) {
      await alertaError('No pudimos guardar el grupo', error.message || 'Ocurrió un error inesperado.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminarGrupo = async (grupo) => {
    const respuesta = await alertaConfirmacion(
      '¿Eliminar este grupo?',
      `Se eliminará “${grupo.nombre}”. Esta acción no se puede deshacer.`
    )
    if (!respuesta.isConfirmed) return
    const { error } = await supabase
      .from('grupos')
      .delete()
      .eq('id', grupo.id)
      .eq('profesor_id', usuario.id)
    if (error) {
      await alertaError('No pudimos eliminar el grupo', error.message)
      return
    }
    await alertaExito('Grupo eliminado', 'El grupo se eliminó correctamente.')
    await cargarGrupos()
  }

  const copiarCodigo = async (codigo) => {
    try {
      await navigator.clipboard.writeText(codigo)
      await alertaExito('Código copiado', 'Puedes compartirlo con tus alumnos.')
    } catch {
      await alertaError('No se pudo copiar', `Copia el código manualmente: ${codigo}`)
    }
  }

  return (
    <section className="prof-groups">
      <div className="prof-groups-heading">
        <div>
          <p className="prof-groups-eyebrow">PANEL DOCENTE</p>
          <h1>👥 Mis grupos</h1>
          <p>Organiza tus clases y prepara el acceso de tus estudiantes.</p>
        </div>
        <button type="button" className="prof-groups-primary" onClick={nuevoGrupo}>
          + Crear grupo
        </button>
      </div>

      {cargando ? (
        <div className="prof-groups-empty">Cargando tus grupos...</div>
      ) : grupos.length === 0 ? (
        <div className="prof-groups-empty">
          <span className="prof-groups-empty-icon">📚</span>
          <h2>Aún no tienes grupos</h2>
          <p>Crea tu primer grupo para organizar tus materias.</p>
          <button type="button" className="prof-groups-primary" onClick={nuevoGrupo}>
            Crear mi primer grupo
          </button>
        </div>
      ) : (
        <div className="prof-groups-grid">
          {grupos.map((grupo) => (
            <article className="prof-group-card" key={grupo.id}>
              <div className="prof-group-card-accent" />
              <div className="prof-group-card-body">
                <p className="prof-group-subject">{grupo.materia}</p>
                <h2>{grupo.nombre}</h2>
                {grupo.descripcion && <p className="prof-group-description">{grupo.descripcion}</p>}
                <div className="prof-group-code">
                  <div>
                    <span>Código de acceso</span>
                    <strong>{grupo.codigo}</strong>
                  </div>
                  <button type="button" onClick={() => copiarCodigo(grupo.codigo)}>
                    Copiar
                  </button>
                </div>
                <p className="prof-group-note"> Ya puedes compartir el código con tus alumnos.</p>
                <div className="prof-group-actions">
                  <button type="button" onClick={() => editarGrupo(grupo)}>✏️ Editar</button>
                  <button type="button" className="prof-group-danger" onClick={() => eliminarGrupo(grupo)}>🗑️ Eliminar</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {mostrarFormulario && (
        <div className="prof-groups-overlay" role="presentation">
          <div className="prof-groups-modal" role="dialog" aria-modal="true" aria-labelledby="prof-group-form-title">
            <div className="prof-groups-modal-header">
              <div>
                <p className="prof-groups-eyebrow">PANEL DOCENTE</p>
                <h2 id="prof-group-form-title">{editando ? '✏️ Editar grupo' : '👥 Crear grupo'}</h2>
              </div>
              <button type="button" className="prof-groups-close" onClick={cerrarFormulario} disabled={guardando} aria-label="Cerrar">✕</button>
            </div>
            <form onSubmit={guardarGrupo} className="prof-groups-form">
              <label>
                Nombre del grupo
                <input required maxLength={100} placeholder="Ej. Grupo A - 3.º semestre" value={formulario.nombre} disabled={guardando}
                  onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} />
              </label>
              <label>
                Materia
                <input required maxLength={100} placeholder="Ej. Matemáticas" value={formulario.materia} disabled={guardando}
                  onChange={(e) => setFormulario({ ...formulario, materia: e.target.value })} />
              </label>
              <label>
                Descripción (opcional)
                <textarea rows={3} maxLength={500} placeholder="Información para identificar este grupo" value={formulario.descripcion} disabled={guardando}
                  onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })} />
              </label>
              <p className="prof-group-form-hint">Study generará automáticamente un código de acceso único al crear el grupo.</p>
              <div className="prof-groups-form-actions">
                <button type="button" className="prof-groups-secondary" onClick={cerrarFormulario} disabled={guardando}>Cancelar</button>
                <button type="submit" className="prof-groups-primary" disabled={guardando}>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear grupo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default MisGrupos
