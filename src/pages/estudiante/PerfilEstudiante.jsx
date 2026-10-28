import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { alertaExito, alertaError } from '../../utils/alertas'
import './PerfilEstudiante.css'

function PerfilEstudiante({ usuario, onUsuarioActualizado }) {
  const [nombre, setNombre] = useState('')
  const [carrera, setCarrera] = useState('')
  const [semestre, setSemestre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [cambiandoPassword, setCambiandoPassword] = useState(false)

  useEffect(() => {
    setNombre(usuario?.user_metadata?.nombre || '')
    setCarrera(usuario?.user_metadata?.carrera || '')
    setSemestre(String(usuario?.user_metadata?.semestre ?? ''))
  }, [usuario?.id, usuario?.user_metadata?.nombre, usuario?.user_metadata?.carrera, usuario?.user_metadata?.semestre])

  async function guardarPerfil(e) {
    e.preventDefault()
    if (guardando) return
    if (!nombre.trim() || !carrera.trim()) {
      await alertaError('Campos obligatorios', 'Escribe tu nombre y carrera.')
      return
    }
    const numeroSemestre = Number(semestre)
    if (!Number.isInteger(numeroSemestre) || numeroSemestre < 1 || numeroSemestre > 12) {
      await alertaError('Semestre inválido', 'El semestre debe estar entre 1 y 12.')
      return
    }
    setGuardando(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          nombre: nombre.trim(),
          carrera: carrera.trim(),
          semestre: String(numeroSemestre)
        }
      })
      if (error) throw error
      onUsuarioActualizado?.(data.user)
      await alertaExito('Perfil actualizado', 'Tus datos se guardaron correctamente.')
    } catch (error) {
      await alertaError('No pudimos guardar tu perfil', error.message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarPassword(e) {
    e.preventDefault()
    if (cambiandoPassword) return
    if (nuevaPassword.length < 6) {
      await alertaError('Contraseña corta', 'Escribe al menos 6 caracteres.')
      return
    }
    if (nuevaPassword !== confirmarPassword) {
      await alertaError('Las contraseñas no coinciden', 'Revisa la confirmación.')
      return
    }
    setCambiandoPassword(true)
    try {
      const { data, error } = await supabase.auth.updateUser({ password: nuevaPassword })
      if (error) throw error
      if (data?.user) onUsuarioActualizado?.(data.user)
      setNuevaPassword('')
      setConfirmarPassword('')
      await alertaExito('Contraseña actualizada', 'Tu nueva contraseña se guardó correctamente.')
    } catch (error) {
      await alertaError('No pudimos cambiar tu contraseña', error.message)
    } finally {
      setCambiandoPassword(false)
    }
  }

  return (
    <section className="pe-pagina">
      <header className="pe-encabezado">
        <p className="dashboard-small-title">PANEL DEL ESTUDIANTE</p>
        <h1>👤 Mi perfil</h1>
        <p>Consulta y actualiza tu información en Study.</p>
      </header>

      <div className="pe-contenedor">
        <section className="pe-tarjeta">
          <h2>🎓 Información personal</h2>
          <p className="pe-descripcion">Estos datos se guardan en tu cuenta de Supabase.</p>
          <form onSubmit={guardarPerfil} className="pe-formulario">
            <label htmlFor="pe-nombre">Nombre completo</label>
            <input id="pe-nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)} required maxLength={120} />

            <label htmlFor="pe-correo">Correo electrónico</label>
            <input id="pe-correo" type="email" value={usuario?.email || ''} disabled readOnly />
            <small>Por seguridad, el correo no se cambia desde este formulario.</small>

            <label htmlFor="pe-carrera">Carrera</label>
            <input id="pe-carrera" type="text" value={carrera} onChange={e => setCarrera(e.target.value)} required maxLength={150} />

            <label htmlFor="pe-semestre">Semestre</label>
            <input id="pe-semestre" type="number" min="1" max="12" value={semestre} onChange={e => setSemestre(e.target.value)} required />

            <button type="submit" className="pe-boton" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </section>

        <section className="pe-tarjeta">
          <h2>🔒 Seguridad de la cuenta</h2>
          <p className="pe-descripcion">Cambia tu contraseña sin modificar tu información académica.</p>
          <form onSubmit={cambiarPassword} className="pe-formulario">
            <label htmlFor="pe-password">Nueva contraseña</label>
            <input id="pe-password" type="password" autoComplete="new-password" minLength="6" value={nuevaPassword} onChange={e => setNuevaPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />

            <label htmlFor="pe-confirmar">Confirmar nueva contraseña</label>
            <input id="pe-confirmar" type="password" autoComplete="new-password" minLength="6" value={confirmarPassword} onChange={e => setConfirmarPassword(e.target.value)} required />

            <button type="submit" className="pe-boton pe-boton-secundario" disabled={cambiandoPassword}>
              {cambiandoPassword ? 'Actualizando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>
      </div>
    </section>
  )
}

export default PerfilEstudiante