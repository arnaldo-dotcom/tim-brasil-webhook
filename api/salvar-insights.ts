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

    // Propensão explícita do insight de IA, ou inferida pelo resultado da conversa
    let propensao: number | undefined;
    if (ctx.intencao_de_pagar != null) {
      propensao = Math.min(10, Math.max(0, parseInt(String(ctx.intencao_de_pagar), 10)));
    } else if (ctx.acordo_id) {
      propensao = 9; // fechou acordo
    } else if (ctx.num_faturas != null && parseInt(String(ctx.num_faturas), 10) > 0) {
      propensao = 4; // tinha débito mas não fechou
    } else {
      propensao = 2; // sem débito ou não engajou
    }

    cliente.propensao = propensao;
    if (ctx.perfil_psicologico) cliente.perfil_psicologico = String(ctx.perfil_psicologico);
    if (ctx.resumo_da_sessao) cliente.resumo_sessao = String(ctx.resumo_da_sessao);

    await saveCliente(cliente);

    return res.status(200).json({ context: {} });
  } catch (err) {
    console.error("[salvar-insights] error:", err);
    return res.status(200).json({ context: {} });
  }
}
