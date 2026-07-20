/** Progress text + dots — both pulse in color together */
export function ProgressLabel({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 animate-[text-pulse_2s_ease-in-out_infinite]">
      <span key={text} className="animate-[fade-in_0.4s_ease-out]">
        {text}
      </span>
      <span className="inline-flex gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-[5px] w-[5px] rounded-full bg-current animate-[pulse-dot_1.4s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </span>
      <style>{`
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.25; }
          40% { opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes text-pulse {
          0%, 100% { color: #a8a29e; }
          50% { color: #e17c49; }
        }
      `}</style>
    </span>
  )
}
