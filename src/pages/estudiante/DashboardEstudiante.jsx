import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import logoStudy from '../../assets/logo.png'
import Materias from './Materias'
import Tareas from './Tareas'
import Horario from './Horario'
import Calificaciones from './Calificaciones'
import PlanEstudio from './PlanEstudio'
import GruposEstudiante from './GruposEstudiante'
import ActividadesEstudiante from './ActividadesEstudiante'
import PerfilEstudiante from './PerfilEstudiante'
import AvisosEstudiante from './AvisosEstudiante'
import ChatStudy from '../chat/ChatStudy'

function DashboardEstudiante({ usuario, cerrarSesion }) {

  const [seccionEstudiante, setSeccionEstudiante] = useState('inicio')
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)
  const [usuarioActual, setUsuarioActual] = useState(usuario)

  const [modoOscuro, setModoOscuro] = useState(() => {
    try {
      return localStorage.getItem('study-tema') === 'oscuro'
    } catch {
      return false
    }
  })

  const [avisosSinLeer, setAvisosSinLeer] = useState(0)
  const [mensajesSinLeer, setMensajesSinLeer] = useState(0)

  const [resumen, setResumen] = useState({
    total: 0,
    pendientes: 0,
    entregadas: 0,
    calificadas: 0,
    porCorregir: 0
  })

  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [errorResumen, setErrorResumen] = useState('')

  const [totalMaterias, setTotalMaterias] = useState(null)
  const [errorMaterias, setErrorMaterias] = useState('')

  const [tareasPendientes, setTareasPendientes] = useState([])
  const [cargandoTareas, setCargandoTareas] = useState(false)
  const [errorTareas, setErrorTareas] = useState('')

  const [promedioGeneral, setPromedioGeneral] = useState(null)
  const [cargandoPromedio, setCargandoPromedio] = useState(false)
  const [errorPromedio, setErrorPromedio] = useState('')

  const [proximaClase, setProximaClase] = useState(null)
  const [cargandoClase, setCargandoClase] = useState(false)
  const [errorClase, setErrorClase] = useState('')

  const [resumenPlanes, setResumenPlanes] = useState({
    activos: 0,
    materiasEnRiesgo: []
  })
  const [cargandoPlanes, setCargandoPlanes] = useState(false)
  const [errorPlanes, setErrorPlanes] = useState('')


  useEffect(() => {
    setUsuarioActual(usuario)
  }, [usuario])

  useEffect(() => {
    document.documentElement.dataset.theme = modoOscuro
      ? 'dark'
      : 'light'

    try {
      localStorage.setItem(
        'study-tema',
        modoOscuro ? 'oscuro' : 'claro'
      )
    } catch {
    }
  }, [modoOscuro])


  const cambiarSeccion = (seccion) => {
    setSeccionEstudiante(seccion)
    setMenuMovilAbierto(false)
  }

  useEffect(() => {
    if (!menuMovilAbierto) return

    const cerrarConEscape = (evento) => {
      if (evento.key === 'Escape') {
        setMenuMovilAbierto(false)
      }
    }

    window.addEventListener('keydown', cerrarConEscape)

    return () => {
      window.removeEventListener('keydown', cerrarConEscape)
    }
  }, [menuMovilAbierto])


  const cargarResumen = useCallback(async () => {
    if (!usuario?.id) return

    setCargandoResumen(true)
    setErrorResumen('')

    try {
      const {
        data: grupos,
        error: errorGrupos
      } = await supabase.rpc('obtener_mis_grupos')

      if (errorGrupos) throw errorGrupos

      const ids = (grupos || []).map((grupo) => grupo.id)

      if (!ids.length) {
        setResumen({
          total: 0,
          pendientes: 0,
          entregadas: 0,
          calificadas: 0,
          porCorregir: 0
        })
        return
      }

      const {
        data: actividades,
        error: errorActividades
      } = await supabase
        .from('actividades')
        .select('id')
        .in('grupo_id', ids)

      if (errorActividades) throw errorActividades

      const lista = actividades || []

      if (!lista.length) {
        setResumen({
          total: 0,
          pendientes: 0,
          entregadas: 0,
          calificadas: 0,
          porCorregir: 0
        })
        return
      }

      const {
        data: entregas,
        error: errorEntregas
      } = await supabase
        .from('entregas_actividades')
        .select('actividad_id, estado')
        .eq('alumno_id', usuario.id)
        .in(
          'actividad_id',
          lista.map((actividad) => actividad.id)
        )

      if (errorEntregas) throw errorEntregas

      const estados = new Map(
        (entregas || []).map((entrega) => [
          String(entrega.actividad_id),
          entrega.estado
        ])
      )

      const siguiente = {
        total: lista.length,
        pendientes: 0,
        entregadas: 0,
        calificadas: 0,
        porCorregir: 0
      }

      for (const actividad of lista) {
        const estado = estados.get(String(actividad.id))

        if (estado === 'calificada') {
          siguiente.calificadas += 1
        } else if (estado === 'correccion_solicitada') {
          siguiente.porCorregir += 1
        } else if (
          estado === 'entregada' ||
          estado === 'en_revision'
        ) {
          siguiente.entregadas += 1
        } else {
          siguiente.pendientes += 1
        }
      }

      setResumen(siguiente)
    } catch (error) {
      setErrorResumen(
        'No se pudo cargar el resumen de actividades: ' +
        error.message
      )
    } finally {
      setCargandoResumen(false)
    }
  }, [usuario?.id])


  const cargarTotalMaterias = useCallback(async () => {
    if (!usuario?.id) {
      setTotalMaterias(null)
      return
    }

    setErrorMaterias('')

    try {
      const [
        resultadoPersonales,
        resultadoGrupos
      ] = await Promise.all([
        supabase
          .from('materias')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', usuario.id),

        supabase.rpc('obtener_mis_grupos')
      ])

      if (resultadoPersonales.error) {
        throw resultadoPersonales.error
      }

      if (resultadoGrupos.error) {
        throw resultadoGrupos.error
      }

      setTotalMaterias(
        (resultadoPersonales.count ?? 0) +
        (resultadoGrupos.data || []).length
      )
    } catch (error) {
      setTotalMaterias(null)
      setErrorMaterias(
        'No se pudo cargar el total de materias: ' +
        error.message
      )
    }
  }, [usuario?.id])


  const cargarTareasPendientes = useCallback(async () => {
    if (!usuario?.id) {
      setTareasPendientes([])
      return
    }

    setCargandoTareas(true)
    setErrorTareas('')

    try {
      const { data, error } = await supabase
        .from('tareas')
        .select(
          'id, titulo, fecha_entrega, prioridad, estado, materia_id'
        )
        .eq('user_id', usuario.id)
        .eq('estado', 'pendiente')
        .order('fecha_entrega', { ascending: true })

      if (error) throw error

      setTareasPendientes(data || [])
    } catch (error) {
      setErrorTareas(
        'No se pudieron cargar tus tareas: ' +
        error.message
      )
      setTareasPendientes([])
    } finally {
      setCargandoTareas(false)
    }
  }, [usuario?.id])


  const cargarPromedioGeneral = useCallback(async () => {
    if (!usuario?.id) {
      setPromedioGeneral(null)
      return
    }

    setCargandoPromedio(true)
    setErrorPromedio('')

    try {
      const [
        materiasRes,
        notasRes,
        gruposRes
      ] = await Promise.all([
        supabase
          .from('materias')
          .select('id')
          .eq('user_id', usuario.id),

        supabase
          .from('calificaciones')
          .select('materia_id, promedio')
          .eq('user_id', usuario.id),

        supabase.rpc('obtener_mis_grupos')
      ])

      const fallo =
        materiasRes.error ||
        notasRes.error ||
        gruposRes.error

      if (fallo) throw fallo

      const grupos = gruposRes.data || []
      let notasGrupo = []

      if (grupos.length) {
        const { data, error } = await supabase
          .from('calificaciones_grupo')
          .select('grupo_id, promedio')
          .eq('alumno_id', usuario.id)
          .in(
            'grupo_id',
            grupos.map((grupo) => grupo.id)
          )

        if (error) throw error

        notasGrupo = data || []
      }

      const promedios = []

      const promedioNotas = (notas) => {
        if (!notas.length) return null

        return notas.reduce(
          (suma, nota) => suma + Number(nota.promedio),
          0
        ) / notas.length
      }

      for (const materia of materiasRes.data || []) {
        const notas = (notasRes.data || []).filter(
          (nota) => nota.materia_id === materia.id
        )

        const promedio = promedioNotas(notas)

        if (promedio !== null) {
          promedios.push(promedio)
        }
      }

      for (const grupo of grupos) {
        const notas = notasGrupo.filter(
          (nota) => nota.grupo_id === grupo.id
        )

        const promedio = promedioNotas(notas)

        if (promedio !== null) {
          promedios.push(promedio)
        }
      }

      setPromedioGeneral(
        promedios.length
          ? promedios.reduce(
              (suma, valor) => suma + valor,
              0
            ) / promedios.length
          : null
      )
    } catch (error) {
      setPromedioGeneral(null)
      setErrorPromedio(
        'No se pudo cargar el promedio: ' +
        error.message
      )
    } finally {
      setCargandoPromedio(false)
    }
  }, [usuario?.id])


  const cargarProximaClase = useCallback(async () => {
    if (!usuario?.id) {
      setProximaClase(null)
      return
    }

    setCargandoClase(true)
    setErrorClase('')

    try {
      const { data, error } = await supabase
        .from('materias')
        .select('id, nombre, aula, dias, hora_inicio')
        .eq('user_id', usuario.id)

      if (error) throw error

      const dias = [
        'domingo',
        'lunes',
        'martes',
        'miercoles',
        'jueves',
        'viernes',
        'sabado'
      ]

      const normalizar = (valor) =>
        String(valor || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()

      const ahora = new Date()
      const opciones = []

      for (const materia of data || []) {
        if (!materia.dias || !materia.hora_inicio) {
          continue
        }

        const partes = materia.hora_inicio
          .split(':')
          .map(Number)

        const [hora, minuto] = partes

        if (
          !Number.isInteger(hora) ||
          !Number.isInteger(minuto)
        ) {
          continue
        }

        const diasMateria = normalizar(materia.dias)

        for (
          let desplazamiento = 0;
          desplazamiento < 7;
          desplazamiento += 1
        ) {
          const fecha = new Date(ahora)

          fecha.setHours(0, 0, 0, 0)
          fecha.setDate(
            fecha.getDate() + desplazamiento
          )

          if (
            !diasMateria.includes(
              dias[fecha.getDay()]
            )
          ) {
            continue
          }

          fecha.setHours(hora, minuto, 0, 0)

          if (
            fecha.getTime() <= ahora.getTime()
          ) {
            continue
          }

          opciones.push({
            ...materia,
            fecha
          })
        }
      }

      opciones.sort(
        (a, b) =>
          a.fecha.getTime() - b.fecha.getTime()
      )

      setProximaClase(opciones[0] || null)
    } catch (error) {
      setProximaClase(null)
      setErrorClase(
        'No se pudo consultar tu horario: ' +
        error.message
      )
    } finally {
      setCargandoClase(false)
    }
  }, [usuario?.id])


  const cargarResumenPlanes = useCallback(async () => {
    if (!usuario?.id) {
      setResumenPlanes({
        activos: 0,
        materiasEnRiesgo: []
      })
      return
    }

    setCargandoPlanes(true)
    setErrorPlanes('')

    try {
      const [
        materiasRes,
        calificacionesRes,
        planesRes
      ] = await Promise.all([
        supabase
          .from('materias')
          .select('id, nombre')
          .eq('user_id', usuario.id),

        supabase
          .from('calificaciones')
          .select('materia_id, promedio')
          .eq('user_id', usuario.id),

        supabase
          .from('planes_estudio')
          .select('id, materia_id, estado')
          .eq('user_id', usuario.id)
      ])

      const fallo =
        materiasRes.error ||
        calificacionesRes.error ||
        planesRes.error

      if (fallo) throw fallo

      const personales = materiasRes.data || []
      const notas = calificacionesRes.data || []
      const planes = planesRes.data || []

      const enRiesgo = personales
        .flatMap((materia) => {
          const parciales = notas.filter(
            (nota) =>
              String(nota.materia_id) ===
              String(materia.id)
          )

          if (!parciales.length) return []

          const promedio =
            parciales.reduce(
              (suma, nota) =>
                suma + Number(nota.promedio),
              0
            ) / parciales.length

          return Number.isFinite(promedio) &&
            promedio < 7
            ? [{ ...materia, promedio }]
            : []
        })
        .sort(
          (a, b) => a.promedio - b.promedio
        )

      setResumenPlanes({
        activos: planes.filter(
          (plan) =>
            plan.estado === 'activo' &&
            personales.some(
              (materia) =>
                String(materia.id) ===
                String(plan.materia_id)
            )
        ).length,

        materiasEnRiesgo: enRiesgo
      })
    } catch (error) {
      setErrorPlanes(
        'No se pudo cargar el resumen de planes: ' +
        error.message
      )
    } finally {
      setCargandoPlanes(false)
    }
  }, [usuario?.id])


  const cargarAvisosSinLeer = useCallback(async () => {
    if (!usuario?.id) {
      setAvisosSinLeer(0)
      return
    }

    try {
      const {
        data: grupos,
        error: errorGrupos
      } = await supabase.rpc('obtener_mis_grupos')

      if (errorGrupos) throw errorGrupos

      const ids = (grupos || []).map(
        (grupo) => grupo.id
      )

      if (!ids.length) {
        setAvisosSinLeer(0)
        return
      }

      const {
        data: avisos,
        error: errorAvisos
      } = await supabase
        .from('avisos')
        .select('id')
        .in('grupo_id', ids)

      if (errorAvisos) throw errorAvisos

      const {
        data: leidos,
        error: errorLeidos
      } = await supabase
        .from('avisos_leidos')
        .select('aviso_id')
        .eq('alumno_id', usuario.id)

      if (errorLeidos) throw errorLeidos

      const idsLeidos = new Set(
        (leidos || []).map(
          (item) => String(item.aviso_id)
        )
      )

      setAvisosSinLeer(
        (avisos || []).filter(
          (aviso) =>
            !idsLeidos.has(String(aviso.id))
        ).length
      )
    } catch (error) {
      console.error(
        'No se pudo consultar el contador de avisos:',
        error
      )
    }
  }, [usuario?.id])

  useEffect(() => {
    cargarAvisosSinLeer()
  }, [cargarAvisosSinLeer, seccionEstudiante])


  const cargarMensajesSinLeer = useCallback(async () => {
    if (!usuario?.id) {
      setMensajesSinLeer(0)
      return
    }

    const { count, error } = await supabase
      .from('mensajes_chat')
      .select('id', {
        count: 'exact',
        head: true
      })
      .eq('alumno_id', usuario.id)
      .neq('remitente_id', usuario.id)
      .is('leido_at', null)

    if (error) {
      console.error(
        'No se pudo consultar el contador de mensajes:',
        error
      )
      return
    }

    setMensajesSinLeer(count ?? 0)
  }, [usuario?.id])

  useEffect(() => {
    cargarMensajesSinLeer()
  }, [cargarMensajesSinLeer, seccionEstudiante])

  useEffect(() => {
    if (!usuario?.id) return

    const canal = supabase
      .channel(
        `contador-mensajes-estudiante-${usuario.id}`
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensajes_chat',
          filter: `alumno_id=eq.${usuario.id}`
        },
        () => {
          cargarMensajesSinLeer()
        }
      )
      .subscribe()

    const intervalo = setInterval(
      cargarMensajesSinLeer,
      20000
    )

    return () => {
      clearInterval(intervalo)
      supabase.removeChannel(canal)
    }
  }, [usuario?.id, cargarMensajesSinLeer])


  function fechaTarea(fecha) {
    if (!fecha) return 'Sin fecha'

    const [anio, mes, dia] = fecha
      .split('-')
      .map(Number)

    return new Date(
      anio,
      mes - 1,
      dia
    ).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }


  useEffect(() => {
    if (seccionEstudiante === 'inicio') {
      cargarResumen()
      cargarTotalMaterias()
      cargarTareasPendientes()
      cargarPromedioGeneral()
      cargarProximaClase()
      cargarResumenPlanes()
    }
  }, [
    seccionEstudiante,
    cargarResumen,
    cargarTotalMaterias,
    cargarTareasPendientes,
    cargarPromedioGeneral,
    cargarProximaClase,
    cargarResumenPlanes
  ])


  const menu = [
    {
      id: 'inicio',
      icono: '🏠',
      nombre: 'Inicio'
    },
    {
      id: 'materias',
      icono: '📚',
      nombre: 'Materias'
    },
    {
      id: 'tareas',
      icono: '✅',
      nombre: 'Tareas'
    },
    {
      id: 'actividades',
      icono: '📝',
      nombre: 'Actividades'
    },
    {
      id: 'horario',
      icono: '📅',
      nombre: 'Horario'
    },
    {
      id: 'calificaciones',
      icono: '📊',
      nombre: 'Calificaciones'
    },
    {
      id: 'plan-estudio',
      icono: '🧠',
      nombre: 'Plan de estudio'
    },
    {
      id: 'grupos',
      icono: '👥',
      nombre: 'Grupos'
    },
    {
      id: 'avisos',
      icono: '🔔',
      nombre: 'Avisos'
    },
    {
      id: 'mensajes',
      icono: '💬',
      nombre: 'Mensajes'
    },
    {
      id: 'perfil',
      icono: '👤',
      nombre: 'Perfil'
    }
  ]


  return (
    <div className="student-dashboard">

      

      <header className="study-mobile-header">
        <button
          type="button"
          className="study-mobile-menu-button"
          onClick={() => setMenuMovilAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={menuMovilAbierto}
          aria-controls="study-student-sidebar"
        >
          ☰
        </button>

        <img src={logoStudy} alt="" />

        <strong>Study</strong>
      </header>

      

      {menuMovilAbierto && (
        <button
          type="button"
          className="study-mobile-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenuMovilAbierto(false)}
        />
      )}

      

      <aside
        id="study-student-sidebar"
        className={`student-sidebar ${
          menuMovilAbierto ? 'sidebar-open' : ''
        }`}
      >

        <div className="sidebar-logo">
          <img src={logoStudy} alt="Study" />
          <span>Study</span>
        </div>

        <button
          type="button"
          className="study-mobile-close"
          onClick={() => setMenuMovilAbierto(false)}
          aria-label="Cerrar menú"
        >
          ✕
        </button>

        <nav className="sidebar-menu">
          {menu.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              className={`menu-item ${
                seccionEstudiante === opcion.id
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                cambiarSeccion(opcion.id)
              }
            >
              <span>{opcion.icono}</span>

              {opcion.nombre}

              {opcion.id === 'avisos' &&
                avisosSinLeer > 0 && (
                  <span
                    aria-label={`${avisosSinLeer} avisos sin leer`}
                    style={{
                      marginLeft: 'auto',
                      background: '#dc2626',
                      color: '#fff',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      minWidth: '24px',
                      textAlign: 'center'
                    }}
                  >
                    {avisosSinLeer > 99
                      ? '99+'
                      : avisosSinLeer}
                  </span>
                )}

              {opcion.id === 'mensajes' &&
                mensajesSinLeer > 0 && (
                  <span
                    aria-label={`${mensajesSinLeer} mensajes sin leer`}
                    style={{
                      marginLeft: 'auto',
                      background: '#dc2626',
                      color: '#fff',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      minWidth: '24px',
                      textAlign: 'center'
                    }}
                  >
                    {mensajesSinLeer > 99
                      ? '99+'
                      : mensajesSinLeer}
                  </span>
                )}
            </button>
          ))}
        </nav>

        

        <button
          type="button"
          className="study-theme-toggle"
          onClick={() =>
            setModoOscuro((actual) => !actual)
          }
          aria-label={
            modoOscuro
              ? 'Activar modo claro'
              : 'Activar modo oscuro'
          }
          aria-pressed={modoOscuro}
        >
          <span aria-hidden="true">
            {modoOscuro ? '☀️' : '🌙'}
          </span>

          {modoOscuro
            ? 'Modo claro'
            : 'Modo oscuro'}
        </button>

        

        <button
          type="button"
          className="sidebar-logout"
          onClick={cerrarSesion}
        >
          ↪ Cerrar sesión
        </button>

      </aside>

      

      <main className="student-content">

        {seccionEstudiante === 'materias' ? (

          <Materias usuario={usuarioActual} />

        ) : seccionEstudiante === 'tareas' ? (

          <Tareas usuario={usuarioActual} />

        ) : seccionEstudiante === 'horario' ? (

          <Horario usuario={usuarioActual} />

        ) : seccionEstudiante === 'calificaciones' ? (

          <Calificaciones usuario={usuarioActual} />

        ) : seccionEstudiante === 'plan-estudio' ? (

          <PlanEstudio usuario={usuarioActual} />

        ) : seccionEstudiante === 'grupos' ? (

          <GruposEstudiante usuario={usuarioActual} />

        ) : seccionEstudiante === 'actividades' ? (

          <ActividadesEstudiante usuario={usuarioActual} />

        ) : seccionEstudiante === 'avisos' ? (

          <AvisosEstudiante
            usuario={usuarioActual}
            onAvisosActualizados={cargarAvisosSinLeer}
          />

        ) : seccionEstudiante === 'mensajes' ? (

          <ChatStudy
            usuario={usuarioActual}
            rol="estudiante"
          />

        ) : seccionEstudiante === 'perfil' ? (

          <PerfilEstudiante
            usuario={usuarioActual}
            onUsuarioActualizado={setUsuarioActual}
          />

        ) : seccionEstudiante !== 'inicio' ? (

          <section className="dashboard-panel">
            <h2>
              {menu.find(
                (opcion) =>
                  opcion.id === seccionEstudiante
              )?.nombre}
            </h2>

            <p>
              Esta sección estará disponible próximamente.
            </p>
          </section>

        ) : (

          <>
            

            <header className="dashboard-header">

              <div>
                <p className="dashboard-small-title">
                  PANEL DEL ESTUDIANTE
                </p>

                <h1>
                  Hola,{' '}
                  {usuarioActual?.user_metadata?.nombre ||
                    'Estudiante'}{' '}
                  👋
                </h1>

                <p>
                  Organiza tu universidad desde un solo lugar.
                </p>
              </div>

              <div className="student-avatar">
                🎓
              </div>

            </header>

            

            <section className="summary-grid">

              <div className="summary-card">
                <div className="summary-icon">
                  📊
                </div>

                <div>
                  <p>Promedio general</p>

                  <h2>
                    {cargandoPromedio ||
                    errorPromedio ||
                    promedioGeneral === null
                      ? '--'
                      : promedioGeneral.toFixed(1)}
                  </h2>

                  <span>
                    {errorPromedio ||
                      (cargandoPromedio
                        ? 'Cargando promedio...'
                        : promedioGeneral === null
                          ? 'Agrega tus calificaciones'
                          : 'Promedio de tus materias calificadas')}
                  </span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon">
                  ✅
                </div>

                <div>
                  <p>Tareas pendientes</p>

                  <h2>
                    {cargandoTareas || errorTareas
                      ? '--'
                      : tareasPendientes.length}
                  </h2>

                  <span>
                    {errorTareas
                      ? 'Error al consultar'
                      : cargandoTareas
                        ? 'Cargando tareas...'
                        : tareasPendientes.length === 0
                          ? 'Todo bajo control'
                          : 'Tareas por completar'}
                  </span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon">
                  📚
                </div>

                <div>
                  <p>Materias</p>

                  <h2>
                    {totalMaterias === null
                      ? '--'
                      : totalMaterias}
                  </h2>

                  <span>
                    {errorMaterias ||
                      (totalMaterias === null
                        ? 'Cargando materias...'
                        : totalMaterias === 0
                          ? 'Agrega tu primera materia'
                          : 'Personales y de tus grupos')}
                  </span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon">
                  🕐
                </div>

                <div>
                  <p>Próxima clase</p>

                  <h2
                    style={{
                      fontSize: proximaClase
                        ? '1.15rem'
                        : undefined,
                      overflowWrap: 'anywhere'
                    }}
                  >
                    {cargandoClase
                      ? '...'
                      : proximaClase?.nombre || '--'}
                  </h2>

                  <span>
                    {errorClase ||
                      (cargandoClase
                        ? 'Buscando tu próxima clase...'
                        : proximaClase
                          ? `${proximaClase.fecha.toLocaleDateString(
                              'es-MX',
                              {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'short'
                              }
                            )} · ${proximaClase.fecha.toLocaleTimeString(
                              'es-MX',
                              {
                                hour: '2-digit',
                                minute: '2-digit'
                              }
                            )}${
                              proximaClase.aula
                                ? ` · Aula ${proximaClase.aula}`
                                : ''
                            }`
                          : 'Configura días y horas en Materias')}
                  </span>
                </div>
              </div>

            </section>

            

            <section
              className="dashboard-panel"
              style={{ marginTop: '24px' }}
            >
              <div className="panel-header">

                <div>
                  <h2>📝 Mis actividades</h2>

                  <p>
                    Consulta el avance de tus actividades de clase.
                  </p>
                </div>

                <button
                  type="button"
                  className="small-button"
                  onClick={() =>
                    cambiarSeccion('actividades')
                  }
                >
                  Ver actividades
                </button>

              </div>

              {errorResumen && (
                <p
                  role="alert"
                  style={{ color: '#b42318' }}
                >
                  {errorResumen}
                </p>
              )}

              {cargandoResumen ? (

                <p>Cargando resumen...</p>

              ) : (

                <div
                  className="summary-grid"
                  style={{ marginTop: '18px' }}
                >
                  {[
                    {
                      icono: '📋',
                      nombre: 'Todas',
                      cantidad: resumen.total
                    },
                    {
                      icono: '⏳',
                      nombre: 'Pendientes',
                      cantidad: resumen.pendientes
                    },
                    {
                      icono: '📤',
                      nombre: 'Entregadas',
                      cantidad: resumen.entregadas
                    },
                    {
                      icono: '🏅',
                      nombre: 'Calificadas',
                      cantidad: resumen.calificadas
                    },
                    {
                      icono: '🔄',
                      nombre: 'Por corregir',
                      cantidad: resumen.porCorregir
                    }
                  ].map((item) => (

                    <div
                      className="summary-card"
                      key={item.nombre}
                    >
                      <div className="summary-icon">
                        {item.icono}
                      </div>

                      <div>
                        <p>{item.nombre}</p>
                        <h2>{item.cantidad}</h2>
                      </div>
                    </div>

                  ))}
                </div>

              )}
            </section>

            

            <section className="dashboard-sections">

              <div className="dashboard-panel">

                <div className="panel-header">

                  <div>
                    <h2>📋 Tareas pendientes</h2>
                    <p>Tus próximas actividades</p>
                  </div>

                  <button
                    type="button"
                    className="small-button"
                    onClick={() =>
                      cambiarSeccion('tareas')
                    }
                  >
                    Ver todas
                  </button>

                </div>

                {errorTareas && (
                  <p
                    role="alert"
                    style={{ color: '#b42318' }}
                  >
                    {errorTareas}
                  </p>
                )}

                {cargandoTareas ? (

                  <p>Cargando tareas...</p>

                ) : tareasPendientes.length === 0 ? (

                  <div className="empty-state">
                    <div className="empty-icon">
                      ✅
                    </div>

                    <h3>
                      No tienes tareas pendientes
                    </h3>

                    <p>
                      Cuando agregues tareas aparecerán aquí.
                    </p>
                  </div>

                ) : (

                  <div
                    style={{
                      display: 'grid',
                      gap: '12px',
                      marginTop: '16px'
                    }}
                  >
                    {tareasPendientes
                      .slice(0, 4)
                      .map((tarea) => (

                        <div
                          key={tarea.id}
                          style={{
                            padding: '14px',
                            border: '1px solid #dce7e8',
                            borderRadius: '12px',
                            background: '#fff'
                          }}
                        >
                          <strong
                            style={{
                              display: 'block',
                              marginBottom: '6px'
                            }}
                          >
                            {tarea.titulo}
                          </strong>

                          <span
                            style={{
                              fontSize: '0.9rem',
                              color: '#64748b'
                            }}
                          >
                            📅{' '}
                            {fechaTarea(
                              tarea.fecha_entrega
                            )}{' '}
                            ·{' '}
                            {tarea.prioridad === 'alta'
                              ? '🔴 Alta'
                              : tarea.prioridad === 'baja'
                                ? '🟢 Baja'
                                : '🟡 Media'}
                          </span>
                        </div>

                      ))}

                    {tareasPendientes.length > 4 && (
                      <p
                        style={{
                          color: '#64748b',
                          margin: 0
                        }}
                      >
                        Y{' '}
                        {tareasPendientes.length - 4}{' '}
                        tarea(s) más...
                      </p>
                    )}
                  </div>

                )}

              </div>

              

              <div className="dashboard-panel study-plan-panel">

                <div className="panel-header">
                  <div>
                    <h2>🧠 Plan de estudio</h2>

                    <p>
                      Mejora tu rendimiento académico
                    </p>
                  </div>
                </div>

                <div className="study-message">
                  <div className="study-message-icon">
                    🎯
                  </div>

                  {cargandoPlanes ? (

                    <p>
                      Consultando tus planes de estudio...
                    </p>

                  ) : errorPlanes ? (

                    <p
                      role="alert"
                      style={{ color: '#b42318' }}
                    >
                      {errorPlanes}
                    </p>

                  ) : (

                    <>
                      <h3>
                        {resumenPlanes.activos === 1
                          ? '1 plan activo'
                          : `${resumenPlanes.activos} planes activos`}
                      </h3>

                      <p>
                        {resumenPlanes.materiasEnRiesgo.length === 0
                          ? 'No tienes materias personales con promedio inferior a 7.0.'
                          : `${resumenPlanes.materiasEnRiesgo.length} materia(s) personales con promedio inferior a 7.0:`}
                      </p>

                      {resumenPlanes.materiasEnRiesgo.length > 0 && (

                        <div
                          style={{
                            display: 'grid',
                            gap: '8px',
                            marginBottom: '16px',
                            textAlign: 'left'
                          }}
                        >
                          {resumenPlanes.materiasEnRiesgo
                            .slice(0, 3)
                            .map((materia) => (

                              <div
                                key={materia.id}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: '10px',
                                  background: '#f5f9f9'
                                }}
                              >
                                <strong>
                                  {materia.nombre}
                                </strong>

                                {' '}· Promedio{' '}
                                {materia.promedio.toFixed(1)}
                              </div>

                            ))}

                          {resumenPlanes.materiasEnRiesgo.length > 3 && (

                            <p>
                              Y{' '}
                              {resumenPlanes.materiasEnRiesgo.length - 3}{' '}
                              materia(s) más.
                            </p>

                          )}
                        </div>

                      )}
                    </>

                  )}

                  <button
                    type="button"
                    className="small-button"
                    onClick={() =>
                      cambiarSeccion('plan-estudio')
                    }
                  >
                    Ver planes de estudio
                  </button>

                </div>
              </div>

            </section>

            

            <section className="groups-card">

              <div className="groups-info">

                <div className="groups-icon">
                  👥
                </div>

                <div>
                  <h2>Únete a tu clase</h2>

                  <p>
                    ¿Tu profesor te dio un código?
                    Úsalo para ingresar a su grupo en Study.
                  </p>
                </div>

              </div>

              <button
                type="button"
                className="join-group-button"
                onClick={() =>
                  cambiarSeccion('grupos')
                }
              >
                + Unirme a un grupo
              </button>

            </section>

          </>

        )}

      </main>

    </div>
  )
}

export default DashboardEstudiante