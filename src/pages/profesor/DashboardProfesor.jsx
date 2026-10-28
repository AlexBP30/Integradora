import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import logoStudy from '../../assets/logo.png'
import MisGrupos from './MisGrupos'
import AlumnosProfesor from './AlumnosProfesor'
import CalificacionesProfesor from './CalificacionesProfesor'
import ActividadesProfesor from './ActividadesProfesor'
import EntregasProfesor from './EntregasProfesor'
import AvisosProfesor from './AvisosProfesor'
import PerfilProfesor from './PerfilProfesor'
import ChatStudy from '../chat/ChatStudy'
import './DashboardProfesor.css'

const opciones = [
  { id: 'inicio', icono: '🏠', nombre: 'Inicio' },
  { id: 'grupos', icono: '👥', nombre: 'Mis grupos' },
  { id: 'alumnos', icono: '🎓', nombre: 'Alumnos' },
  { id: 'actividades', icono: '📝', nombre: 'Actividades' },
  { id: 'entregas', icono: '📥', nombre: 'Entregas' },
  { id: 'calificaciones', icono: '📊', nombre: 'Calificaciones' },
  { id: 'avisos', icono: '🔔', nombre: 'Avisos' },
  { id: 'mensajes', icono: '💬', nombre: 'Mensajes' },
  { id: 'perfil', icono: '👤', nombre: 'Perfil' }
]

const indicadores = [
  { id: 'grupos', icono: '👥', titulo: 'Mis grupos', campo: 'grupos' },
  { id: 'alumnos', icono: '🎓', titulo: 'Estudiantes', campo: 'alumnos' },
  { id: 'actividades', icono: '📝', titulo: 'Actividades', campo: 'actividades' },
  { id: 'entregas', icono: '📥', titulo: 'Por revisar', campo: 'porRevisar' },
  { id: 'avisos', icono: '🔔', titulo: 'Avisos publicados', campo: 'avisos' }
]

const resumenInicial = {
  grupos: 0,
  alumnos: 0,
  actividades: 0,
  porRevisar: 0,
  avisos: 0
}

