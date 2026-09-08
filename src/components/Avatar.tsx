import { initials } from '../lib/utils';

interface Props {
  name: string;
  imageUrl?: string | null;
  color?: string | null;
  size?: number;
  ring?: boolean;
}

export default function Avatar({ name, imageUrl, color, size = 44, ring = false }: Props) {
  const bg = color || '#2e7d4f';
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 bg-slate-200 dark:bg-slate-700 ${ring ? 'ring-2 ring-white dark:ring-slate-900' : ''}`}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none ${ring ? 'ring-2 ring-white dark:ring-slate-900' : ''}`}
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.36 }}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
