import Swal from 'sweetalert2'

const colorPrincipal = '#078b87'
const colorCancelar = '#8b95a5'

export const alertaExito = (titulo, texto = '') => {
  return Swal.fire({
    icon: 'success',
    title: titulo,
    text: texto,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: colorPrincipal,
    background: '#ffffff',
    color: '#24303f',
    borderRadius: '18px'
  })
}

export const alertaError = (titulo, texto = '') => {
  return Swal.fire({
    icon: 'error',
    title: titulo,
    text: texto,
    confirmButtonText: 'Entendido',
    confirmButtonColor: colorPrincipal,
    background: '#ffffff',
    color: '#24303f',
    borderRadius: '18px'
  })
}

export const alertaConfirmacion = (titulo, texto = '') => {
  return Swal.fire({
    icon: 'warning',
    title: titulo,
    text: texto,

    showCancelButton: true,

    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',

    confirmButtonColor: colorPrincipal,
    cancelButtonColor: colorCancelar,

    reverseButtons: true,

    background: '#ffffff',
    color: '#24303f',
    borderRadius: '18px'
  })
}