function DashboardProfesor({ usuario, cerrarSesion }) {
  const [modoOscuro, setModoOscuro] = useState(() => {
    try {
      return localStorage.getItem('study-tema') === 'oscuro'
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = modoOscuro ? 'dark' : 'light'
    try {
      localStorage.setItem('study-tema', modoOscuro ? 'oscuro' : 'claro')
    } catch {
    }
  }, [modoOscuro])

  const [seccion, setSeccion] = useState('inicio')
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)

  const cambiarSeccion = (destino) => {
    setSeccion(destino)
    setMenuMovilAbierto(false)
  }
  const [usuarioActual, setUsuarioActual] = useState(usuario)
  useEffect(() => { setUsuarioActual(usuario) }, [usuario])
  const [resumen, setResumen] = useState(resumenInicial)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [errorResumen, setErrorResumen] = useState('')
  const [mensajesSinLeer, setMensajesSinLeer] = useState(0)
  const nombre = usuarioActual?.user_metadata?.nombre || 'Profesor'
  const seccionActual = opciones.find((opcion) => opcion.id === seccion)

  const cargarResumen = useCallback(async () => {
    if (!usuario?.id) {
      setResumen(resumenInicial)
      return
    }

    setCargandoResumen(true)
    setErrorResumen('')

    try {
      const { data: grupos, error: errorGrupos } = await supabase
        .from('grupos')
        .select('id')
        .eq('profesor_id', usuario.id)

      if (errorGrupos) throw errorGrupos

      const idsGrupos = (grupos || []).map((grupo) => grupo.id)
      if (idsGrupos.length === 0) {
        setResumen(resumenInicial)
        return
      }

      const [alumnosRes, actividadesRes, avisosRes] = await Promise.all([
        supabase.from('grupo_alumnos').select('alumno_id').in('grupo_id', idsGrupos),
        supabase.from('actividades').select('id').in('grupo_id', idsGrupos),
        supabase.from('avisos').select('id', { count: 'exact', head: true }).in('grupo_id', idsGrupos)
      ])

      if (alumnosRes.error) throw alumnosRes.error
      if (actividadesRes.error) throw actividadesRes.error
      if (avisosRes.error) throw avisosRes.error

      const actividadesIds = (actividadesRes.data || []).map((actividad) => actividad.id)
      let porRevisar = 0

      if (actividadesIds.length > 0) {
        const { count, error } = await supabase
          .from('entregas_actividades')
          .select('actividad_id', { count: 'exact', head: true })
          .in('actividad_id', actividadesIds)
          .in('estado', ['entregada', 'en_revision'])

        if (error) throw error
        porRevisar = count ?? 0
      }

      const estudiantesUnicos = new Set(
        (alumnosRes.data || []).map((registro) => registro.alumno_id).filter(Boolean)
      )

      setResumen({
        grupos: idsGrupos.length,
        alumnos: estudiantesUnicos.size,
        actividades: actividadesIds.length,
        porRevisar,
        avisos: avisosRes.count ?? 0
      })
    } catch (error) {
      setErrorResumen(`No se pudo cargar el resumen: ${error.message}`)
    } finally {
      setCargandoResumen(false)
    }
  }, [usuario?.id])

  useEffect(() => {
    if (seccion === 'inicio') cargarResumen()
  }, [seccion, cargarResumen])


  const cargarMensajesSinLeer = useCallback(async () => {
    if (!usuario?.id) {
      setMensajesSinLeer(0)
      return
    }

    try {
      const { data: grupos, error: errorGrupos } = await supabase
        .from('grupos')
        .select('id')
        .eq('profesor_id', usuario.id)

      if (errorGrupos) throw errorGrupos
      const idsGrupos = (grupos || []).map(grupo => grupo.id)
      if (!idsGrupos.length) {
        setMensajesSinLeer(0)
        return
      }

      const { count, error: errorMensajes } = await supabase
        .from('mensajes_chat')
        .select('id', { count: 'exact', head: true })
        .in('grupo_id', idsGrupos)
        .neq('remitente_id', usuario.id)
        .is('leido_at', null)

      if (errorMensajes) throw errorMensajes
      setMensajesSinLeer(count ?? 0)
    } catch (error) {
      console.error('No se pudo consultar el contador de mensajes del profesor:', error)
    }
  }, [usuario?.id])

  useEffect(() => {
    cargarMensajesSinLeer()
  }, [cargarMensajesSinLeer, seccion])

  useEffect(() => {
    if (!usuario?.id) return

    const canal = supabase
      .channel(`contador-mensajes-profesor-${usuario.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mensajes_chat'
      }, () => { cargarMensajesSinLeer() })
      .subscribe()

    const intervalo = setInterval(cargarMensajesSinLeer, 20000)
    return () => {
      clearInterval(intervalo)
      supabase.removeChannel(canal)
    }
  }, [usuario?.id, cargarMensajesSinLeer])

  return (
    <div className="profesor-layout">
      <header className="profesor-mobile-header">
        <button type="button" className="profesor-mobile-toggle"
          aria-label="Abrir menú docente" aria-expanded={menuMovilAbierto}
          aria-controls="profesor-menu-lateral"
          onClick={() => setMenuMovilAbierto(true)}>☰</button>
        <img src={logoStudy} alt="" />
        <strong>Study</strong>
      </header>

      {menuMovilAbierto && (
        <button type="button" className="profesor-mobile-overlay"
          aria-label="Cerrar menú docente"
          onClick={() => setMenuMovilAbierto(false)} />
      )}

      <aside id="profesor-menu-lateral" className={`profesor-sidebar ${menuMovilAbierto ? 'profesor-sidebar-open' : ''}`}>
        <button type="button" className="profesor-mobile-close"
          aria-label="Cerrar menú" onClick={() => setMenuMovilAbierto(false)}>✕</button>
        <div className="profesor-brand">
          <img src={logoStudy} alt="Study" />
          <span>Study</span>
        </div>

        <p className="profesor-menu-label">PANEL DOCENTE</p>

        <nav className="profesor-menu" aria-label="Menú del profesor">
          {opciones.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              className={seccion === opcion.id ? 'profesor-menu-item active' : 'profesor-menu-item'}
              onClick={() => cambiarSeccion(opcion.id)}
            >
              <span aria-hidden="true">{opcion.icono}</span>
              <span>{opcion.nombre}</span>
              {opcion.id === 'mensajes' && mensajesSinLeer > 0 && (
                <span
                  aria-label={`${mensajesSinLeer} mensajes sin leer`}
                  style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', borderRadius: '999px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700, minWidth: '24px', textAlign: 'center' }}
                >
                  {mensajesSinLeer > 99 ? '99+' : mensajesSinLeer}
                </span>
              )}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="study-theme-toggle"
          onClick={() => setModoOscuro((actual) => !actual)}
          aria-label={modoOscuro ? 'Activar modo claro' : 'Activar modo oscuro'}
          aria-pressed={modoOscuro}
        >
          <span aria-hidden="true">{modoOscuro ? '☀️' : '🌙'}</span>
          {modoOscuro ? 'Modo claro' : 'Modo oscuro'}
        </button>

        <button type="button" className="profesor-logout" onClick={() => { setMenuMovilAbierto(false); cerrarSesion() }}>
          🚪 Cerrar sesión
        </button>
      </aside>

      <main className="profesor-main">
        {seccion === 'inicio' ? (
          <>
            <div className="profesor-page-heading">
              <p className="profesor-eyebrow">PANEL DOCENTE</p>
              <h1>¡Bienvenido, {nombre}! 👋</h1>
              <p>Administra tus grupos, alumnos, actividades y calificaciones desde Study.</p>
            </div>

            <section aria-label="Resumen de tus clases" style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, color: '#173c43' }}>📊 Resumen de tus clases</h2>
                <button type="button" className="profesor-primary-button" onClick={cargarResumen} disabled={cargandoResumen}>
                  {cargandoResumen ? 'Actualizando...' : '↻ Actualizar'}
                </button>
              </div>

              {errorResumen && (
                <p role="alert" style={{ color: '#b42318', background: '#fff1ef', padding: '12px', borderRadius: '10px' }}>
                  {errorResumen}
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                {indicadores.map((indicador) => (
                  <article
                    key={indicador.id}
                    style={{ background: '#fff', border: '1px solid #dce7e8', borderRadius: '16px', padding: '20px', boxShadow: '0 3px 12px rgba(0,0,0,0.03)' }}
                  >
                    <div style={{ fontSize: '1.7rem', marginBottom: '10px' }} aria-hidden="true">{indicador.icono}</div>
                    <strong style={{ display: 'block', fontSize: '2rem', color: '#087f7b', lineHeight: 1.2 }}>
                      {cargandoResumen || errorResumen ? '—' : resumen[indicador.campo]}
                    </strong>
                    <p style={{ margin: '8px 0 14px', color: '#526977' }}>{indicador.titulo}</p>
                    <button type="button" className="profesor-primary-button" onClick={() => setSeccion(indicador.id)}>
                      Ver sección
                    </button>
                  </article>
                ))}
              </div>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '12px' }}>
                Estudiantes únicos de tus grupos. Por revisar incluye entregas enviadas o en revisión.
              </p>
            </section>

            <div className="profesor-grid">
              {opciones.filter((opcion) => opcion.id !== 'inicio').map((opcion) => (
                <article key={opcion.id} className="profesor-card">
                  <div className="profesor-card-icon" aria-hidden="true">{opcion.icono}</div>
                  <h2>{opcion.nombre}</h2>
                  <p>Gestiona esta sección de tus clases.</p>
                  <button
                    type="button"
                    className="profesor-primary-button"
                    onClick={() => cambiarSeccion(opcion.id)}
                  >
                    Ir a {opcion.nombre}
                  </button>
                </article>
              ))}
            </div>
          </>
        ) : seccion === 'grupos' ? (
          <MisGrupos usuario={usuario} />
        ) : seccion === 'alumnos' ? (
          <AlumnosProfesor usuario={usuario} />
        ) : seccion === 'actividades' ? (
          <ActividadesProfesor usuario={usuario} />
        ) : seccion === 'entregas' ? (
          <EntregasProfesor usuario={usuario} />
        ) : seccion === 'calificaciones' ? (
          <CalificacionesProfesor usuario={usuario} />
        ) : seccion === 'avisos' ? (
          <AvisosProfesor usuario={usuario} />
        ) : seccion === 'mensajes' ? (
          <ChatStudy usuario={usuarioActual} rol="profesor" />
        ) : seccion === 'perfil' ? (
          <PerfilProfesor usuario={usuarioActual} onUsuarioActualizado={setUsuarioActual} />
        ) : (
          <>
            <div className="profesor-page-heading">
              <p className="profesor-eyebrow">PANEL DOCENTE</p>
              <h1>{seccionActual?.icono} {seccionActual?.nombre}</h1>
              <p>Aquí podrás administrar {seccionActual?.nombre.toLowerCase()}.</p>
            </div>
            <div className="profesor-empty">
              <span className="profesor-empty-icon" aria-hidden="true">{seccionActual?.icono}</span>
              <h2>Próximamente</h2>
              <p>Prepararemos esta sección para conectarla con Supabase.</p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default DashboardProfesor