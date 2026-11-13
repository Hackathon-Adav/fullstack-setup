type Question = {
  id: number;
  question: string;
  answer: string;
  created_at?: string;
};

const API = '/api';

const status = document.querySelector<HTMLParagraphElement>('#status')!;
const form = document.querySelector<HTMLFormElement>('#ask-form')!;
const input = document.querySelector<HTMLInputElement>('#question')!;
const list = document.querySelector<HTMLUListElement>('#questions')!;

async function refreshHealth(): Promise<void> {
  try {
    const res = await fetch(`${API}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { db: string };
    status.textContent = `API OK · ${data.db}`;
  } catch (err) {
    status.textContent = `API indisponible : ${(err as Error).message}`;
  }
}

async function refreshQuestions(): Promise<void> {
  const res = await fetch(`${API}/questions`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const questions = (await res.json()) as Question[];

  list.innerHTML = '';
  for (const q of questions) {
    const li = document.createElement('li');
    const questionEl = document.createElement('strong');
    questionEl.textContent = `Q : ${q.question}`;
    const answerEl = document.createElement('em');
    answerEl.textContent = `R : ${q.answer}`;
    li.append(questionEl, document.createElement('br'), answerEl);
    list.appendChild(li);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) return;

  input.disabled = true;
  const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  submit.disabled = true;
  const previousStatus = status.textContent;
  status.textContent = 'Interrogation de l’IA…';

  try {
    const res = await fetch(`${API}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) throw new Error(await res.text());

    input.value = '';
    status.textContent = previousStatus ?? '';
    await refreshQuestions();
  } catch (err) {
    status.textContent = `Échec : ${(err as Error).message}`;
  } finally {
    input.disabled = false;
    submit.disabled = false;
    input.focus();
  }
});

void refreshHealth();
void refreshQuestions();