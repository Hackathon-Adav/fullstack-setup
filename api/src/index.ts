import express from 'express';
import pg from 'pg';
import { existsSync } from 'node:fs';

// Charge api/.env quel que soit le répertoire de lancement.
// - cwd = /workspace/api  → '.env' existe
// - cwd = /workspace      → 'api/.env' existe
const envPath = ['api/.env', '.env'].find(existsSync);
if (envPath) process.loadEnvFile(envPath);

const {
  DATABASE_URL,
  AI_BASE_URL = 'http://host.docker.internal:11434/v1',
  AI_MODEL = 'llama3.2:1b',
  AI_API_KEY = '',
} = process.env;

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL manquante. Vérifiez api/.env (cf. api/.env.example).',
  );
}

const PORT = Number(process.env.PORT ?? 3000);
const db = new pg.Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT version()');
    res.json({ status: 'ok', db: rows[0].version });
  } catch (err) {
    console.error('[health]', err);
    res.status(500).json({ status: 'error', error: (err as Error).message });
  }
});

app.get('/api/questions', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM questions ORDER BY id DESC LIMIT 10',
    );
    res.json(rows);
  } catch (err) {
    console.error('[questions:list]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/questions', async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) {
    res.status(400).json({ error: 'Question manquante' });
    return;
  }
  try {
    const answer = await ask(question);
    const { rows } = await db.query(
      'INSERT INTO questions (question, answer) VALUES ($1, $2) RETURNING *',
      [question, answer],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[questions:create]', err);
    res.status(502).json({ error: (err as Error).message });
  }
});

async function ask(question: string): Promise<string> {
  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: question }],
    }),
  });
  if (!response.ok) {
    throw new Error(`IA : ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0].message.content;
}

app.listen(PORT, () => console.log(`API sur http://localhost:${PORT}`));
