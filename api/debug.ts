import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = {
    method: req.method,
    headers: req.headers,
    body: req.body,
    ts: Date.now(),
  };
  // Salva último payload para inspeção
  await kv.set("debug:last_webhook", payload, { ex: 3600 });
  return res.status(200).json(payload);
}
