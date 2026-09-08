import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeClubNumber } from '../lib/utils';

export default function JoinRoute({ onJoin }: { onJoin: (n: string) => void }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const n = params.get('n') || '';
    const code = normalizeClubNumber(n);
    if (!user) {
      navigate(`/auth?next=${encodeURIComponent('/join' + (code ? `?n=${encodeURIComponent(code)}` : ''))}`);
      return;
    }
    if (code) {
      onJoin(code);
      navigate('/chats', { replace: true });
    } else {
      onJoin('');
      navigate('/chats', { replace: true });
    }
  }, [loading, user, params, navigate, onJoin]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-[#2e7d4f] animate-spin" />
    </div>
  );
}
