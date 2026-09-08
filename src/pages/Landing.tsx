import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Hash,
  QrCode,
  Lock,
  MessagesSquare,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  Check,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import { normalizeClubNumber } from '../lib/utils';

export default function Landing() {
  const { user, profile } = useAuth();
  const [quickJoin, setQuickJoin] = useState('');

  const goJoin = () => {
    const code = normalizeClubNumber(quickJoin);
    window.location.href = `/join?n=${encodeURIComponent(code || quickJoin)}`;
  };

  return (
    <div className="min-h-screen bg-[#f6f7f6] dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Nav */}
      <header className="max-w-5xl mx-auto px-5 pt-5 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          {user && profile ? (
            <Link
              to="/chats"
              className="rounded-full bg-[#2e7d4f] hover:bg-[#276b43] text-white text-sm font-semibold px-5 py-2.5 transition flex items-center gap-1.5"
            >
              Open Chats <ArrowRight size={15} />
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-4 py-2.5 transition"
              >
                Sign in
              </Link>
              <Link
                to="/auth"
                className="rounded-full bg-[#2e7d4f] hover:bg-[#276b43] text-white text-sm font-semibold px-5 py-2.5 transition"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-5">
        <div className="pt-14 sm:pt-20 pb-10 text-center max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm mb-5">
              <ShieldCheck size={13} className="text-[#2e7d4f]" /> Private by design · No phone number needed
            </div>
            <h1 className="text-[38px] sm:text-[54px] leading-[1.05] font-bold tracking-tight">
              Private conversations.
              <br />
              <span className="text-[#2e7d4f] dark:text-emerald-400">Simple joining.</span>
            </h1>
            <p className="mt-5 text-[16px] sm:text-[17px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Clubs combines quiet 1-to-1 chats with private group chats called{' '}
              <strong className="text-slate-700 dark:text-slate-200 font-semibold">Clubs</strong>. Create a
              Club, share its number or QR code — anyone with it can join in seconds.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to={user ? '/chats' : '/auth'}
                className="w-full sm:w-auto rounded-2xl bg-[#2e7d4f] hover:bg-[#276b43] text-white font-semibold text-[15px] px-7 py-3.5 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Users size={17} /> Create a Club
              </Link>
              <Link
                to="/join"
                className="w-full sm:w-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 font-semibold text-[15px] px-7 py-3.5 transition flex items-center justify-center gap-2"
              >
                <Hash size={17} className="text-[#2e7d4f]" /> Join with a number
              </Link>
            </div>

            {/* Quick join */}
            <div className="mt-6 max-w-md mx-auto">
              <div className="flex gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 pl-4 shadow-sm focus-within:border-[#2e7d4f] focus-within:ring-2 focus-within:ring-[#2e7d4f]/20 transition">
                <input
                  value={quickJoin}
                  onChange={(e) => setQuickJoin(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && goJoin()}
                  placeholder="Have a Club number? e.g. CLB-7F42-91K8"
                  className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-slate-400 min-w-0 font-mono tracking-wide"
                />
                <button
                  onClick={goJoin}
                  className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13.5px] font-semibold px-4 py-2.5 hover:opacity-90 transition shrink-0"
                >
                  Join
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Phone-ish preview */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="max-w-3xl mx-auto grid sm:grid-cols-3 gap-3 pb-4"
        >
          <PreviewCard
            title="A number, not a link maze"
            body="Every Club gets a short memorable number like CLB-7F42-91K8. Say it, text it, write it on a whiteboard."
            icon={<Hash size={18} className="text-[#2e7d4f]" />}
          />
          <PreviewCard
            title="Passkey when it matters"
            body="Owners can protect a Club with a passkey. Wrong guesses are rate-limited, so brute force goes nowhere."
            icon={<Lock size={18} className="text-[#2e7d4f]" />}
          />
          <PreviewCard
            title="QR invites in person"
            body="Show a QR code and the room joins instantly. Perfect for classrooms, teams and events."
            icon={<QrCode size={18} className="text-[#2e7d4f]" />}
          />
        </motion.div>

        {/* Feature rows */}
        <div className="py-12 space-y-3 max-w-3xl mx-auto">
          <FeatureRow
            icon={<MessagesSquare size={19} className="text-[#2e7d4f]" />}
            title="Chats + Clubs in one calm inbox"
            body="Direct messages and Clubs live together in a single Chats screen with unread counts, search and real-time delivery."
          />
          <FeatureRow
            icon={<Zap size={19} className="text-[#2e7d4f]" />}
            title="Fast, minimal, serious"
            body="Rounded components, clean typography, light and dark modes. No noise, no ads, no engagement tricks."
          />
          <FeatureRow
            icon={<ShieldCheck size={19} className="text-[#2e7d4f]" />}
            title="Minimal data, real controls"
            body="Email, name and username is all we ask. Owners, admins and members each have clear permissions. Leave anytime."
          />
        </div>

        {/* Privacy strip */}
        <div className="max-w-3xl mx-auto mb-14 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-7 sm:p-9">
          <h2 className="text-[20px] sm:text-[22px] font-bold tracking-tight">Privacy isn’t a settings page. It’s the product.</h2>
          <ul className="mt-4 space-y-2.5 text-[14px] opacity-90">
            {[
              'No phone numbers collected — ever',
              'Passkeys stored as hashes, never plaintext',
              'Rate-limited lookups and join attempts',
              'Per-user discoverability controls',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#2e7d4f] flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} className="text-white" />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              to={user ? '/chats' : '/auth'}
              className="rounded-2xl bg-[#2e7d4f] hover:bg-[#276b43] text-white font-semibold text-[15px] px-6 py-3 text-center transition"
            >
              Start chatting — it’s free
            </Link>
          </div>
        </div>

        <footer className="pb-10 text-center text-[12.5px] text-slate-400 dark:text-slate-500">
          Clubs · Private conversations. Simple joining. · Built with care in 2026
        </footer>
      </main>
    </div>
  );
}

function PreviewCard({ title, body, icon }: { title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 text-left shadow-sm">
      <div className="w-10 h-10 rounded-2xl bg-[#2e7d4f]/10 flex items-center justify-center mb-3">{icon}</div>
      <div className="font-bold text-[15px] tracking-tight">{title}</div>
      <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{body}</p>
    </div>
  );
}

function FeatureRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
      <div className="w-10 h-10 rounded-2xl bg-[#2e7d4f]/10 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="font-bold text-[15px] tracking-tight">{title}</div>
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
