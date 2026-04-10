export type Article = 'der' | 'die' | 'das';

/** Lüğət tərcümələri (UI dilinə uyğun göstərmə üçün). `kr` — Koreya; fayl `kr.json`, API cütü adətən `ko`. */
export type NounTranslationLang =
  | 'az'
  | 'en'
  | 'ru'
  | 'tr'
  | 'kr'
  | 'zh'
  | 'es'
  | 'ar'
  | 'hi';

export type NounTranslations = Partial<Record<NounTranslationLang, string>>;

export const GOETHE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type GoetheLevel = (typeof GOETHE_LEVELS)[number];

/** Smart Review: hər söz üçün 0 (yeni) … 5 (mənimsənilib). */
export const MAX_MASTERY_LEVEL = 5;

/**
 * Öyrənmə kvizi: bu mastery və ya daha yüksək sözlər növbədən çıxır.
 * Səhv cavab mastery-ni 0-a sıfırlayır — öyrənmə sessiyasında 5 düzgün ulduz tələb olunur.
 */
export const LEARNED_FOR_TRAINING_MASTERY = 5;

/** Öyrənmə: bir sessiyada göstəriləcək maksimum söz sayı (tam pula təsadüfi seçilir). */
export const LEARNING_SESSION_BATCH_SIZE = 20;

/** Öyrənmə sessiyası: bu qədər düzgün cavab — sessiya tamamlanır. */
export const LEARNING_SESSION_GOAL = 20;

/** Öyrənmə: hər düzgün cavab üçün Artik (Happy Hours vurğusu ilə vurulur). */
export const LESSON_CORRECT_NEW_ARTIK = 10;
export const LESSON_CORRECT_REVIEW_ARTIK = 5;

/**
 * Sessiya əvvəli çəkilən söz sayı (SRS pulu); hədəf + ehtiyat, «bilirəm» ilə sıra qısalsa belə.
 */
export const LEARNING_SESSION_POOL_SIZE = Math.max(LEARNING_SESSION_BATCH_SIZE, LEARNING_SESSION_GOAL + 15);

export interface NounEntry {
  id: string;
  level: GoetheLevel;
  article: Article;
  word: string;
  /** Əsas tərcümə (adətən az); köhnə məlumatlar üçün saxlanılır. */
  translation: string;
  /** Çoxdilli tərcümələr; UI dili üçün `getNounTranslation` istifadə edin. */
  translations?: NounTranslations;
  /** CSV Kateqoriya; məs. Kleidung, Körper, İsim */
  category?: string;
}

export interface LevelProgressStats {
  totalAnswered: number;
  correctTotal: number;
  byArticle: Record<Article, { correct: number; total: number }>;
  streak: number;
  bestStreak: number;
  /** Bu səviyyə üçün toplanan təcrübə xalları */
  xp: number;
}

/** Öyrənmə SRS: localStorage «DB» sahələri. */
export interface WordSrsEntry {
  streak: number;
  lastAttempt: string;
  nextReview: string;
}

export interface AppProgressState {
  selectedLevel: GoetheLevel;
  byLevel: Record<GoetheLevel, LevelProgressStats>;
  /** NounEntry.id → mastery 0…MAX_MASTERY_LEVEL */
  masteryByWordId: Record<string, number>;
  /** Öyrənmə SRS: NounEntry.id → təkrar cədvəli */
  srsByWordId: Record<string, WordSrsEntry>;
  /** NounEntry.id → ümumi səhv sayı (avtomatik) */
  wrongCountByWordId: Record<string, number>;
  /** İstifadəçi “çətin” işarələdiyi sözlər */
  hardWordIds: string[];
  /** Kvizdə göstərilməsin — tam bilinən sözlər */
  knownWordIds: string[];
  /**
   * Gün üçün unikal sözlər (düzgün cavab); açar YYYY-MM-DD (yerli tarix).
   * Gündəlik məqsəd proqresi üçün.
   */
  dailyCorrectWordIdsByDate: Record<string, string[]>;
  /**
   * Hər gün verilən cavab sayı (həftəlik sütun diaqramı).
   * Açar YYYY-MM-DD; köhnə açarlar avtomatik təmizlənir.
   */
  activityAnswerCountByDate: Record<string, number>;
  /**
   * Hər gün ümumi düzgün cavab sayı (ODLU SERİYA üçün).
   * Açar YYYY-MM-DD.
   */
  dailyCorrectCountByDate: Record<string, number>;
  /**
   * Yalnız öyrənmə kvizi: hər gün düzgün cavab sayı (nailiyyət seriyası üçün).
   * Açar YYYY-MM-DD.
   */
  learningCorrectByDate: Record<string, number>;
  /** Liderlər cədvəlində görünən ad (boşdursa «Sən»). */
  displayName: string;
  /** İstifadəçinin seçdiyi gündəlik hədəf (ODLU SERİYA). Varsayılan: 20. */
  odluDailyGoal: OdluDailyGoalOption;
}

/** Gündəlik “öyrənilmiş söz” hədəfi (unikal düzgün cavab) */
export const DAILY_WORD_GOAL = 20;

/** ODLU SERİYA: gündəlik norma (düzgün cavab) */
export const ODLU_DAILY_GOAL = 20;

/** İstifadəçinin seçə biləcəyi gündəlik hədəf variantları */
export const ODLU_DAILY_GOAL_OPTIONS = [10, 20, 50] as const;
export type OdluDailyGoalOption = (typeof ODLU_DAILY_GOAL_OPTIONS)[number];

export type ExamQuestionPreset = 10 | 20 | 50 | 'infinite';

export type ExamTopicMode = 'all' | 'wrong';

export interface ExamSessionConfig {
  level: GoetheLevel;
  questions: ExamQuestionPreset;
  topics: ExamTopicMode;
}

export interface RecordAnswerOptions {
  /** Sınaq rejimi: məs. 2 */
  xpMultiplier?: number;
  /** true: yalnız öyrənmə kvizi — SRS + next_review yenilənir */
  learningSrs?: boolean;
}
