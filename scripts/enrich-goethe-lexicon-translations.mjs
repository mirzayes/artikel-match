/**
 * A) Əsas leksikon: `translations` sahəsini silir (tərcümə əsasən `translation` — adətən az).
 * B) Hər dil üçün ayrıca: public/lexicon-glosses/{en,ru,tr,kr,zh,es,ar}.json — { "word-id": "gloss" }.
 *    Mövcud fayldakı id-lər saxlanılır; dolu tərcümələr üçün API çağırılmır.
 *
 * Usage:
 *   node scripts/enrich-goethe-lexicon-translations.mjs
 *   node scripts/enrich-goethe-lexicon-translations.mjs --mt
 *   node scripts/enrich-goethe-lexicon-translations.mjs --mt --only-lang es --delay-ms 400
 *   node scripts/enrich-goethe-lexicon-translations.mjs --mt --limit 200
 *   node scripts/enrich-goethe-lexicon-translations.mjs --dry-run
 *
 * --only-lang <code> — yalnız həmin dilin JSON-unu yeniləyir; əsas leksikona toxunmur.
 * --out-main — tam işləmədə əsas JSON çıxışı (defolt: --in).
 * --gloss-dir — defolt: public/lexicon-glosses
 * --delay-ms — MyMemory arası gözləmə (defolt: 320)
 *
 * Koreya: fayl adı kr.json, MyMemory cütündə hədəf `ko`.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEFAULT_IN = path.join(ROOT, 'public', 'goethe-lexicon.json');
const DEFAULT_GLOSS_DIR = path.join(ROOT, 'public', 'lexicon-glosses');
const CACHE_PATH = path.join(__dirname, '.lexicon-mt-cache.json');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const GLOSS_LANG_FILES = ['en', 'ru', 'tr', 'kr', 'zh', 'es', 'ar'];

const MYMEMORY_TARGET = {
  en: 'en',
  ru: 'ru',
  tr: 'tr',
  kr: 'ko',
  zh: 'zh-CN',
  es: 'es',
  ar: 'ar',
};

function hashKey(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 40);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadExistingGlossMap(glossDir, lang) {
  const p = path.join(glossDir, `${lang}.json`);
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch {
    return {};
  }
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0), 'utf8');
}

let cacheWrites = 0;
function bumpCacheWrite(cache) {
  cacheWrites++;
  if (cacheWrites % 40 === 0) saveCache(cache);
}

async function mymemory(q, langpair, cache, delayMs) {
  const key = hashKey(`${langpair}::${q}`);
  if (cache[key]) return cache[key];
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.slice(0, 450))}&langpair=${langpair}`;
  const res = await fetch(url);
  const j = await res.json();
  if (j?.quotaFinished) console.warn('[mymemory] quota finished — resume later (cache saved).');
  const t = typeof j?.responseData?.translatedText === 'string' ? j.responseData.translatedText.trim() : '';
  if (t && j.responseStatus === 200) {
    cache[key] = t;
    bumpCacheWrite(cache);
  }
  await sleep(delayMs);
  return t;
}

function looksUntranslated(word, t) {
  if (!t) return true;
  return t.toLowerCase() === word.toLowerCase();
}

async function glossForTarget(word, azFull, lang, cache, delayMs) {
  const tgt = MYMEMORY_TARGET[lang];
  if (!tgt) return '';
  const w = word.trim();
  const pair1 = `de|${tgt}`;
  let t = await mymemory(w, pair1, cache, delayMs);
  if (looksUntranslated(w, t) && lang === 'zh') {
    t = await mymemory(w, `de|zh`, cache, delayMs);
  }
  if (looksUntranslated(w, t)) {
    const azBit = azFull.split('/')[0].trim();
    if (azBit) {
      const pair2 = `az|${tgt}`;
      let t2 = await mymemory(azBit, pair2, cache, delayMs);
      if (looksUntranslated(azBit, t2) && lang === 'zh') {
        t2 = await mymemory(azBit, `az|zh`, cache, delayMs);
      }
      if (t2 && !looksUntranslated(azBit, t2)) return t2;
    }
  }
  return looksUntranslated(w, t) ? '' : t;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    mt: argv.includes('--mt'),
    dry: argv.includes('--dry-run'),
    limit: (() => {
      const i = argv.indexOf('--limit');
      if (i === -1) return null;
      const n = Number(argv[i + 1]);
      return Number.isFinite(n) && n > 0 ? n : null;
    })(),
    delayMs: (() => {
      const i = argv.indexOf('--delay-ms');
      if (i === -1) return 320;
      const n = Number(argv[i + 1]);
      return Number.isFinite(n) && n >= 0 ? n : 320;
    })(),
    onlyLang: (() => {
      const i = argv.indexOf('--only-lang');
      return i !== -1 && argv[i + 1] ? String(argv[i + 1]).trim().toLowerCase() : null;
    })(),
    input: (() => {
      const i = argv.indexOf('--in');
      return i !== -1 && argv[i + 1] ? path.resolve(argv[i + 1]) : DEFAULT_IN;
    })(),
    outMain: (() => {
      const i = argv.indexOf('--out-main');
      return i !== -1 && argv[i + 1] ? path.resolve(argv[i + 1]) : null;
    })(),
    glossDir: (() => {
      const i = argv.indexOf('--gloss-dir');
      return i !== -1 && argv[i + 1] ? path.resolve(argv[i + 1]) : DEFAULT_GLOSS_DIR;
    })(),
  };
}

async function main() {
  const { mt, dry, limit, delayMs, onlyLang, input, outMain, glossDir } = parseArgs();

  let langsToProcess = GLOSS_LANG_FILES;
  if (onlyLang) {
    if (!GLOSS_LANG_FILES.includes(onlyLang)) {
      console.error(`Unknown --only-lang "${onlyLang}". Expected one of: ${GLOSS_LANG_FILES.join(', ')}`);
      process.exit(1);
    }
    langsToProcess = [onlyLang];
  }

  const mainOutPath = outMain ?? input;
  const data = loadJson(input);
  const cache = loadCache();
  const maps = {};
  for (const lang of langsToProcess) {
    maps[lang] = loadExistingGlossMap(glossDir, lang);
  }

  const stripMain = !onlyLang;
  let entryCount = 0;
  let mtCalls = 0;
  let mtRemaining = limit == null ? Number.POSITIVE_INFINITY : limit;

  for (const lvl of LEVELS) {
    const arr = data[lvl];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : null;
      const tr = typeof item.translation === 'string' ? item.translation.trim() : '';
      entryCount++;
      const prev = item.translations && typeof item.translations === 'object' ? item.translations : {};

      if (!id || !tr) {
        if (stripMain) delete item.translations;
        continue;
      }

      for (const lang of langsToProcess) {
        const existingRaw = maps[lang][id];
        let g =
          typeof existingRaw === 'string' && existingRaw.trim()
            ? existingRaw.trim()
            : typeof prev[lang] === 'string'
              ? prev[lang].trim()
              : '';

        if (!g && mt && mtRemaining > 0) {
          g = await glossForTarget(item.word, tr, lang, cache, delayMs);
          mtCalls++;
          mtRemaining--;
        }
        if (g) maps[lang][id] = g;
      }

      if (stripMain) delete item.translations;
    }
  }

  saveCache(cache);

  if (dry) {
    const parts = langsToProcess.map((l) => `${l}=${Object.keys(maps[l]).length}`).join(' ');
    console.log(`Dry run: ${entryCount} entries, mt=${mt}, mtCalls≈${mtCalls}, maps: ${parts}`);
    return;
  }

  fs.mkdirSync(glossDir, { recursive: true });
  for (const lang of langsToProcess) {
    const p = path.join(glossDir, `${lang}.json`);
    fs.writeFileSync(p, JSON.stringify(maps[lang]), 'utf8');
    console.log(`Wrote ${p} (${Object.keys(maps[lang]).length} ids).`);
  }

  if (stripMain) {
    fs.writeFileSync(mainOutPath, JSON.stringify(data), 'utf8');
    console.log(`Wrote lean main lexicon: ${mainOutPath}`);
  } else {
    console.log('Skipped main lexicon (--only-lang).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
