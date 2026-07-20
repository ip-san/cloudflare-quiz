import { Component, type ReactNode } from 'react'
import { locale } from '@/config/locale'
import { trackError } from '@/lib/analytics'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  retryCount: number
}

/** DOM mismatch errors caused by browser extensions/translation modifying React-managed nodes */
const DOM_MISMATCH_PATTERNS = [
  'insertBefore',
  'removeChild',
  'appendChild',
  'The node to be removed is not a child',
  'The node before which the new node',
]

function isDOMMismatchError(error: Error): boolean {
  return DOM_MISMATCH_PATTERNS.some((p) => error.message.includes(p))
}

/** Stale cache errors — old JS references components that were renamed/removed in a new deploy */
function isStaleCacheError(error: Error): boolean {
  return /is not defined$/.test(error.message) && error instanceof ReferenceError
}

const MAX_AUTO_RETRIES = 1
const RELOAD_KEY = 'ccquiz-stale-cache-reload'

/**
 * React Error Boundary — catches render errors and shows fallback UI.
 *
 * DOM mismatch errors (from browser translation/extensions modifying the DOM)
 * are auto-retried once, since a fresh render usually resolves them.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, retryCount: 0 }
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('Quiz app error:', error)

    if (isDOMMismatchError(error)) {
      if (this.state.retryCount < MAX_AUTO_RETRIES) {
        // Auto-retry: DOM mismatch from browser extensions/translation is transient
        this.setState((prev) => ({ hasError: false, retryCount: prev.retryCount + 1 }))
        return
      }
      // DOM mismatch after retry — still not an app bug, skip GA4 tracking
      return
    }

    // Stale Service Worker cache: old JS references removed components
    // Auto-reload once to pick up new SW cache
    if (isStaleCacheError(error)) {
      const lastReload = sessionStorage.getItem(RELOAD_KEY)
      if (!lastReload) {
        sessionStorage.setItem(RELOAD_KEY, Date.now().toString())
        window.location.reload()
        return
      }
      // Already reloaded once this session — show error UI instead of loop
    }

    trackError(error.message, 'react_boundary', 'caught')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-claude-cream px-4">
          <div className="text-center">
            <p className="mb-4 text-lg font-semibold text-claude-dark">{locale.errorBoundary.title}</p>
            <p className="mb-6 text-sm text-stone-500">{locale.errorBoundary.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="tap-highlight rounded-2xl bg-claude-orange px-6 py-3 text-base font-semibold text-white"
            >
              {locale.errorBoundary.reload}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
