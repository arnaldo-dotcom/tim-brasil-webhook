import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClienteByCpf, saveCliente } from "./_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body ?? {};
    const ctx = body.context ?? body.variables ?? body ?? {};

    const cpfRaw = ctx.cpf ?? ctx.user?.cpf ?? null;
    if (!cpfRaw) return res.status(200).json({ context: {} });

    const cpf = String(cpfRaw).replace(/\D/g, "");
    const cliente = await getClienteByCpf(cpf);
    if (!cliente) return res.status(200).json({ context: {} });

    const propensao = ctx.intencao_de_pagar != null
      ? Math.min(10, Math.max(0, parseInt(String(ctx.intencao_de_pagar), 10)))
      : undefined;

    if (propensao !== undefined) cliente.propensao = propensao;
    if (ctx.perfil_psicologico) cliente.perfil_psicologico = String(ctx.perfil_psicologico);
    if (ctx.resumo_da_sessao) cliente.resumo_sessao = String(ctx.resumo_da_sessao);

    await saveCliente(cliente);

    return res.status(200).json({ context: {} });
  } catch (err) {
    console.error("[salvar-insights] error:", err);
    return res.status(200).json({ context: {} });
  }
}
