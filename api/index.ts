// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json).
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server/app.js";

const ready = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const { app } = await ready;
  app(req as any, res as any);
}
