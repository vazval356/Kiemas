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
  /**
   * Los chips de categoría del mapa. Van plegados por defecto para dejar el
   * mapa limpio, y se despliegan con el botón que hay junto a la lupa.
   */
  categoriasAbiertas: boolean
  alternarCategorias: () => void
  /** La categoría filtrada, para que el botón se vea activo aunque esté plegado. */
  categoria: string | null
  setCategoria: (id: string | null) => void
}

const Contexto = createContext<Busqueda | null>(null)

/** Pantallas en las que la lupa tiene algo que filtrar. */
export const RUTAS_CON_BUSQUEDA = ['/', '/list']

/** Pantallas con el botón de categorías en la cabecera. */
export const RUTAS_CON_CATEGORIAS = ['/']

export function BusquedaProvider({ children }: { children: ReactNode }) {
  const [abierta, setAbierta] = useState(false)
  const [texto, setTexto] = useState('')
  const [categoriasAbiertas, setCategoriasAbiertas] = useState(false)
  const [categoria, setCategoria] = useState<string | null>(null)
  const { pathname } = useLocation()

  // Una búsqueda del mapa no debe llegar filtrada a la lista sin que se vea:
  // al cambiar de pantalla se empieza de cero.
  useEffect(() => {
    setAbierta(false)
    setTexto('')
    setCategoriasAbiertas(false)
    setCategoria(null)
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
        categoriasAbiertas,
        alternarCategorias: () => setCategoriasAbiertas((v) => !v),
        categoria,
        setCategoria,
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
