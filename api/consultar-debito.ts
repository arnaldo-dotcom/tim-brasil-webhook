import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClienteByCpf, getClienteByPhone } from "./_db";
import { perfil, DESCONTO_AVISTA_PCT, PARCELAS_MAX } from "./_perfil";

// Moveo lê variáveis de sessão via body.context.{var} e espera a resposta no formato {"context": {...}}
function ok(res: VercelResponse, vars: Record<string, unknown>) {
  return res.status(200).json({ context: vars });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body ?? {};
    const ctx = body.context ?? body.variables ?? body ?? {};

    // Moveo envia variáveis de sessão em body.context
    const cpfRaw = ctx.cpf ?? ctx.user?.cpf ?? null;
    const phoneRaw = ctx.phone ?? ctx.user?.phone ?? null;

    const cpf = cpfRaw ? String(cpfRaw).replace(/\D/g, "") || null : null;
    const phone = phoneRaw ? String(phoneRaw).replace(/\D/g, "") || null : null;

    // 1. Busca no KV (CRM simulado)
    let cliente = null;
    try {
      if (cpf) cliente = await getClienteByCpf(cpf);
      if (!cliente && phone) cliente = await getClienteByPhone(phone);
    } catch {
      // KV indisponível — cai no fallback hash
    }

    if (cliente) {
      const faturas = cliente.faturas.filter((f) => f.status === "aberto");
      const total = Math.round(faturas.reduce((s, f) => s + f.valor, 0) * 100) / 100;
      const valorAvista = Math.round(total * (1 - DESCONTO_AVISTA_PCT / 100) * 100) / 100;
      const valorParcela = Math.round((total * 1.1) / PARCELAS_MAX * 100) / 100;
      return ok(res, {
        nome: cliente.nome,
        total,
        desconto_pct: DESCONTO_AVISTA_PCT,
        valor_avista: valorAvista,
        parcelas_max: PARCELAS_MAX,
        valor_parcela: valorParcela,
        num_faturas: faturas.length,
      });
    }

    // 2. Fallback hash determinístico para CPF desconhecido
    const cpfFallback = cpf || "00000000000";
    const { nome, nFaturas, valorFatura } = perfil(cpfFallback);
    const total = Math.round(nFaturas * valorFatura * 100) / 100;
    const valorAvista = Math.round(total * (1 - DESCONTO_AVISTA_PCT / 100) * 100) / 100;
    const valorParcela = Math.round((total * 1.1) / PARCELAS_MAX * 100) / 100;
    return ok(res, {
      nome,
      total,
      desconto_pct: DESCONTO_AVISTA_PCT,
      valor_avista: valorAvista,
      parcelas_max: PARCELAS_MAX,
      valor_parcela: valorParcela,
      num_faturas: nFaturas,
    });
  } catch (err) {
    console.error("[consultar-debito] unhandled error:", err);
    return res.status(200).json({ context: { nome: "Cliente", total: 0, num_faturas: 0 } });
  }
}
