import { Content, FunctionCallingConfigMode, GoogleGenAI, Part } from '@google/genai';
import { env } from '../config/env';
import { toolDeclarations, toolHandlers } from '../tools';

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

const SYSTEM_INSTRUCTION = `You are Jarvis, the user's personal AI operating system. You have real-time,
authenticated access to their email, calendar, tasks, and bank accounts through the tools available to you.

Guidelines:
- Use tools whenever a request needs live, personal data instead of guessing.
- If a tool call comes back with an "error" field, calmly explain to the user what went wrong (e.g. an
  integration isn't connected yet) and suggest they connect it from the Integrations menu. Never expose
  raw stack traces or technical jargon.
- Be concise, warm, and proactive - summarize what matters instead of dumping raw data.
- Never fabricate emails, events, tasks, or transactions - only report what the tools actually return.
- sendEmail is irreversible - always confirm the recipient, subject, and body with the user in plain
  language before calling it. draftReply is safe to use without confirmation since it only saves a draft.
- When the user mentions something to remember or be reminded about later, use createReminder with a
  concrete ISO datetime (resolve relative phrases like "tomorrow" or "in an hour" against the current time).`;

const MAX_TOOL_ITERATIONS = 6;

export interface ChatTurn {
  role: 'user' | 'model';
  content: string;
}

function toGeminiHistory(turns: ChatTurn[]): Content[] {
  return turns.map((t) => ({
    role: t.role,
    parts: [{ text: t.content }],
  }));
}

/**
 * Runs one user message through Gemini, executing any tool calls it requests
 * (scoped to `userId`) until it produces a final text answer.
 */
export async function runChatTurn(userId: string, message: string, history: ChatTurn[] = []): Promise<string> {
  const chat = genAI.chats.create({
    model: env.geminiModel,
    history: toGeminiHistory(history),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: toolDeclarations }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
    },
  });

  let result = await chat.sendMessage({ message });
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    const calls = result.functionCalls;
    if (!calls || calls.length === 0) break;

    const responseParts: Part[] = await Promise.all(
      calls.map(async (call) => {
        const handler = call.name ? toolHandlers[call.name] : undefined;
        let outputText: string;

        if (!handler) {
          outputText = JSON.stringify({ error: `Unknown tool: ${call.name}` });
        } else {
          try {
            outputText = await handler(userId, call.args);
          } catch (err: any) {
            // Tools already catch and stringify their own errors; this is a
            // last-resort net so a crashing handler never takes the server down.
            outputText = JSON.stringify({ error: err?.message ?? `${call.name} failed unexpectedly.` });
          }
        }

        return {
          functionResponse: {
            name: call.name,
            response: { result: outputText },
          },
        };
      })
    );

    result = await chat.sendMessage({ message: responseParts });
    iterations += 1;
  }

  return result.text ?? '';
}

/**
 * One-shot audio transcription for the mobile app's voice input button -
 * unrelated to any chat history, just "what did they say".
 */
export async function transcribeAudio(base64Audio: string, mimeType: string): Promise<string> {
  const result = await genAI.models.generateContent({
    model: env.geminiModel,
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Transcribe this audio verbatim. Reply with only the transcribed text, no commentary.' },
          { inlineData: { mimeType, data: base64Audio } },
        ],
      },
    ],
  });

  return (result.text ?? '').trim();
}
