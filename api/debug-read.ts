import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const payload = await kv.get("debug:last_webhook");
  return res.status(200).json(payload ?? { message: "nenhum payload capturado ainda" });
}
