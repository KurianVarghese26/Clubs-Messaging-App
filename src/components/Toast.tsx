import { useState } from 'react';
import { Check } from 'lucide-react';

export default function ToastHost({ toasts }: { toasts: { id: number; text: string }[] }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-medium pl-3 pr-4 py-2.5 rounded-full shadow-lg animate-[toastIn_.25s_ease-out]"
        >
          <span className="w-5 h-5 rounded-full bg-[#2e7d4f] flex items-center justify-center shrink-0">
            <Check size={12} strokeWidth={3} className="text-white" />
          </span>
          <span className="truncate">{t.text}</span>
        </div>
      ))}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(8px) scale(.96); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

let counter = 1;
export function useToasts() {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const push = (text: string) => {
    const id = counter++;
    setToasts((p) => [...p.slice(-2), { id, text }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 2400);
  };
  return { toasts, push };
}
