import type { SpaceMember } from '../lib/types'

/**
 * La cara de una persona: su foto si la tiene, y si no su inicial.
 *
 * Las votaciones enseñaban iniciales de color. Funciona, pero en un grupo con una
 * Ana y un Alberto salen dos círculos con la misma letra y hay que fijarse en el
 * color para distinguirlos. Una foto se reconoce sin leer, que es justo lo que se
 * quiere de una lista de votos.
 *
 * La inicial no se va: es el respaldo de quien no ha puesto foto, y también lo
 * que se ve mientras la imagen carga. El color de fondo sigue siendo el que esa
 * persona tiene en el grupo, así que el hueco ya identifica antes de que llegue
 * la foto.
 */
export function Cara({
  miembro,
  lado = 24,
  anillo = 'ring-surface-lowest',
}: {
  miembro?: Pick<SpaceMember, 'displayName' | 'avatarUrl' | 'color'>
  /** En píxeles: estas caras se solapan, así que el tamaño se calcula, no se hereda. */
  lado?: number
  /** El aro que las separa cuando se solapan. Va del color del fondo de detrás. */
  anillo?: string
}) {
  const nombre = miembro?.displayName ?? '?'
  const estilo = { width: lado, height: lado }

  if (miembro?.avatarUrl) {
    return (
      <img
        decoding="async"
        src={miembro.avatarUrl}
        alt={nombre}
        title={nombre}
        loading="lazy"
        style={estilo}
        className={`shrink-0 rounded-full object-cover ring-2 ${anillo}`}
      />
    )
  }

  return (
    <span
      title={nombre}
      aria-label={nombre}
      style={{ ...estilo, backgroundColor: miembro?.color ?? 'var(--color-outline)' }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ${anillo}`}
    >
      <span style={{ fontSize: Math.round(lado * 0.42) }}>{nombre.slice(0, 1).toUpperCase()}</span>
    </span>
  )
}

/**
 * Las caras de quienes han votado una opción, solapadas.
 *
 * Se solapan a propósito: cuatro círculos separados ocupan el ancho de media
 * pantalla y empujan el recuento fuera de la fila. Solapados caben seis sin que
 * la fila crezca, y el aro del color del fondo evita que se confundan entre sí.
 *
 * Por encima de `tope` se corta y se dice cuántos quedan, en lugar de apretar
 * hasta que no se reconozca ninguna. En un grupo de veinte, ver cuatro caras y
 * «+16» informa más que veinte manchas de tres píxeles.
 */
export function Caras({
  ids,
  miembros,
  lado = 24,
  tope = 6,
  anillo,
}: {
  ids: string[]
  miembros: SpaceMember[]
  lado?: number
  tope?: number
  anillo?: string
}) {
  const visibles = ids.slice(0, tope)
  const resto = ids.length - visibles.length

  return (
    <span className="flex items-center">
      {visibles.map((id) => (
        <span key={id} className="-mr-1.5 last:mr-0">
          <Cara miembro={miembros.find((m) => m.userId === id)} lado={lado} anillo={anillo} />
        </span>
      ))}
      {resto > 0 && (
        <span className="ml-2.5 text-xs font-semibold text-on-surface-variant">+{resto}</span>
      )}
    </span>
  )
}
