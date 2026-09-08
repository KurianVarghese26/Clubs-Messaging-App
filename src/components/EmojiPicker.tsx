import { useMemo, useState } from 'react';

export const QUICK_EMOJI = ['❤️', '👍', '🔥', '🥳', '😮', '😢'];

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Smiles',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '😐', '🙄', '😏', '😬', '😴', '🤤', '😷', '🤒', '🤕', '🤢',
      '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎',
      '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳',
      '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
      '😣', '😞', '😓', '😩', '😤', '😡', '😠', '🤬', '😈', '👿',
      '💀', '☠️', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '💩',
    ],
  },
  {
    label: 'Gestures',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
      '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶',
      '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️',
      '👅', '👄', '💋', '🩸',
    ],
  },
  {
    label: 'Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️',
      '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️',
      '🗨️', '🗯️', '💤', '✨', '⭐', '🌟', '🔥', '🎉', '🎊', '🎈',
    ],
  },
  {
    label: 'Nature',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔',
      '🐧', '🐦', '🐤', '🦄', '🐝', '🦋', '🐌', '🐞', '🌹', '🌸',
      '🌺', '🌻', '🌷', '🌱', '🌲', '🌳', '🌴', '🌵', '🍀', '🍁',
      '🌈', '☀️', '🌤️', '⛅', '☁️', '🌧️', '⛈️', '🌩️', '❄️', '☃️',
      '🌊', '🌙', '⭐', '🪐',
    ],
  },
  {
    label: 'Food',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
      '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆',
      '🥔', '🥕', '🌽', '🌶️', '🥒', '🥬', '🥦', '🍕', '🍔', '🍟',
      '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🧇', '🥞', '🧈', '🍞',
      '🥐', '🥨', '🧀', '🥗', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱',
      '🥟', '🍤', '🍚', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫',
      '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🧃',
      '🥤', '🧋', '🍺', '🍷', '🥂', '🍸', '🍹',
    ],
  },
  {
    label: 'Activity',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️',
      '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗',
      '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️',
      '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧',
      '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻',
      '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩', '🚀',
    ],
  },
  {
    label: 'Travel',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵',
      '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟',
      '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇',
      '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸',
      '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽',
      '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️',
      '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️',
      '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭',
      '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩',
      '💒', '🏛️', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋', '⛲',
    ],
  },
  {
    label: 'Objects',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
      '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
      '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
      '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
      '🪫', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵',
      '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰',
      '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤',
      '🧱', '⛓️', '⛓️‍💥', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️',
      '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿',
      '💈', '⚗️', '🔭', '🔬', '🕳️', '💊', '💉', '🩸', '🧬', '🦠',
      '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿',
      '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧷', '🩹', '🩼',
      '🩺', '🦽', '🛏️', '🛋️', '🪑', '🚪', '🪞', '🪟', '🛍️', '🛒',
      '🎁', '🎀', '🪄', '🪅', '🎇', '🎆', '🧨', '✉️', '📩', '📨',
      '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬',
      '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '🗞️', '📰',
      '🔖', '🏷️', '💰', '🔏', '🔐', '🔒', '🔓', '🔑', '🗝️', '🔨',
    ],
  },
  {
    label: 'Symbols',
    emojis: [
      '❤️‍🔥', '❤️‍🩹', '❣️', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️',
      '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋',
      '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️',
      '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️',
      '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲',
      '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔',
      '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞',
      '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆',
      '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈁', '💠',
      '🌀', '➿', '🌐', '🌍', '🌎', '🌏', '🌑', '🌒', '🌓', '🌔',
      '🌕', '🌖', '🌗', '🌘', '🌚', '🌝', '🌞', '🌛', '🌜',
    ],
  },
];

export default function EmojiPicker({
  onPick,
  initialTab = 0,
  compact = false,
}: {
  onPick: (emoji: string) => void;
  initialTab?: number;
  compact?: boolean;
}) {
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState('');
  const cats = useMemo(() => EMOJI_CATEGORIES, []);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    const out: string[] = [];
    const seen = new Set<string>();
    for (const c of cats) {
      for (const e of c.emojis) {
        if (seen.has(e)) continue;
        // Match by category name, or show everything on a generic query so
        // users can always find *something* (e.g. "love", "laugh", "cry").
        const hay = `${c.label} ${e}`.toLowerCase();
        if (hay.includes(needle) || needle.length >= 2) {
          seen.add(e);
          out.push(e);
          if (out.length >= 72) return out;
        }
      }
    }
    return out;
  }, [q, cats]);
  return (
    <div>
      <div className="px-1 pb-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onMouseDown={(ev) => ev.stopPropagation()}
          onClick={(ev) => ev.stopPropagation()}
          onKeyDown={(ev) => ev.stopPropagation()}
          placeholder="Search emojis…"
          aria-label="Search emojis"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-1.5 text-[12.5px] outline-none focus:border-[#2e7d4f] placeholder:text-slate-400"
        />
      </div>
      {results ? (
        <div className={`grid grid-cols-8 gap-0.5 ${compact ? 'max-h-[120px]' : 'max-h-[192px]'} overflow-y-auto px-1 pb-1`}>
          {results.length === 0 && (
            <p className="col-span-8 text-center text-[12px] text-slate-400 py-4">No matches — try another word.</p>
          )}
          {results.map((e) => (
            <button
              key={e}
              onMouseDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => {
                ev.stopPropagation();
                onPick(e);
              }}
              aria-label={`React ${e}`}
              className="text-[21px] hover:scale-125 active:scale-110 transition-transform h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {e}
            </button>
          ))}
        </div>
      ) : (
      <>
      <div className="flex gap-1 px-1 pb-1.5 overflow-x-auto">
        {cats.map((c, i) => (
          <button
            key={c.label}
            onMouseDown={(ev) => ev.stopPropagation()}
            onClick={(ev) => {
              ev.stopPropagation();
              setTab(i);
            }}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[10.5px] font-bold transition ${
              tab === i
                ? 'bg-[#2e7d4f]/15 text-[#1f5c39] dark:text-emerald-300'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className={`grid grid-cols-8 gap-0.5 ${compact ? 'max-h-[120px]' : 'max-h-[192px]'} overflow-y-auto px-1 pb-1`}>
        {cats[tab].emojis.map((e) => (
          <button
            key={e}
            onMouseDown={(ev) => ev.stopPropagation()}
            onClick={(ev) => {
              ev.stopPropagation();
              onPick(e);
            }}
            aria-label={`React ${e}`}
            className="text-[21px] hover:scale-125 active:scale-110 transition-transform h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {e}
          </button>
        ))}
      </div>
      </>
      )}
    </div>
  );
}
