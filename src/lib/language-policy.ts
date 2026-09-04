const RUSSIAN_STRONG_WORDS = new Set([
  "благодарю",
  "давайте",
  "здравствуй",
  "здравствуйте",
  "извините",
  "которого",
  "которой",
  "которые",
  "который",
  "нельзя",
  "меня",
  "него",
  "неё",
  "пожалуйста",
  "почему",
  "привет",
  "русская",
  "русский",
  "русского",
  "русском",
  "сейчас",
  "спасибо",
  "тебя",
  "что",
  "человек",
  "это"
]);

const RUSSIAN_WORDS = new Set([
  "был",
  "была",
  "были",
  "будет",
  "вас",
  "вам",
  "ваш",
  "ведь",
  "вот",
  "время",
  "всегда",
  "где",
  "говорит",
  "говорить",
  "говорю",
  "давай",
  "дела",
  "делает",
  "должен",
  "должна",
  "если",
  "ещё",
  "здесь",
  "знает",
  "как",
  "когда",
  "конечно",
  "любовь",
  "меня",
  "может",
  "можно",
  "мой",
  "надо",
  "наша",
  "наше",
  "наши",
  "наш",
  "него",
  "неё",
  "никогда",
  "ничего",
  "нужно",
  "очень",
  "персонаж",
  "пишу",
  "плохо",
  "потому",
  "просто",
  "русски",
  "сказал",
  "сказала",
  "смотрит",
  "свой",
  "себя",
  "тебя",
  "тогда",
  "тоже",
  "только",
  "твой",
  "хорошо",
  "хотел",
  "хотела",
  "хочешь",
  "чтобы",
  "что",
  "эта",
  "эти",
  "это",
  "этот"
]);

const UKRAINIAN_WORDS = new Set([
  "будь",
  "відповідає",
  "вона",
  "він",
  "вже",
  "говорить",
  "дякую",
  "дуже",
  "зараз",
  "звісно",
  "його",
  "коли",
  "людина",
  "мене",
  "можна",
  "потрібно",
  "привіт",
  "сказав",
  "сказала",
  "справи",
  "тебе",
  "треба",
  "тут",
  "хочеш",
  "чому",
  "щоб",
  "яка",
  "який",
  "які"
]);

const OTHER_CYRILLIC_MARKERS = /[ўђјљњћџѓќѕәғқңөұүһҗҫҙқ]/iu;

export const RUSSIAN_LANGUAGE_ERROR =
  "Russian-language content is not supported on Nythera. Use another language.";

export const RUSSIAN_CHARACTER_PUBLICATION_ERROR =
  "Characters written in Russian cannot be published. Rewrite the character in another language.";

export function containsRussianLanguage(value: string) {
  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replace(/https?:\/\/\S+/g, " ");
  const cyrillicLetters = normalized.match(/\p{Script=Cyrillic}/gu) ?? [];
  if (cyrillicLetters.length < 2) {
    return false;
  }

  const words = normalized.match(/[\p{L}ё]+/gu) ?? [];
  let russianScore = 0;
  let ukrainianScore = 0;

  for (const word of words) {
    if (RUSSIAN_STRONG_WORDS.has(word)) russianScore += 4;
    if (RUSSIAN_WORDS.has(word)) russianScore += 1.5;
    if (UKRAINIAN_WORDS.has(word)) ukrainianScore += 2;
  }

  if (normalized.includes("по-русски") || normalized.includes("по русски")) russianScore += 6;
  if (/как\s+дела/u.test(normalized)) russianScore += 4;
  if (/я\s+(?:говорю|пишу|отвечаю)/u.test(normalized)) russianScore += 2;

  const russianLetters = normalized.match(/[ёыэ]/g)?.length ?? 0;
  const ukrainianLetters = normalized.match(/[іїєґ]/g)?.length ?? 0;
  russianScore += Math.min(russianLetters * 1.25, 8);
  ukrainianScore += Math.min(ukrainianLetters * 2.5, 12);

  if (OTHER_CYRILLIC_MARKERS.test(normalized)) {
    ukrainianScore += 5;
  }

  if (russianScore >= 4 && russianScore > ukrainianScore * 1.35) {
    return true;
  }

  if (cyrillicLetters.length >= 40 && russianScore >= 3 && russianScore > ukrainianScore * 1.6) {
    return true;
  }

  return false;
}

export function isRussianLanguageLabel(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLocaleLowerCase("und").replaceAll("_", "-");
  return normalized === "russian" || normalized === "русский" || normalized === "русский язык" || normalized === "ru" || normalized === "ru-ru";
}
