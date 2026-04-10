import { motion } from 'framer-motion';
import type { Article, LevelProgressStats } from '../types';
import { articleMasteryPercent, articleRankFromPercent } from '../lib/articleRanks';

const ORDER: Article[] = ['der', 'die', 'das'];

const barFillClass: Record<Article, string> = {
  der: 'bg-[#60a5fa]',
  die: 'bg-[#f472b6]',
  das: 'bg-[#34d399]',
};

const labelClass: Record<Article, string> = {
  der: 'text-der',
  die: 'text-die',
  das: 'text-das',
};

interface ArticleRpgCardProps {
  byArticle: LevelProgressStats['byArticle'];
}

export function ArticleRpgCard({ byArticle }: ArticleRpgCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card rounded-2xl border border-white/[0.08] p-5 sm:p-6"
    >
      <p className="gamify-block-title">Artikl Bacarıqları</p>

      <ul className="mt-4 flex flex-col gap-5">
        {ORDER.map((article) => {
          const { correct, total } = byArticle[article];
          const pct = articleMasteryPercent(correct, total);
          const rank = articleRankFromPercent(pct);

          return (
            <li key={article}>
              <p
                className={`font-mono text-xs font-bold uppercase tracking-[0.18em] ${labelClass[article]}`}
              >
                {article}
              </p>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-valuetext={rank.label}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${barFillClass[article]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p
                className={[
                  'mt-2 font-display text-sm font-semibold tracking-tight',
                  rank.isUstad ? 'rpg-rank-master' : 'text-artikl-text',
                ].join(' ')}
              >
                {rank.label}
              </p>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
