-- Exécuté une seule fois, au premier démarrage (db/data vide).
-- La base "app" est créée par POSTGRES_DB=app, on ne la crée pas ici.

CREATE TABLE IF NOT EXISTS questions (
  id          SERIAL PRIMARY KEY,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);