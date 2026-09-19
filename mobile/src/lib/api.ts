import { supabase } from './supabase';
import { API_BASE_URL } from './config';

export interface ChatTurn {
  role: 'user' | 'model';
  content: string;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You need to be signed in.');
  return token;
}

/**
 * The Gemini tool-calling loop (plus IMAP round trips for Yahoo) can take
 * well over the platform's default fetch timeout, so we give it a generous
 * 90s AbortController budget - iOS will otherwise kill the socket early.
 */
export async function sendChatMessage(message: string, history: ChatTurn[]): Promise<string> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, history }),
      signal: controller.signal,
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? 'The assistant could not respond right now.');
    }
    return json.reply as string;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('That took too long to respond. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchChatHistory(): Promise<ChatTurn[]> {
  const res = await authorizedFetch<{ messages: (ChatTurn & { created_at: string })[] }>('/chat/history');
  return res.messages;
}

export async function authorizedFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error ?? 'Request failed.');
  }
  return json as T;
}

export { getAccessToken };
