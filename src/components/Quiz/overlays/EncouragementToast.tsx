import { Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { locale } from '@/config/locale'
import { Toast } from './Toast'
import { useToastPhase } from './useToastPhase'

interface EncouragementToastProps {
  wrongStreak: number
}

const MESSAGES = locale.encouragement.messages

/**
 * 連続不正解時に表示される励ましトースト
 * 2問連続不正解ごとに表示
 */
export function EncouragementToast({ wrongStreak }: EncouragementToastProps) {
  const { phase, trigger, style } = useToastPhase(3000)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (wrongStreak >= 2 && wrongStreak % 2 === 0) {
      setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])
      return trigger()
    }
  }, [wrongStreak, trigger])

  return (
    <Toast
      phase={phase}
      style={style}
      icon={<Heart className="h-4 w-4" />}
      message={message}
      gradient="from-blue-500 to-indigo-500"
    />
  )
}
