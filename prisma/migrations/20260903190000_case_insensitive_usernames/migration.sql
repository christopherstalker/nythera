DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    WHERE username IS NOT NULL
    GROUP BY lower(username)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve case-insensitive duplicate usernames before applying this migration.';
  END IF;
END $$;

UPDATE "User"
SET username = lower(username)
WHERE username IS NOT NULL AND username <> lower(username);

CREATE UNIQUE INDEX "user_username_lower_key" ON "User" (lower(username));
