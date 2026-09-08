import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { handleGoogleRedirect } from './lib/googleAuth';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Settings from './pages/Settings';
import JoinRoute from './pages/JoinRoute';
import Chats from './components/Chats';
import ClubChat from './components/ClubChat';
import DMChat from './components/DMChat';
import ClubInfo from './components/ClubInfo';
import CreateClubModal from './components/CreateClubModal';
import JoinClubModal from './components/JoinClubModal';
import NewChatModal from './components/NewChatModal';
import ToastHost, { useToasts } from './components/Toast';
import Logo from './components/Logo';
import type { Club } from './lib/types';

handleGoogleRedirect();

function Protected({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading } = useAuth();
  const location = useLocation();
  if (loading || (user && profileLoading && !profile)) {
    return (
      <div className="min-h-screen bg-[#f6f7f6] dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Logo showWord={false} size={52} />
        <div className="w-7 h-7 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-[#2e7d4f] animate-spin" />
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400">Loading your chats…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  // Profile genuinely missing (not just loading): send to /auth which renders
  // profile setup — never a blank screen. Preserve where they were headed.
  if (!profile) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toasts, push } = useToasts();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinNumber, setJoinNumber] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [infoClubId, setInfoClubId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const notify = useCallback((t: string) => push(t), [push]);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Deep-link: /join?n=CLB-...&t=... → open join modal after login
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const n = params.get('n');
    if (location.pathname === '/join' && n && user) {
      setJoinNumber(n.toUpperCase());
      setJoinOpen(true);
      window.history.replaceState({}, '', '/chats');
    }
  }, [location.pathname, location.search, user]);

  const openJoin = useCallback((n?: string) => {
    setJoinNumber(n || '');
    setJoinOpen(true);
  }, []);

  const onClubCreated = useCallback(
    (club: Club) => {
      refresh();
      navigate(`/club/${club.id}`);
    },
    [navigate, refresh]
  );

  const onClubJoined = useCallback(
    (club: Club) => {
      refresh();
      navigate(`/club/${club.id}`);
    },
    [navigate, refresh]
  );

  const inChat = location.pathname.startsWith('/club/') || location.pathname.startsWith('/dm/');

  return (
    <div className="min-h-screen bg-[#f6f7f6] dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/chats"
          element={
            <Protected>
              <ShellFrame inChat={false}>
                <Chats
                  onOpenCreate={() => setCreateOpen(true)}
                  onOpenJoin={openJoin}
                  onOpenNewChat={() => setNewChatOpen(true)}
                  refreshKey={refreshKey}
                  prefill={''}
                />
              </ShellFrame>
            </Protected>
          }
        />
        <Route
          path="/club/:id"
          element={
            <Protected>
              <ShellFrame inChat>
                <ClubChat onOpenInfo={(cid) => setInfoClubId(cid)} notify={notify} />
              </ShellFrame>
            </Protected>
          }
        />
        <Route
          path="/dm/:id"
          element={
            <Protected>
              <ShellFrame inChat>
                <DMChat notify={notify} />
              </ShellFrame>
            </Protected>
          }
        />
        <Route
          path="/settings"
          element={
            <Protected>
              <ShellFrame inChat={false}>
                <Settings notify={notify} />
              </ShellFrame>
            </Protected>
          }
        />
        <Route path="/join" element={<JoinRoute onJoin={openJoin} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global modals (authed only) */}
      {user && (
        <>
          <CreateClubModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreated={onClubCreated}
            notify={notify}
          />
          <JoinClubModal
            open={joinOpen}
            onClose={() => {
              setJoinOpen(false);
              setJoinNumber('');
            }}
            initialNumber={joinNumber}
            onJoined={onClubJoined}
            notify={notify}
          />
          <NewChatModal
            open={newChatOpen}
            onClose={() => setNewChatOpen(false)}
            onCreated={(cid) => {
              refresh();
              navigate(`/dm/${cid}`);
            }}
          />
          <ClubInfo
            clubId={infoClubId}
            onClose={() => setInfoClubId(null)}
            onChanged={refresh}
            notify={notify}
          />
        </>
      )}

      <ToastHost toasts={toasts} />
      {inChat && <span className="hidden" />}
    </div>
  );
}

function ShellFrame({ children, inChat }: { children: React.ReactNode; inChat?: boolean }) {
  return (
    <div className="flex-1 flex justify-center w-full min-h-0">
      <div
        className={`w-full ${inChat ? 'max-w-4xl' : 'max-w-2xl'} flex flex-col min-h-[100dvh] sm:min-h-0 sm:h-[100dvh] bg-[#f6f7f6] dark:bg-slate-950 sm:border-x sm:border-slate-200/70 sm:dark:border-slate-800`}
      >
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
