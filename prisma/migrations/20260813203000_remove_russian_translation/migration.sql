UPDATE "Chat"
SET "translationLanguage" = NULL
WHERE LOWER(REPLACE(COALESCE("translationLanguage", ''), '_', '-')) IN (
  'russian',
  'русский',
  'русский язык',
  'ru',
  'ru-ru'
);
