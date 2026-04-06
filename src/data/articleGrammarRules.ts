import type { Article } from '../types';

export interface SuffixRuleRow {
  suffix: string;
  article: Article;
  rule: string;
  examples: string[];
}

export interface SemanticRuleRow {
  category: string;
  article: Article;
  rule: string;
  examples: string[];
}

export interface ExceptionRow {
  word: string;
  article: Article;
  rule: string;
}

export interface AbbreviationRow {
  /** Böyük hərflə (məs. BMW); yoxlama zamanı lemma bu forma ilə uyğunlaşdırılır. */
  token: string;
  article: Article;
  rule: string;
}

export interface TechTermExceptionRow {
  word: string;
  article: Article;
  rule: string;
}

export interface TechTermsConfig {
  defaultArticle: Article;
  defaultRule: string;
  exceptions: TechTermExceptionRow[];
  list: string[];
}

export interface GadgetsConfig {
  /** Adətən DAS (ingilicizm, -er ilə bitmir). */
  neutral: string[];
  /** -er ilə bitən qadjetlər — DER. */
  masculine: string[];
  ruleDas: string;
  ruleDer: string;
}

export interface DrinksConfig {
  feminine: string[];
  masculine: string[];
  neutral: string[];
  ruleDie: string;
  ruleDer: string;
  ruleDas: string;
}

export interface TimeRulesConfig {
  daysOfWeek: string[];
  months: string[];
  seasons: string[];
  ruleDer: string;
}

/** -er → der qaydasının ~10% qadın cinsi istisnaları (siyahı). */
export interface FeminineErConfig {
  words: string[];
  rule: string;
}

