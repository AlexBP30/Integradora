import { useEffect, useState } from 'react'
import './App.css'
import logoStudy from './assets/logo.png'
import { supabase } from './lib/supabase'
import DashboardEstudiante from './pages/estudiante/DashboardEstudiante'
import DashboardProfesor from './pages/profesor/DashboardProfesor'
import { alertaExito, alertaError } from './utils/alertas'
import './Registro.css'

function App() {
  const [pantalla, setPantalla] = useState('inicio')

  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [carrera, setCarrera] = useState('')
  const [semestre, setSemestre] = useState('')
  const [rol, setRol] = useState('estudiante')

  const [usuario, setUsuario] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [verificandoSesion, setVerificandoSesion] = useState(true)


  useEffect(() => {
    let activo = true

    const recuperarSesion = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) throw error

        const usuarioGuardado = data.session?.user

        if (!usuarioGuardado) return

        if (!navigator.onLine) return

        const { data: perfil, error: errorPerfil } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('user_id', usuarioGuardado.id)
          .single()

        if (errorPerfil) throw errorPerfil

        if (!['estudiante', 'profesor'].includes(perfil?.rol)) {
          return
        }

        if (activo) {
          setUsuario(usuarioGuardado)
          setRol(perfil.rol)

          setPantalla(
            perfil.rol === 'profesor'
              ? 'dashboard-profesor'
              : 'dashboard-estudiante'
          )
        }
      } catch (error) {
        console.error('No se pudo recuperar la sesión:', error)
      } finally {
        if (activo) {
          setVerificandoSesion(false)
        }
      }
    }

    recuperarSesion()

    return () => {
      activo = false
    }
  }, [])


  const registrarUsuario = async (e) => {
    e.preventDefault()

    if (procesando) return

    setProcesando(true)

    try {
      const { error } = await supabase.auth.signUp({
        email: correo,
        password,
        options: {
          data: {
            nombre,
            carrera,
            semestre: rol === 'estudiante' ? semestre : null,
            rol
          }
        }
      })

      if (error) {
        await alertaError(
          'No pudimos crear tu cuenta',
          error.message
        )
        return
      }

      await alertaExito(
        '¡Cuenta creada!',
        'Tu cuenta de Study se creó correctamente.'
      )

      setNombre('')
      setCorreo('')
      setPassword('')
      setCarrera('')
      setSemestre('')
      setRol('estudiante')
      setPantalla('login')

    } catch (error) {
      await alertaError(
        'Error al crear tu cuenta',
        error.message
      )
    } finally {
      setProcesando(false)
    }
  }


  const iniciarSesion = async (e) => {
    e.preventDefault()

    if (procesando) return

    setProcesando(true)

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: correo,
          password
        })

      if (error) {
        await alertaError(
          'No pudimos iniciar sesión',
          error.message
        )
        return
      }

      const usuarioActual = data.user

      const { data: perfil, error: errorPerfil } =
        await supabase
          .from('perfiles')
          .select('rol')
          .eq('user_id', usuarioActual.id)
          .single()

      if (
        errorPerfil ||
        !['estudiante', 'profesor'].includes(perfil?.rol)
      ) {
        await supabase.auth.signOut()

        throw new Error(
          'No pudimos verificar tu tipo de cuenta. Intenta nuevamente.'
        )
      }

      const rolUsuario = perfil.rol

      setUsuario(usuarioActual)
      setRol(rolUsuario)
      setPassword('')

      await alertaExito(
        '¡Bienvenido a Study!',
        'Tu sesión se inició correctamente.'
      )

      setPantalla(
        rolUsuario === 'profesor'
          ? 'dashboard-profesor'
          : 'dashboard-estudiante'
      )

    } catch (error) {
      await alertaError(
        'Error al iniciar sesión',
        error.message
      )
    } finally {
      setProcesando(false)
    }
  }


  const cerrarSesion = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      await alertaError(
        'No pudimos cerrar sesión',
        error.message
      )
      return
    }

    setUsuario(null)
    setCorreo('')
    setPassword('')
    setRol('estudiante')
    setPantalla('inicio')
  }


  if (verificandoSesion) {
    return (
      <main className="welcome">
        <section className="welcome-card">
          <div className="logo">
            <img src={logoStudy} alt="Study" />
          </div>

          <h1>Study</h1>

          <p className="subtitle">
            Recuperando tu sesión...
          </p>
        </section>
      </main>
    )
  }


  if (pantalla === 'dashboard-estudiante') {
    return (
      <DashboardEstudiante
        usuario={usuario}
        cerrarSesion={cerrarSesion}
      />
    )
  }


  if (pantalla === 'dashboard-profesor') {
    return (
      <DashboardProfesor
        usuario={usuario}
        cerrarSesion={cerrarSesion}
      />
    )
  }


  if (pantalla === 'login') {
    return (
      <main className="welcome">
        <section className="welcome-card">

          <div className="logo">
            <img src={logoStudy} alt="Study" />
          </div>

          <h1>Bienvenido</h1>

          <p className="subtitle">
            Inicia sesión para continuar en Study.
          </p>

          <form
            className="form"
            onSubmit={iniciarSesion}
          >
            <div className="form-group">
              <label>Correo electrónico</label>

              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={correo}
                onChange={(e) =>
                  setCorreo(e.target.value)
                }
                required
              />
            </div>

            <div className="form-group">
              <label>Contraseña</label>

              <input
                type="password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={procesando}
            >
              {procesando
                ? 'Ingresando...'
                : 'Iniciar sesión'}
            </button>
          </form>

          <button
            type="button"
            className="back-button"
            onClick={() => {
              setCorreo('')
              setPassword('')
              setPantalla('inicio')
            }}
          >
            ← Volver
          </button>

        </section>
      </main>
    )
  }


  if (pantalla === 'registro') {
    return (
      <main className="welcome registro-screen">
        <section className="welcome-card">

          <div className="logo">
            <img src={logoStudy} alt="Study" />
          </div>

          <h1>Crear cuenta</h1>

          <p className="subtitle">
            Comienza a organizar tu vida universitaria.
          </p>

          <form
            className="form"
            onSubmit={registrarUsuario}
          >

            <div className="form-group">
              <label>Tipo de cuenta</label>

              <div className="role-selector">

                <button
                  type="button"
                  className={`role-button ${
                    rol === 'estudiante' ? 'active' : ''
                  }`}
                  onClick={() =>
                    setRol('estudiante')
                  }
                >
                  🎓 Estudiante
                </button>

                <button
                  type="button"
                  className={`role-button ${
                    rol === 'profesor' ? 'active' : ''
                  }`}
                  onClick={() => {
                    setRol('profesor')
                    setSemestre('')
                  }}
                >
                  🧑‍🏫 Profesor
                </button>

              </div>
            </div>

            <div className="form-group">
              <label>Nombre</label>

              <input
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) =>
                  setNombre(e.target.value)
                }
                required
              />
            </div>

            <div className="form-group">
              <label>Correo electrónico</label>

              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={correo}
                onChange={(e) =>
                  setCorreo(e.target.value)
                }
                required
              />
            </div>

            <div className="form-group">
              <label>Contraseña</label>

              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                minLength="6"
                required
              />
            </div>

            <div className="form-group">
              <label>
                {rol === 'estudiante'
                  ? 'Carrera'
                  : 'Área o carrera que imparte'}
              </label>

              <input
                type="text"
                placeholder={
                  rol === 'estudiante'
                    ? 'Ej. Ingeniería en Sistemas'
                    : 'Ej. Ingeniería / Matemáticas'
                }
                value={carrera}
                onChange={(e) =>
                  setCarrera(e.target.value)
                }
                required
              />
            </div>

            {rol === 'estudiante' && (
              <div className="form-group">
                <label>Semestre</label>

                <input
                  type="number"
                  min="1"
                  max="12"
                  placeholder="Ej. 5"
                  value={semestre}
                  onChange={(e) =>
                    setSemestre(e.target.value)
                  }
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={procesando}
            >
              {procesando
                ? 'Creando cuenta...'
                : 'Crear cuenta'}
            </button>

          </form>

          <button
            type="button"
            className="back-button"
            onClick={() =>
              setPantalla('inicio')
            }
          >
            ← Volver
          </button>

        </section>
      </main>
    )
  }


  return (
    <main className="welcome">
      <section className="welcome-card">

        <div className="logo">
          <img src={logoStudy} alt="Study" />
        </div>

        <h1>Study</h1>

        <p className="subtitle">
          Tu universidad en un solo lugar.
        </p>

        <div className="buttons">

          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              setPantalla('login')
            }
          >
            Iniciar sesión
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              setPantalla('registro')
            }
          >
            Crear cuenta
          </button>

        </div>

        <p className="description">
          Organiza tus materias, tareas, horarios y
          calificaciones desde cualquier dispositivo.
        </p>

      </section>
    </main>
  )
}

export default App