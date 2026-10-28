import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './EntregaActividad.css'

const BUCKET = 'entregas-estudiantes'
const MAX_BYTES = 10 * 1024 * 1024
const TIPOS = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp'
])
const EXTENSIONES = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'])

function EntregaActividad({ actividad, usuario, onEntregaGuardada }) {
  const [entrega, setEntrega] = useState(null)
  const [texto, setTexto] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let vigente = true
    async function consultar() {
      setCargando(true)
      setError('')
      setEntrega(null)
      setTexto('')
      setArchivo(null)
      if (!usuario?.id || !actividad?.id) {
        setCargando(false)
        return
      }
      const { data, error: fallo } = await supabase
        .from('entregas_actividades')
        .select('id, estado, texto_entrega, archivo_ruta, calificacion, comentario_profesor, updated_at')
        .eq('actividad_id', actividad.id)
        .eq('alumno_id', usuario.id)
        .maybeSingle()
      if (!vigente) return
      if (fallo) setError('No se pudo consultar la entrega: ' + fallo.message)
      else {
        setEntrega(data)
        setTexto(data?.estado === 'correccion_solicitada' ? data.texto_entrega || '' : '')
      }
      setCargando(false)
    }
    consultar()
    return () => { vigente = false }
  }, [actividad?.id, usuario?.id])

  const puedeEnviar = !entrega || entrega.estado === 'correccion_solicitada'

  async function verArchivo() {
    if (!entrega?.archivo_ruta) return
    setError('')
    const { data, error: fallo } = await supabase.storage.from(BUCKET)
      .createSignedUrl(entrega.archivo_ruta, 60)
    if (fallo || !data?.signedUrl) {
      setError('No se pudo abrir el archivo: ' + (fallo?.message || 'Enlace no disponible'))
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function enviar(e) {
    e.preventDefault()
    if (enviando || !puedeEnviar) return
    setError('')
    setMensaje('')
    if (!texto.trim() && !archivo) {
      setError('Escribe una respuesta o adjunta un archivo.')
      return
    }
    if (archivo) {
      const extension = archivo.name.split('.').pop()?.toLowerCase()
      if (archivo.size > MAX_BYTES || !EXTENSIONES.has(extension) || !TIPOS.has(archivo.type)) {
        setError('Selecciona un PDF, Word o imagen válida de máximo 10 MB.')
        return
      }
    }

    setEnviando(true)
    let ruta = null
    try {
      if (archivo) {
        const extension = archivo.name.split('.').pop().toLowerCase()
        const nombre = `${crypto.randomUUID()}.${extension}`
        ruta = `actividades/${actividad.id}/${usuario.id}/${nombre}`
        const { error: falloSubida } = await supabase.storage
          .from(BUCKET).upload(ruta, archivo, { upsert: false, contentType: archivo.type })
        if (falloSubida) throw new Error('No se pudo subir el archivo: ' + falloSubida.message)
      }

      const { error: falloEntrega } = await supabase.rpc('enviar_actividad', {
        p_actividad_id: actividad.id,
        p_texto_entrega: texto.trim() || null,
        p_archivo_ruta: ruta
      })
      if (falloEntrega) throw new Error('No se pudo registrar la entrega: ' + falloEntrega.message)

      const { data: guardada, error: falloConsulta } = await supabase
        .from('entregas_actividades')
        .select('id, estado, texto_entrega, archivo_ruta, calificacion, comentario_profesor, updated_at')
        .eq('actividad_id', actividad.id)
        .eq('alumno_id', usuario.id)
        .single()
      if (falloConsulta) throw new Error('Se envió, pero no se pudo actualizar la vista: ' + falloConsulta.message)
      setEntrega(guardada)
      setArchivo(null)
      setMensaje('Tu actividad se entregó correctamente.')
      onEntregaGuardada?.(guardada)
    } catch (fallo) {
      setError(fallo.message || 'Ocurrió un error al enviar la actividad.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return <p className="ea-aviso">Consultando tu entrega...</p>

  return (
    <section className="ea-contenedor">
      <h3>📤 Mi entrega</h3>
      {entrega && (
        <div className="ea-resumen">
          <p><strong>Estado:</strong> {({
            entregada: 'Entregada', en_revision: 'En revisión',
            calificada: 'Calificada', correccion_solicitada: 'Corrección solicitada'
          })[entrega.estado] || entrega.estado}</p>
          {entrega.texto_entrega && <p className="ea-texto"><strong>Respuesta:</strong> {entrega.texto_entrega}</p>}
          {entrega.archivo_ruta && <button className="ea-enlace" type="button" onClick={verArchivo}>📎 Ver mi archivo</button>}
          {entrega.calificacion != null && <p><strong>Calificación:</strong> {entrega.calificacion} / {actividad.puntos_maximos}</p>}
          {entrega.comentario_profesor && <p><strong>Comentario del profesor:</strong> {entrega.comentario_profesor}</p>}
        </div>
      )}

      {mensaje && <p className="ea-exito" role="status">{mensaje}</p>}
      {error && <p className="ea-error" role="alert">{error}</p>}

      {puedeEnviar ? (
        <form onSubmit={enviar} className="ea-formulario">
          {entrega?.estado === 'correccion_solicitada' && <p className="ea-aviso">Tu profesor solicitó una corrección. Puedes enviar una nueva versión.</p>}
          <label htmlFor={`ea-texto-${actividad.id}`}>Respuesta escrita (opcional)</label>
          <textarea id={`ea-texto-${actividad.id}`} value={texto} onChange={e => setTexto(e.target.value)} rows={4} placeholder="Escribe aquí tu respuesta..." disabled={enviando} />
          <label htmlFor={`ea-archivo-${actividad.id}`}>Adjuntar archivo (opcional)</label>
          <input id={`ea-archivo-${actividad.id}`} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={e => setArchivo(e.target.files?.[0] || null)} disabled={enviando} />
          <small>PDF, Word o imagen. Máximo 10 MB. Debes proporcionar texto, archivo o ambos.</small>
          <button type="submit" className="ea-boton" disabled={enviando}>{enviando ? 'Enviando...' : entrega ? 'Enviar corrección' : 'Entregar actividad'}</button>
        </form>
      ) : <p className="ea-aviso">Tu entrega ya está registrada. Solo podrás reenviarla si el profesor solicita una corrección.</p>}
    </section>
  )
}

export default EntregaActividad