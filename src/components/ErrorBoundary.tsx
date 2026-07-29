import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Evita que un fallo de renderizado deje la pantalla en blanco, que dentro de
 * un contenedor de Capacitor es especialmente desconcertante: no hay barra de
 * navegador ni consola a mano para saber qué ha pasado.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error no capturado:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-4xl">🧭</div>
        <h1 className="font-display text-xl font-semibold text-on-surface">
          Algo se ha torcido
        </h1>
        <p className="max-w-sm text-sm text-on-surface-variant">{error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-control bg-primary px-5 py-2.5 font-semibold text-on-primary"
        >
          Recargar
        </button>
      </div>
    )
  }
}
