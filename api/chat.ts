// Vercel Function: POST /api/chat (Web standard Request/Response, Node.js runtime).
import { handleChatRequest } from "../src/server/chat-handler.js";
import { getChatOptions } from "../src/server/context.js";

export function POST(request: Request): Promise<Response> {
  return handleChatRequest(request, getChatOptions());
}

export function OPTIONS(request: Request): Promise<Response> {
  return handleChatRequest(request, getChatOptions());
}
