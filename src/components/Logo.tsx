import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Logo({ size = 34, showWord = true, wordSize = 'text-[19px]' }: { size?: number; showWord?: boolean; wordSize?: string }) {
  const { prefs, updatePrefs } = useAuth();
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const fn = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && systemDark);

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className="rounded-2xl flex items-center justify-center shadow-sm"
        style={{ width: size, height: size, backgroundColor: '#2e7d4f' }}
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="8.5" cy="9" r="3.4" fill="white" opacity="0.95" />
          <circle cx="15.5" cy="9" r="3.4" fill="white" opacity="0.55" />
          <path d="M3.5 19.5c0-3.2 2.2-5.2 5-5.2s5 2 5 5.2" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M11.5 19.5c.3-2.5 2-4.2 4.2-4.2 1.6 0 3 .9 3.8 2.3" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
        </svg>
      </div>
      {showWord && (
        <div className="leading-none">
          <div className={`font-bold tracking-tight text-slate-900 dark:text-white ${wordSize}`}>Clubs</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">Private conversations</div>
        </div>
      )}
      {showWord && (
        <button
          onClick={() => updatePrefs({ theme: dark ? 'light' : 'dark' })}
          className="ml-1 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      )}
    </div>
  );
}
