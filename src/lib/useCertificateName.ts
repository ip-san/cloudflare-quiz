import { useCallback, useState } from 'react'
import { theme } from '@/config/theme'

const STORAGE_KEY = `${theme.storagePrefix}-cert-name`

function loadName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

/**
 * 修了証の名前を localStorage に永続化するフック
 * 一度入力すれば、全ての修了証ダウンロードで共有される
 */
export function useCertificateName(): [string, (name: string) => void] {
  const [name, setNameState] = useState(loadName)

  const setName = useCallback((value: string) => {
    setNameState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // ignore quota errors
    }
  }, [])

  return [name, setName]
}