export const articleGrammarRules: {
  suffixRules: SuffixRuleRow[];
  semanticRules: SemanticRuleRow[];
  exceptions: ExceptionRow[];
  abbreviations: AbbreviationRow[];
  techTerms: TechTermsConfig;
  gadgets: GadgetsConfig;
  drinks: DrinksConfig;
  timeRules: TimeRulesConfig;
  feminineEr: FeminineErConfig;
} = {
  suffixRules: [
    {
      suffix: 'chen',
      article: 'das',
      rule: '-chen ilə bitən BÜTÜN sözlər həmişə DAS olur. İstisna yoxdur.',
      examples: ['das Mädchen', 'das Hähnchen', 'das Brötchen'],
    },
    {
      suffix: 'lein',
      article: 'das',
      rule: '-lein ilə bitən BÜTÜN sözlər həmişə DAS olur. İstisna yoxdur.',
      examples: ['das Fräulein', 'das Büchlein'],
    },
    {
      suffix: 'ung',
      article: 'die',
      rule: '-ung ilə bitən bütün sözlər DIE olur.',
      examples: ['die Zeitung', 'die Wohnung', 'die Meinung', 'die Übung'],
    },
    {
      suffix: 'heit',
      article: 'die',
      rule: '-heit ilə bitən bütün sözlər DIE olur.',
      examples: ['die Gesundheit', 'die Freiheit', 'die Krankheit'],
    },
    {
      suffix: 'keit',
      article: 'die',
      rule: '-keit ilə bitən bütün sözlər DIE olur.',
      examples: ['die Möglichkeit', 'die Freundlichkeit', 'die Schwierigkeit'],
    },
    {
      suffix: 'schaft',
      article: 'die',
      rule: '-schaft ilə bitən bütün sözlər DIE olur.',
      examples: ['die Mannschaft', 'die Freundschaft', 'die Landschaft'],
    },
    {
      suffix: 'ion',
      article: 'die',
      rule: '-ion ilə bitən bütün sözlər DIE olur.',
      examples: ['die Information', 'die Situation', 'die Nation', 'die Station'],
    },
    {
      suffix: 'tät',
      article: 'die',
      rule: '-tät ilə bitən bütün sözlər DIE olur.',
      examples: ['die Qualität', 'die Universität', 'die Nationalität'],
    },
    {
      suffix: 'ik',
      article: 'die',
      rule: '-ik ilə bitən bütün sözlər DIE olur.',
      examples: ['die Musik', 'die Physik', 'die Technik', 'die Grammatik'],
    },
    {
      suffix: 'ur',
      article: 'die',
      rule: '-ur ilə bitən bütün sözlər DIE olur.',
      examples: ['die Kultur', 'die Natur', 'die Reparatur', 'die Prozedur'],
    },
    {
      suffix: 'ie',
      article: 'die',
      rule: '-ie ilə bitən bütün sözlər DIE olur.',
      examples: ['die Familie', 'die Energie', 'die Demokratie', 'die Biologie'],
    },
    {
      suffix: 'enz',
      article: 'die',
      rule: '-enz ilə bitən bütün sözlər DIE olur.',
      examples: ['die Intelligenz', 'die Konferenz', 'die Differenz'],
    },
    {
      suffix: 'anz',
      article: 'die',
      rule: '-anz ilə bitən bütün sözlər DIE olur.',
      examples: ['die Toleranz', 'die Eleganz', 'die Distanz'],
    },
    {
      suffix: 'ade',
      article: 'die',
      rule: '-ade ilə bitən bütün sözlər DIE olur.',
      examples: ['die Limonade', 'die Marmelade', 'die Fassade'],
    },
    {
      suffix: 'age',
      article: 'die',
      rule: '-age ilə bitən bütün sözlər DIE olur.',
      examples: ['die Garage', 'die Etage', 'die Massage'],
    },
    {
      suffix: 'ette',
      article: 'die',
      rule: '-ette ilə bitən bütün sözlər DIE olur.',
      examples: ['die Serviette', 'die Kassette', 'die Zigarette'],
    },
    {
      suffix: 'tur',
      article: 'die',
      rule: '-tur ilə bitən bütün sözlər DIE olur.',
      examples: ['die Literatur', 'die Architektur', 'die Temperatur'],
    },
    {
      suffix: 'ling',
      article: 'der',
      rule: '-ling ilə bitən bütün sözlər DER olur.',
      examples: ['der Frühling', 'der Lehrling', 'der Liebling', 'der Schmetterling'],
    },
    {
      suffix: 'ismus',
      article: 'der',
      rule: '-ismus ilə bitən bütün sözlər DER olur.',
      examples: ['der Tourismus', 'der Kapitalismus', 'der Realismus'],
    },
    {
      suffix: 'ist',
      article: 'der',
      rule: '-ist ilə bitən kişi cinsli sözlər DER olur.',
      examples: ['der Tourist', 'der Journalist', 'der Polizist', 'der Pianist'],
    },
    {
      suffix: 'or',
      article: 'der',
      rule: '-or ilə bitən bütün sözlər DER olur.',
      examples: ['der Motor', 'der Doktor', 'der Autor', 'der Direktor'],
    },
    {
      suffix: 'eur',
      article: 'der',
      rule: '-eur ilə bitən bütün sözlər DER olur.',
      examples: ['der Friseur', 'der Ingenieur', 'der Chauffeur'],
    },
    {
      suffix: 'iker',
      article: 'der',
      rule: '-iker ilə bitən bütün sözlər DER olur.',
      examples: ['der Mechaniker', 'der Musiker', 'der Techniker', 'der Physiker'],
    },
    {
      suffix: 'ant',
      article: 'der',
      rule: '-ant ilə bitən bütün sözlər DER olur.',
      examples: ['der Elefant', 'der Praktikant', 'der Musikant'],
    },
    {
      suffix: 'ent',
      article: 'der',
      rule: '-ent ilə bitən bütün sözlər DER olur.',
      examples: ['der Student', 'der Präsident', 'der Patient'],
    },
    {
      suffix: 'ment',
      article: 'das',
      rule: '-ment ilə bitən bütün sözlər DAS olur.',
      examples: ['das Instrument', 'das Medikament', 'das Dokument', 'das Experiment'],
    },
    {
      suffix: 'tum',
      article: 'das',
      rule: '-tum ilə bitən bütün sözlər DAS olur.',
      examples: ['das Datum', 'das Wachstum', 'das Eigentum', 'das Altertum'],
    },
    {
      suffix: 'ium',
      article: 'das',
      rule: '-ium ilə bitən bütün sözlər DAS olur.',
      examples: ['das Studium', 'das Gymnasium', 'das Aquarium', 'das Calcium'],
    },
    {
      suffix: 'um',
      article: 'das',
      rule: '-um ilə bitən bütün sözlər DAS olur.',
      examples: ['das Museum', 'das Zentrum', 'das Album', 'das Publikum'],
    },
    {
      suffix: 'ma',
      article: 'das',
      rule: '-ma ilə bitən bütün sözlər DAS olur.',
      examples: ['das Thema', 'das Drama', 'das Klima', 'das Schema'],
    },
    {
      suffix: 'nis',
      article: 'das',
      rule: '-nis ilə bitən bütün sözlər DAS olur.',
      examples: ['das Ergebnis', 'das Zeugnis', 'das Verhältnis', 'das Ereignis'],
    },
    {
      suffix: 'ett',
      article: 'das',
      rule: '-ett ilə bitən bütün sözlər DAS olur.',
      examples: ['das Tablett', 'das Büfett', 'das Parkett'],
    },
    {
      suffix: 'zeug',
      article: 'das',
      rule:
        '-zeug ilə bitən birləşik sözlər həmişə DAS olur (praktikada 100%): ikinci hissə „Zeug“ (əşya/material) orta cinsdir.',
      examples: ['das Flugzeug', 'das Spielzeug', 'das Feuerzeug'],
    },
    {
      suffix: 'ing',
      article: 'das',
      rule: 'İngilis mənşəli -ing ilə bitən sözlər DAS olur.',
      examples: ['das Meeting', 'das Training', 'das Marketing', 'das Camping'],
    },
    {
      suffix: 'o',
      article: 'das',
      rule: '-o ilə bitən xarici mənşəli sözlər DAS olur.',
      examples: ['das Auto', 'das Kino', 'das Radio', 'das Büro', 'das Video'],
    },
    {
      suffix: 'e',
      article: 'die',
      rule:
        '-e ilə bitən sözlərin əksəriyyəti (~90%) qadın cinsidir (DIE). İSTİSNA: kişi cinsi zəif çekim (N-dekl.) — der Junge, der Kollege, der Löwe, der Name; orta cins — das Interesse, das Ende və s.; həmçinin əzbər istisnalar (məs. der Käse).',
      examples: ['die Lampe', 'die Tasche', 'die Straße', 'die Anzeige'],
    },
    {
      suffix: 'er',
      article: 'der',
      rule:
        '-er ilə bitən sözlərin çoxu (~80%), xüsusən cansız əşya/peşə adlarında, kişi cinsidir (DER). İSTİSNA: qadın cinsi (məs. die Mutter, die Schwester, die Butter); orta cins (məs. das Fenster, das Messer); əzbər sözlər.',
      examples: ['der Computer', 'der Keller', 'der Hammer', 'der Lehrer'],
    },
    {
      suffix: 'en',
      article: 'das',
      rule:
        'İsimləşdirilmiş infinitiv (fəlin substantivləşməsi): böyük hərflə yazılır və -en ilə bitir — təxminən 95% DAS olur (məs. das Lernen, das Essen, das Schwimmen). İSTİSNA: adi isimlər -en ilə bitə bilər (der Garten, der Kuchen …) — əzbərlə.',
      examples: ['das Lernen', 'das Essen', 'das Schwimmen', 'das Lesen'],
    },
    {
      suffix: 'a',
      article: 'die',
      rule:
        'Xarici mənşəli və ya latın sonluğu: -a ilə bitən sözlərin çoxu qadın cinsidir (DIE), məs. die Pizza, die Cola, die Kamera, die Pasta. İSTİSNA: das Sofa və uzun sonluqla tutulanlar (-ma → das Thema və s.).',
      examples: ['die Pizza', 'die Cola', 'die Kamera', 'die Pasta'],
    },
  ],
  semanticRules: [
    {
      category: 'Kişilər',
      article: 'der',
      rule: 'Kişilər və oğlanlar həmişə DER olur.',
      examples: [
        'der Mann',
        'der Junge',
        'der Kollege',
        'der Löwe',
        'der Name',
        'der Vater',
        'der Bruder',
      ],
    },
    {
      category: 'Qadınlar',
      article: 'die',
      rule: 'Qadınlar və qızlar həmişə DIE olur. İSTİSNA: das Mädchen, das Fräulein (-chen/-lein qaydası üstün gəlir).',
      examples: ['die Frau', 'die Mutter', 'die Schwester', 'die Tochter', 'die Tante'],
    },
    {
      category: 'Fəsillər',
      article: 'der',
      rule: 'Bütün fəsillər DER olur.',
      examples: ['der Frühling', 'der Sommer', 'der Herbst', 'der Winter'],
    },
    {
      category: 'Aylar',
      article: 'der',
      rule: 'Bütün aylar DER olur.',
      examples: ['der Januar', 'der März', 'der August', 'der Dezember'],
    },
    {
      category: 'Həftə günləri',
      article: 'der',
      rule: 'Bütün həftə günləri DER olur.',
      examples: ['der Montag', 'der Freitag', 'der Sonntag', 'der Mittwoch'],
    },
    {
      category: 'Günün vaxtları',
      article: 'der',
      rule: 'Günün vaxtları DER olur. İSTİSNA: die Nacht, die Mitternacht.',
      examples: ['der Morgen', 'der Mittag', 'der Abend', 'der Vormittag'],
    },
    {
      category: 'İstiqamətlər',
      article: 'der',
      rule: 'Cəhətlər DER olur.',
      examples: ['der Norden', 'der Süden', 'der Osten', 'der Westen'],
    },
    {
      category: 'Yağıntılar',
      article: 'der',
      rule: 'Yağıntılar DER olur.',
      examples: ['der Regen', 'der Schnee', 'der Hagel', 'der Frost'],
    },
    {
      category: 'Alkoqol',
      article: 'der',
      rule: 'Alkoqol növləri DER olur. İSTİSNA: das Bier, das Weißbier.',
      examples: ['der Wein', 'der Wodka', 'der Whisky', 'der Sekt', 'der Champagner'],
    },
    {
      category: 'Avtomobil markaları',
      article: 'der',
      rule: 'Avtomobil markaları DER olur.',
      examples: ['der BMW', 'der Audi', 'der Mercedes', 'der Volkswagen'],
    },
    {
      category: 'Valyutalar',
      article: 'der',
      rule: 'Valyutalar DER olur.',
      examples: ['der Euro', 'der Dollar', 'der Franc', 'der Rubel'],
    },
    {
      category: 'Uşaqlar və heyvan balaları',
      article: 'das',
      rule: 'Uşaqlar və heyvan balaları DAS olur.',
      examples: ['das Kind', 'das Baby', 'das Kalb', 'das Küken', 'das Lamm'],
    },
    {
      category: 'Metallar',
      article: 'das',
      rule: 'Metallar DAS olur.',
      examples: ['das Gold', 'das Silber', 'das Eisen', 'das Kupfer', 'das Aluminium'],
    },
    {
      category: 'Dillər',
      article: 'das',
      rule: 'Dil adları DAS olur (adətən artikl olmadan işlənir).',
      examples: ['das Deutsch', 'das Englisch', 'das Arabisch', 'das Türkisch'],
    },
    {
      category: 'Ağaclar',
      article: 'die',
      rule: 'Ağac adları DIE olur.',
      examples: ['die Eiche', 'die Birke', 'die Tanne', 'die Palme'],
    },
    {
      category: 'Çiçəklər',
      article: 'die',
      rule: 'Çiçək adları DIE olur.',
      examples: ['die Rose', 'die Tulpe', 'die Blume', 'die Orchidee'],
    },
    {
      category: 'Gəmilər',
      article: 'die',
      rule: 'Gəmi adları DIE olur.',
      examples: ['die Titanic', 'die Costa Concordia'],
    },
    {
      category: 'Motosikletlər',
      article: 'die',
      rule: 'Motosiklet markaları DIE olur.',
      examples: ['die Harley-Davidson', 'die Honda', 'die Yamaha'],
    },
    {
      category: 'Ədədlər isim kimi',
      article: 'die',
      rule: 'Ədədlər isim kimi işləndikdə DIE olur.',
      examples: ['die Eins', 'die Zwei', 'die Drei', 'die Zehn'],
    },
  ],
  exceptions: [
    {
      word: 'das Mädchen',
      article: 'das',
      rule: 'Qız olmasına baxmayaraq DAS olur — -chen qaydası cins mənasından üstündür.',
    },
    {
      word: 'das Fräulein',
      article: 'das',
      rule: 'Qadın olmasına baxmayaraq DAS olur — -lein qaydası cins mənasından üstündür.',
    },
    {
      word: 'das Bier',
      article: 'das',
      rule: 'Alkoqol olmasına baxmayaraq DAS olur — əzbərlənməlidir.',
    },
    {
      word: 'der Käse',
      article: 'der',
      rule: '-e ilə bitir, amma ümumi “-e → die” qaydası burada işləmir; DER olur — əzbərlənməlidir.',
    },
    {
      word: 'das Interesse',
      article: 'das',
      rule: '-e ilə bitir, amma orta cinsdir (DAS) — ümumi “-e → die” qaydasına düşmür.',
    },
    {
      word: 'das Ende',
      article: 'das',
      rule: '-e ilə bitir, amma orta cinsdir (DAS) — əzbərlənməlidir.',
    },
    {
      word: 'das Gebäude',
      article: 'das',
      rule: '-e ilə bitir, amma orta cinsdir (DAS) — əzbərlənməlidir.',
    },
    {
      word: 'die Butter',
      article: 'die',
      rule: '-er ilə bitir; ümumi “-er → der” burada işləmir — DIE olur, əzbərlənməlidir.',
    },
    {
      word: 'das Messer',
      article: 'das',
      rule: '-er ilə bitir; ümumi “-er → der” burada işləmir — DAS olur, əzbərlənməlidir.',
    },
    {
      word: 'das Fenster',
      article: 'das',
      rule: '-er ilə bitir, amma orta cinsdir (DAS) — “-er → der” qaydasına düşmür.',
    },
    {
      word: 'das Zimmer',
      article: 'das',
      rule: '-er ilə bitir, amma orta cinsdir (DAS) — “-er → der” qaydasına düşmür.',
    },
    {
      word: 'das Wetter',
      article: 'das',
      rule: '-er ilə bitir, amma orta cinsdir (DAS) — əzbərlənməlidir.',
    },
    {
      word: 'das Leder',
      article: 'das',
      rule: '-er ilə bitir, amma orta cinsdir (DAS) — əzbərlənməlidir.',
    },
    {
      word: 'das Opfer',
      article: 'das',
      rule: '-er ilə bitir, amma orta cinsdir (DAS) — əzbərlənməlidir.',
    },
    {
      word: 'das Papier',
      article: 'das',
      rule: '-er ilə bitir, amma orta cinsdir (DAS) — “-er → der” qaydasına düşmür.',
    },
    {
      word: 'das Klavier',
      article: 'das',
      rule: '-er ilə bitir, amma orta cinsdir (DAS) — əzbərlənməlidir.',
    },
    {
      word: 'die Feder',
      article: 'die',
      rule: '-er ilə bitir, amma qadın cinsidir (DIE) — “-er → der” qaydasına düşmür.',
    },
    {
      word: 'die Nummer',
      article: 'die',
      rule: '-er ilə bitir, amma qadın cinsidir (DIE) — əzbərlənməlidir.',
    },
    {
      word: 'der See',
      article: 'der',
      rule: 'DER See = göl. DİQQƏT: die See = dəniz. Eyni söz, fərqli artikl, fərqli məna!',
    },
    {
      word: 'die See',
      article: 'die',
      rule: 'DIE See = dəniz. DİQQƏT: der See = göl. Eyni söz, fərqli artikl, fərqli məna!',
    },
    {
      word: 'das Wasser',
      article: 'das',
      rule: 'Su DAS olur — əzbərlənməlidir.',
    },
    {
      word: 'die Mutter',
      article: 'die',
      rule: '-er ilə bitir amma DER deyil, DIE olur — məna üstündür.',
    },
    {
      word: 'die Hand',
      article: 'die',
      rule: 'Əl DIE olur — əzbərlənməlidir.',
    },
    {
      word: 'die Wand',
      article: 'die',
      rule: 'Divar DIE olur — əzbərlənməlidir.',
    },
    {
      word: 'der Band',
      article: 'der',
      rule: 'DER Band = kitab cildi. DİQQƏT: das Band = lent/bağ. Eyni söz, fərqli artikl!',
    },
    {
      word: 'das Band',
      article: 'das',
      rule: 'DAS Band = lent/bağ. DİQQƏT: der Band = kitab cildi. Eyni söz, fərqli artikl!',
    },
    {
      word: 'der Mut',
      article: 'der',
      rule: 'Cəsarət DER olur — əzbərlənməlidir.',
    },
    {
      word: 'das Brot',
      article: 'das',
      rule: 'Çörək DAS olur — əzbərlənməlidir.',
    },
    {
      word: 'die Nacht',
      article: 'die',
      rule: 'Gecə DIE olur — günün vaxtı olsa da DER deyil.',
    },
    {
      word: 'die Mitternacht',
      article: 'die',
      rule: 'Gecə yarısı DIE olur.',
    },
    {
      word: 'das Heft',
      article: 'das',
      rule: 'Dəftər DAS olur — əzbərlənməlidir.',
    },
    {
      word: 'das Gewitter',
      article: 'das',
      rule: 'İldırımlı yağış DAS olur — yağıntı olsa da DER deyil.',
    },
  ],
  abbreviations: [
    {
      token: 'CD',
      article: 'die',
      rule: 'Abreviatura: DIE — köhnə məntiqlə *die (Compact-)Disk* / *die Diskette* istiqamətində.',
    },
    {
      token: 'DVD',
      article: 'die',
      rule: 'Abreviatura: DIE — optik disk/media üçün adətən qadın cinsi artikl işlənir.',
    },
    {
      token: 'BMW',
      article: 'der',
      rule: 'Abreviatura: DER — avtomobil markası; *der Wagen* / nəqliyyat markaları adətən DER.',
    },
    {
      token: 'SMS',
      article: 'die',
      rule: 'Abreviatura: DIE — *die Nachricht* (mesaj) kimi qadın cinsli əsas sözə uyğun gəlir.',
    },
  ],
  techTerms: {
    defaultArticle: 'der',
    defaultRule:
      'Texniki/İT termini: bu qrupda adətən DER işlənir (ingilis mənşəli və ya latın -us ilə bitənlər). İstisna: die Software, die Hardware, das Interface.',
    exceptions: [
      {
        word: 'Software',
        article: 'die',
        rule: 'İT termini: DIE Software — adətən qadın cinsində sabitləşib.',
      },
      {
        word: 'Hardware',
        article: 'die',
        rule: 'İT termini: DIE Hardware — adətən qadın cinsində sabitləşib.',
      },
      {
        word: 'Interface',
        article: 'das',
        rule: 'İT termini: DAS Interface — almanda çox vaxt orta cins kimi işlənir.',
      },
    ],
    list: ['Blog', 'Server', 'Browser', 'Algorithmus'],
  },
  gadgets: {
    neutral: ['Handy', 'Tablet', 'Laptop', 'Smartphone'],
    masculine: ['Computer', 'Fernseher', 'Toaster'],
    ruleDas:
      'Qadjet/ingilis mənşəli texnika: bu siyahıda -er ilə bitməyənlər adətən DAS (orta cins), məs. das Handy, das Tablet.',
    ruleDer:
      'Qadjet: -er ilə bitənlər bu qrupda DER olur (məs. der Computer, der Fernseher, der Toaster).',
  },
  drinks: {
    feminine: ['Cola', 'Limo', 'Milch'],
    masculine: ['Kaffee', 'Tee', 'Saft', 'Wein'],
    neutral: ['Wasser', 'Bier'],
    ruleDie:
      'İçki (siyahı): bu qruplarda adətən DIE — məs. die Cola, die Limo, die Milch.',
    ruleDer:
      'İçki (siyahı): qəhvə, çay, şirə və şərab adətən DER — məs. der Kaffee, der Tee, der Saft, der Wein.',
    ruleDas:
      'İçki (siyahı): su və pivə DAS olur — das Wasser, das Bier (leksikonda başqa cins göstərilərsə leksikona uyğun əzbərlə).',
  },
  timeRules: {
    daysOfWeek: [
      'Montag',
      'Dienstag',
      'Mittwoch',
      'Donnerstag',
      'Freitag',
      'Samstag',
      'Sonntag',
    ],
    months: [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember',
    ],
    seasons: ['Frühling', 'Sommer', 'Herbst', 'Winter'],
    ruleDer:
      'Vaxt (siyahı): həftənin hər günü (der Montag, der Dienstag …), aylar və fəsillər almanda kişi cinsindədir (DER) — məs. der Montag, der Januar, der Frühling.',
  },
  feminineEr: {
    words: ['Nummer', 'Mutter', 'Butter', 'Feier', 'Leiter'],
    rule:
      '-er ilə bitən sözlərin çoxu DER olsa da, bu sözlər qadın cinsidir (DIE) — əzbərlə. DİQQƏT: Leiter = die Leiter (nərdivan) / der Leiter (rəhbər).',
  },
};
