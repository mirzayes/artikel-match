/** Alman sözü (artiklsuz lemma) → maraqlı fakt (Az). CSV-dəki `word` ilə uyğunlaşır. */
export const ARTICLE_FACTS: Record<string, string> = {
  Fisch:
    'Almaniyanın şimalında Kuzey Dənizi balıqçılığı — ölkənin ən qədim sənaye sahələrindən biridir.',
  Wasser:
    'Almanlar ildə 86 litr mineral su içir — dünyadakı ən yüksək göstəricilərdən biri.',
  Schule:
    'Alman şagirdlər 4 ildən sonra ya Gymnasium, ya da Hauptschule-yə yönləndirilir.',
  Buch: 'Almaniya ildə 90 000-dən çox yeni kitab nəşr edir — Avropada ən çox.',
  Hund: 'Almaniyada iti olan hər nəfər ildə 100-150€ it vergisi ödəyir.',
  Tür: 'Alman evlərinin qapısı adətən içəriyə açılır — yanğın zamanı evakuasiya üçün vacibdir.',
  Kind:
    'Almaniyada uşaq bağçası (Kindergarten) sözü dünyanın 30-dan çox dilinə keçib.',
  Zug: 'Deutsche Bahn Avropanın ikinci böyük dəmir yolu şəbəkəsidir — 33 000 km.',
  Stadt:
    'Almaniyada 80-dən çox şəhər var ki, hər birinin əhalisi 100 000-dən çoxdur.',
  Haus:
    'Almaniyada ev sahibliyinin faizi yalnız 49% — Avropada ən aşağı göstəricilərdən biri.',
  Baum: 'Almaniyada hər ağacın hüquqi statusu var — icazəsiz kəsmək qanunsuzdur.',
  Küche:
    'Alman mətbəxi dünyada 5000-dən çox müxtəlif çörək növünə malikdir.',
  Kaffee:
    'Almanlar ildə 162 litr qəhvə içir — içdikləri sudan da çox.',
  Bier: 'Almaniyanın Bayern ştatında 1487-ci ildən bəri pivə yalnız su, arpa və şerbetçiotu ilə hazırlanır.',
  Brot:
    'Almaniyada 3200-dən çox müxtəlif çörək növü var — UNESCO qeyri-maddi miras siyahısındadır.',
  Auto:
    'Almaniya hər il 4 milyondan çox avtomobil istehsal edir — Avropada ən çox.',
  Musik:
    'Almaniyada 130-dan çox professional simfonik orkestr var — dünyanın ən çoxu.',
  Geld:
    'Frankfurt Avropanın maliyyə mərkəzidir — burada Avropa Mərkəzi Bankı yerləşir.',
  Zeit:
    'Almaniyanın Die Zeit qəzeti 1946-cı ildən nəşr olunur — ən nüfuzlu həftəlik nəşrdir.',
  Wetter:
    'Berlin ildə orta hesabla 1626 saat günəş işığı alır — Bakı ilə müqayisədə 2 dəfə az.',
  Bahnhof:
    'Berlin Hauptbahnhof Avropanın ən böyük dəmiryolu vağzalıdır — 5 mərtəbəlidir.',
  Universität:
    'Heidelberg Universiteti 1386-cı ildə açılıb — Almaniyanın ən qədim universitetidir.',
  Krankenhaus:
    'Almaniyada tibbi sığorta məcburidir — hər işçi maaşının 14%-ni ödəyir.',
  Polizei:
    'Alman polisi dünyada ən az silah işlədən xidmətlərdən biridir.',
  Supermarkt:
    'Almaniyada 15 000-dən çox Aldi mağazası var — qiymətlər digər ölkələrə nisbətən aşağıdır.',
  Reise:
    'Almanlar dünyanın ən çox səyahət edən millətlərindən biridir — ildə orta 14 gün.',
  Flugzeug:
    'Frankfurt hava limanı Avropanın üçüncü ən böyük aeroportudur.',
  Schmerz:
    'Almaniyanın dərman sənayesi dünyada ən böyük 3-cü sənayedir.',
  Kirche:
    'Bazar günü Almaniyada hay-küy etmək, çəmən biçmək qanunen qadağandır.',
  Park: 'Münhen şəhər mərkəzindəki English Garden, New York Central Parkından böyükdür.',
  Fluss:
    'Reyn çayı Almaniyadan keçən ən mühüm ticarət yoludur — 1230 km uzunluğundadır.',
  Wald:
    'Almaniyanın 32%-i meşədir — hər il 100 milyon yeni ağac əkilir.',
  Geschichte:
    'Almaniya 1990-cı ildə birləşdi — Berlin divarı 28 il, 91 gün ayaqda durdu.',
  Koffer:
    'Almanlar ən çox səyahət edən avropalılardır — hər il 70 milyondan çox xarici səfər.',
  Hotel:
    'Almaniyada 35 000-dən çox otel var — turizm ölkənin ən böyük sənayələrindən biridir.',
  Karte:
    'Almaniyada hələ də əhalinin 80%-i gündəlik ödənişdə nəğd pul işlədir.',
  Tee: 'Almanların 70%-i gündə ən azı bir stəkan çay içir.',
  Computer:
    'Almaniya dünyada ən çox kompüter mühəndisi hazırlayan ölkələr sırasındadır.',
  Internet:
    'Almaniya Avropa İnternetinin 30%-ni idarə edən ən böyük data mərkəzlərinə malikdir.',
  Handy:
    'Almaniyanın ilk mobil telefon şəbəkəsi 1958-ci ildə işə düşüb.',
  Apotheke:
    'Almaniyada apteklər mağazalarda dərman satışını tamamilə bloklayıb.',
  Miete:
    'Berlində icarə qiyməti son 10 ildə 3 dəfə artıb — şəhər icarə limitləri tətbiq etdi.',
  Arbeit:
    'Almaniyada işsizlik 2024-cü ildə 5.5% idi — Avropanın ən aşağı göstəricilərindən.',
  Garten:
    'Almanların 17 milyonu şəhər kənarında kiçik bağ icarəyə götürür — Schrebergarten.',
  Hochzeit:
    'Alman toylarında gəlin və bəyin dostları gecə yarısı ev əşyalarını qırır — Polterabend adəti.',
  Hals:
    'Almaniyanın ən böyük ÜMD-si Avropada birinci, dünyada dördüncüdür.',
  Kühlschrank:
    'Almaniyada soyuducular enerji siniflərinə görə satılır — A+++ ən yaxşısıdır.',
  Straße:
    'Almaniyanın Autobahn şəbəkəsi 13 000 km-dir — 30%-də sürət limiti yoxdur.',
  Zahn:
    'Almaniyada diş həkimi xərcləri tibbi sığorta tərəfindən qismən ödənilir.',
  Dorf:
    'Almaniyada 11 000-dən çox kənd var — ölkə əhalisinin 25%-i kənddə yaşayır.',
  Zoo: 'Berlin Zoosu dünyanın ən çox heyvan növünə malik zooparkıdır — 20 000 heyvan.',
  Museum:
    'Berlinin Muzey Adası UNESCO Dünya İrsi siyahısındadır — 5 muzey bir yerdə.',
  Sport:
    'Almaniya dünya çempionatını 4 dəfə qazanıb — 1954, 1974, 1990, 2014.',
  Fußball:
    'Bundesliga Avropanın ən çox tamaşaçı cəlb edən futbol liqasıdır.',
  Fahrrad:
    'Almaniyada 84 milyon insan üçün 78 milyon velosiped var.',
  Bauch:
    'Oktoberfest hər il 7 milyon litrə yaxın pivə satır — 6 milyon qonaq gəlir.',
  Brücke:
    'Almaniyada 39 000-dən çox körpü var — 1 200-ü tarixi abidədir.',
  Strand:
    'Almaniyada dənizə girişin hamısı pulsuzdur — çimərlik qanunla ictimai əmlakdır.',
  Regen:
    'Hamburg Almaniyada ən çox yağıntı alan şəhərdir — ildə 770 mm.',
  Schnee:
    'Bayern Alplarında qar örtüyü ildə 200 günə qədər davam edə bilər.',
  Sonne:
    'Almaniyanın cənubu ildə 1800 saat günəş alır — şimalı isə cəmi 1400 saat.',
  Wind:
    'Almaniya Avropada ən çox külək enerjisi istehsal edən ölkədir — 28 000 turbina.',
  Wolke:
    'Almaniyada bulud örtüyü illik ortalama 60% təşkil edir.',
  Schiff:
    'Hamburg limanı Avropanın üçüncü ən böyük limanıdır — ildə 9 milyon konteyner.',
  Saft:
    'Alman alma şirəsi dünyada ən məşhur meyvə şirəsi ixracatçılarından biridir.',
  Salat:
    'Alman salatlarında sirkə-yağ sousu üstünlük təşkil edir — mayonez az işlənir.',
  Kuchen:
    'Almaniyada 500-dən çox müxtəlif tort və keks növü mövcuddur.',
  Käse:
    'Almaniya ildə 2 milyon ton pendir istehsal edir — Avropa liderlərindəndir.',
  Fleisch:
    'Almaniyada ildə hər nəfərə 52 kq ət düşür — Avropada ən yüksəklərdən biri.',
};

export function getArticleFact(word: string): string | null {
  const direct = ARTICLE_FACTS[word];
  if (direct) return direct;
  return null;
}
