import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { alertaExito, alertaError } from '../../utils/alertas'
import './PerfilProfesor.css'

function PerfilProfesor({ usuario, onUsuarioActualizado }) {
  const [nombre, setNombre] = useState('')
  const [carrera, setCarrera] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [cambiandoPassword, setCambiandoPassword] = useState(false)

  useEffect(() => {
    setNombre(usuario?.user_metadata?.nombre || '')
    setCarrera(usuario?.user_metadata?.carrera || '')
  }, [usuario?.id, usuario?.user_metadata?.nombre, usuario?.user_metadata?.carrera])

  async function guardarPerfil(e) {
    e.preventDefault()
    if (guardando) return
    if (!nombre.trim() || !carrera.trim()) {
      await alertaError('Campos obligatorios', 'Escribe tu nombre y el área o carrera que impartes.')
      return
    }
    setGuardando(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { nombre: nombre.trim(), carrera: carrera.trim() }
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
    <section className="pp-pagina">
      <header className="profesor-page-heading">
        <p className="profesor-eyebrow">PANEL DOCENTE</p>
        <h1>👤 Mi perfil</h1>
        <p>Consulta y actualiza tu información en Study.</p>
      </header>
      <div className="pp-contenedor">
        <section className="pp-tarjeta">
          <h2>👨‍🏫 Información personal</h2>
          <p className="pp-descripcion">Estos datos se guardan en tu cuenta de Supabase.</p>
          <form onSubmit={guardarPerfil} className="pp-formulario">
            <label htmlFor="pp-nombre">Nombre completo</label>
            <input id="pp-nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)} required maxLength={120} />
            <label htmlFor="pp-correo">Correo electrónico</label>
            <input id="pp-correo" type="email" value={usuario?.email || ''} disabled readOnly />
            <small>Por seguridad, el correo no se cambia desde este formulario.</small>
            <label htmlFor="pp-carrera">Área o carrera que imparte</label>
            <input id="pp-carrera" type="text" value={carrera} onChange={e => setCarrera(e.target.value)} required maxLength={150} />
            <button type="submit" className="pp-boton" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </section>
        <section className="pp-tarjeta">
          <h2>🔒 Seguridad de la cuenta</h2>
          <p className="pp-descripcion">Cambia tu contraseña sin modificar tus grupos ni actividades.</p>
          <form onSubmit={cambiarPassword} className="pp-formulario">
            <label htmlFor="pp-password">Nueva contraseña</label>
            <input id="pp-password" type="password" autoComplete="new-password" minLength="6" value={nuevaPassword} onChange={e => setNuevaPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
            <label htmlFor="pp-confirmar">Confirmar nueva contraseña</label>
            <input id="pp-confirmar" type="password" autoComplete="new-password" minLength="6" value={confirmarPassword} onChange={e => setConfirmarPassword(e.target.value)} required />
            <button type="submit" className="pp-boton pp-boton-secundario" disabled={cambiandoPassword}>
              {cambiandoPassword ? 'Actualizando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>
      </div>
    </section>
  )
}

export default PerfilProfesor