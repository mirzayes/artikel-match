import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PLAYER_AVATARS, type PlayerAvatarId } from '../lib/playerProfileRtdb';
import { useGameStore } from '../store/useGameStore';

const ONBOARDING_AVATAR_ORDER = [
  'pretzel',
  'rocket',
  'lion',
  'star',
  'wolf',
  'apple',
  'zap',
  'books',
  'target',
  'brain',
] as const satisfies readonly PlayerAvatarId[];

type OnboardingProps = {
  onComplete: () => void;
};

const GUEST_NAME = 'Qonaq';

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { t } = useTranslation();
  const setPlayer = useGameStore((s) => s.setPlayer);

  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState<PlayerAvatarId>('pretzel');

  const avatars = useMemo(
    () =>
      ONBOARDING_AVATAR_ORDER.map((id) => PLAYER_AVATARS.find((a) => a.id === id)).filter(
        (a): a is (typeof PLAYER_AVATARS)[number] => Boolean(a),
      ),
    [],
  );

  const startWithName = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlayer(trimmed, avatarId);
    onComplete();
  }, [avatarId, name, onComplete, setPlayer]);

  const startAsGuest = useCallback(() => {
    setPlayer(GUEST_NAME, avatarId);
    onComplete();
  }, [avatarId, onComplete, setPlayer]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-blue-950 via-indigo-950 to-purple-950 flex items-center justify-center p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md w-full text-center space-y-10">
        <div className="space-y-3">
          <div className="text-6xl mb-4" aria-hidden>
            🇩🇪
          </div>
          <h1 className="text-5xl font-bold text-white tracking-tight">Artikel Match</h1>
          <p className="text-3xl text-yellow-400 font-medium">der · die · das</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-white leading-tight">
            Alman dilində artiklları <br /> oyun vasitəsilə öyrən!
          </h2>
          <p className="text-lg text-gray-300">3000+ söz • A1-C1 səviyyələri • Dərhal feedback</p>
        </div>

        <div className="grid grid-cols-3 gap-4 my-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <p className="text-2xl font-bold text-green-400">der</p>
            <p className="text-sm text-gray-400 mt-1">Tisch</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <p className="text-2xl font-bold text-pink-400">die</p>
            <p className="text-sm text-gray-400 mt-1">Lampe</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <p className="text-2xl font-bold text-blue-400">das</p>
            <p className="text-sm text-gray-400 mt-1">Haus</p>
          </div>
        </div>

        <div className="space-y-5">
          <input
            type="text"
            placeholder="Adın nədir?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            autoComplete="nickname"
            className="w-full bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-white placeholder-gray-400 text-center text-lg focus:outline-none focus:border-yellow-400"
          />

          <div>
            <p className="text-sm text-gray-400 mb-3">Avatar seç</p>
            <div className="flex justify-center gap-3 flex-wrap">
              {avatars.map((av) => {
                const on = avatarId === av.id;
                const label = t(`profile.avatar_${av.id}` as 'profile.avatar_pretzel');
                return (
                  <button
                    key={av.id}
                    type="button"
                    title={label}
                    aria-pressed={on}
                    aria-label={label}
                    onClick={() => setAvatarId(av.id)}
                    className={`text-4xl p-3 rounded-2xl transition-all hover:scale-110 ${
                      on ? 'bg-yellow-400/30 ring-2 ring-yellow-400' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {av.emoji}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <button
            type="button"
            onClick={startWithName}
            disabled={!name.trim()}
            className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none text-black font-bold text-xl py-5 rounded-3xl shadow-xl shadow-yellow-500/40"
          >
            Oyuna Başla
          </button>

          <button
            type="button"
            onClick={startAsGuest}
            className="w-full border border-white/40 hover:bg-white/10 transition-colors text-white font-medium py-4 rounded-3xl"
          >
            Qonaq kimi oyna
          </button>
        </div>

        <p className="text-xs text-gray-500 pt-6">Tamamilə pulsuz • 3000+ söz • A1-dən C1-ə qədər</p>
      </div>
    </div>
  );
}
