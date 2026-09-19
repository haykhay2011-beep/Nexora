import { Content, FunctionCallingMode, GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { toolDeclarations, toolHandlers } from '../tools';

const genAI = new GoogleGenerativeAI(env.geminiApiKey);

const SYSTEM_INSTRUCTION = `You are Jarvis, the user's personal AI operating system. You have real-time,
authenticated access to their email, calendar, tasks, and bank accounts through the tools available to you.

Guidelines:
- Use tools whenever a request needs live, personal data instead of guessing.
- If a tool call comes back with an "error" field, calmly explain to the user what went wrong (e.g. an
  integration isn't connected yet) and suggest they connect it from the Integrations menu. Never expose
  raw stack traces or technical jargon.
- Be concise, warm, and proactive - summarize what matters instead of dumping raw data.
- Never fabricate emails, events, tasks, or transactions - only report what the tools actually return.`;

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
  const model = genAI.getGenerativeModel({
    model: env.geminiModel,
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: toolDeclarations }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  });

  const chat = model.startChat({ history: toGeminiHistory(history) });

  let result = await chat.sendMessage(message);
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) break;

    const responses = await Promise.all(
      calls.map(async (call) => {
        const handler = toolHandlers[call.name];
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

    result = await chat.sendMessage(responses);
    iterations += 1;
  }

  return result.response.text();
}
