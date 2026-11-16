import { admitSameSiteRequest } from '../../src/localRequestGate.mjs';
import { createGeminiChatHandler } from '../providers/gemini/chat.js';

export function createGeminiPreviewChat(env = process.env, options = {}) {
  return createGeminiChatHandler({
    ...options,
    resolveApiKey: () => env.GEMINI_API_KEY,
    resolveChatModel: () => env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash-lite',
    overpassConfigured: () => false,
    admitOrigin(req) {
      // Only deployment URLs covered by the project's Preview protection.
      if (env.VERCEL_ENV !== 'preview') return false;
      const host = req.headers?.host;
      const origin = req.headers?.origin;
      if (
        !host?.endsWith('.vercel.app') ||
        ![env.VERCEL_URL, env.VERCEL_BRANCH_URL].includes(host) ||
        !origin
      )
        return false;
      return admitSameSiteRequest({
        hostHeader: host,
        protocol: 'https:',
        origin,
        secFetchSite: req.headers['sec-fetch-site'],
      }).ok;
    },
  });
}

export const geminiPreviewChat = createGeminiPreviewChat();
