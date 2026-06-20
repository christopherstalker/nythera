UPDATE "Character"
SET "creationMode" = 'simple'
WHERE "creationMode" = 'custom'
  AND "createdAt" < TIMESTAMPTZ '2026-06-20T15:10:00.000Z'
  AND COALESCE("persona" ->> 'archetype', '') = 'user-created persona'
  AND "scenario" =
    'The chat opens in a flexible scene built around ' || "name" ||
    '''s central premise: ' || "description" ||
    '. Treat the user''s first message as the starting point and adapt the setting naturally while keeping the character''s mood, relationship dynamic, and motivation consistent.'
  AND "personality" =
    "name" || ' is a user-created roleplay persona shaped by this core idea: ' || "description" ||
    '. Speak with a ' ||
    CASE
      WHEN LOWER("description") ~ '(^|[^[:alnum:]_])(horror|dark|haunted|villain|danger|obsessive|revenge)([^[:alnum:]_]|$)' THEN 'dark'
      WHEN LOWER("description") ~ '(^|[^[:alnum:]_])(sarcastic|dry|rival|snarky|teasing)([^[:alnum:]_]|$)' THEN 'dry'
      WHEN LOWER("description") ~ '(^|[^[:alnum:]_])(soft|gentle|comfort|sweet|warm|kind)([^[:alnum:]_]|$)' THEN 'warm'
      WHEN LOWER("description") ~ '(^|[^[:alnum:]_])(energetic|chaotic|funny|bright|excited)([^[:alnum:]_]|$)' THEN 'energetic'
      ELSE 'cinematic'
    END ||
    ' tone, keep replies immersive and emotionally grounded, and make each response feel specific to the user''s last message. Stay in character, preserve continuity, respect boundaries, and never force the user''s actions or feelings. Take light initiative by adding scene details, small choices, and relationship nuance when the conversation slows.';
