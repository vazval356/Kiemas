/**
 * Cuánto llevas gastado de un tope de tu plan.
 *
 * Existe porque el aviso llegaba tarde: hasta ahora quien se topaba con un
 * límite se enteraba después de rellenar el formulario entero y recibir un
 * error, que es el momento exacto en que se abandona una app en vez de pagarla.
 *
 * Con `max` a `null` no se pinta nada. Un nivel sin topes no tiene nada que
 * medir, y una barra vacía con la palabra «ilimitado» al lado es ruido que
 * ocupa el sitio de lo que sí importa.
 */
export function QuotaMeter({
  label,
  used,
  max,
}: {
  label: string
  used: number
  max: number | null
}) {
  if (max === null) return null

  const proporcion = Math.min(1, used / max)
  // Se avisa a partir del 80 %: antes no hay nada que decir, y al 100 % ya es
  // tarde para que sirva de aviso.
  const apretado = proporcion >= 0.8
  const lleno = used >= max

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-on-surface-variant">{label}</span>
        <span
          className={`text-sm font-semibold tabular-nums ${
            lleno ? 'text-error' : apretado ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          {used} / {max}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={`h-full rounded-full ${lleno ? 'bg-error' : 'bg-primary'}`}
          // Se redondea al pintar: un 0,5 % dejaría una raya de medio píxel que
          // en unos móviles se ve y en otros no.
          style={{ width: `${Math.round(proporcion * 100)}%` }}
        />
      </div>
    </div>
  )
}
