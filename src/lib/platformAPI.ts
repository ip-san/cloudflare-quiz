/**
 * Platform abstraction layer
 *
 * Web (PWA) 環境のブラウザ標準 API を使用する。
 */

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  // Delay cleanup to allow download to start
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

function pickAndReadFile(accept: string): Promise<{ success: boolean; data?: string; error?: string }> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    // Fallback: if no file selected after focus returns to window
    const handleFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) {
          resolve({ success: false, error: 'cancelled' })
        }
        window.removeEventListener('focus', handleFocus)
      }, 500)
    }
    input.onchange = () => {
      window.removeEventListener('focus', handleFocus) // Clean up listener on file selection
      const file = input.files?.[0]
      if (!file) {
        resolve({ success: false, error: 'cancelled' })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        resolve({ success: true, data: reader.result as string })
      }
      reader.onerror = () => {
        resolve({ success: false, error: 'Failed to read file' })
      }
      reader.readAsText(file)
    }
    // Handle cancel — oncancel not supported in all browsers, use focus fallback
    input.oncancel = () => {
      window.removeEventListener('focus', handleFocus)
      resolve({ success: false, error: 'cancelled' })
    }
    window.addEventListener('focus', handleFocus)
    input.click()
  })
}

export const platformAPI = {
  openExternal: (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
    return Promise.resolve(true)
  },

  copyToClipboard: async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  },

  exportProgress: async (data: string): Promise<{ success: boolean; error?: string }> => {
    downloadFile(data, 'quiz-progress.json', 'application/json')
    return { success: true }
  },

  importProgress: () => pickAndReadFile('.json'),

  exportCsv: async (data: string, filename: string): Promise<{ success: boolean; error?: string }> => {
    downloadFile(data, filename, 'text/csv')
    return { success: true }
  },
}
