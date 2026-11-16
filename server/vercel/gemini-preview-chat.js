import { admitSameSiteRequest } from '../../src/localRequestGate.mjs';
import { createGeminiChatHandler } from '../providers/gemini/chat.js';

export function createGeminiPreviewChat(env = process.env, options = {}) {
  return createGeminiChatHandler({
    ...options,
    resolveApiKey: () => env.GEMINI_API_KEY,
    resolveChatModel: () => env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash-lite',
    overpassConfigured: () => false,
    admitOrigin(req) {
      const host = req.headers?.host;
      const origin = req.headers?.origin;
      // Set the production host only after Vercel Authentication protects
      // All Deployments, including that domain.
      const allowedHosts =
        env.VERCEL_ENV === 'preview'
          ? [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
          : env.VERCEL_ENV === 'production'
            ? [env.GEMINI_PRODUCTION_HOST]
            : [];
      if (
        !host?.endsWith('.vercel.app') ||
        !allowedHosts.includes(host) ||
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
