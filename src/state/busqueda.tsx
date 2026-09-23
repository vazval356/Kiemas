import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * El texto del buscador de la cabecera.
 *
 * El buscador vivía flotando sobre el mapa, siempre abierto, y se comía la
 * franja de arriba entera aunque casi nunca se usara. Ahora es una lupa en la
 * cabecera que se despliega al tocarla. La cabecera y la pantalla que filtra
 * son hermanas en el árbol, así que el texto tiene que vivir por encima de las
 * dos: aquí.
 */
interface Busqueda {
  abierta: boolean
  texto: string
  abrir: () => void
  cerrar: () => void
  setTexto: (texto: string) => void
}

const Contexto = createContext<Busqueda | null>(null)

/** Pantallas en las que la lupa tiene algo que filtrar. */
export const RUTAS_CON_BUSQUEDA = ['/', '/list']

export function BusquedaProvider({ children }: { children: ReactNode }) {
  const [abierta, setAbierta] = useState(false)
  const [texto, setTexto] = useState('')
  const { pathname } = useLocation()

  // Una búsqueda del mapa no debe llegar filtrada a la lista sin que se vea:
  // al cambiar de pantalla se empieza de cero.
  useEffect(() => {
    setAbierta(false)
    setTexto('')
  }, [pathname])

  return (
    <Contexto.Provider
      value={{
        abierta,
        texto,
        setTexto,
        abrir: () => setAbierta(true),
        cerrar: () => {
          setAbierta(false)
          setTexto('')
        },
      }}
    >
      {children}
    </Contexto.Provider>
  )
}

export function useBusqueda(): Busqueda {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useBusqueda fuera de BusquedaProvider')
  return ctx
}
