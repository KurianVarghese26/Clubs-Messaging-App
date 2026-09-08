import { CEO_EMAIL, CEO_USERNAME, useCeo } from '../lib/ceo';

export default function VerifiedTick({
  userId,
  email,
  username,
  size = 17,
  className = '',
}: {
  userId?: string | null;
  email?: string | null;
  username?: string | null;
  size?: number;
  className?: string;
}) {
  const { ceoId } = useCeo();
  const verified =
    (username || '').trim().toLowerCase().replace(/^@/, '') === CEO_USERNAME ||
    (email || '').trim().toLowerCase() === CEO_EMAIL ||
    (!!userId && !!ceoId && userId === ceoId);
  if (!verified) return null;
  return (
    <img
      src="/verified-tick.png"
      alt="Verified CEO"
      title="Verified — CEO of Clubs"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
}
