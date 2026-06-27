import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClienteByCpf, getClienteByPhone } from "./_db";
import { perfil, DESCONTO_AVISTA_PCT, PARCELAS_MAX } from "./_perfil";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { cpf, phone } = req.body ?? {};

  // 1. Tenta buscar no KV (CRM simulado)
  let cliente = cpf ? await getClienteByCpf(String(cpf)) : null;
  if (!cliente && phone) cliente = await getClienteByPhone(String(phone));

  if (cliente) {
    const faturas = cliente.faturas.filter((f) => f.status === "aberto");
    if (!faturas.length) {
      return res.status(200).json({ nome: cliente.nome, total: 0, faturas: [], ofertas: [] });
    }
    const total = Math.round(faturas.reduce((s, f) => s + f.valor, 0) * 100) / 100;
    const valorAvista = Math.round(total * (1 - DESCONTO_AVISTA_PCT / 100) * 100) / 100;
    const valorParcela = Math.round((total * 1.1) / PARCELAS_MAX * 100) / 100;

    return res.status(200).json({
      nome: cliente.nome,
      total,
      faturas,
      ofertas: [
        { tipo: "a_vista", desconto_pct: DESCONTO_AVISTA_PCT, valor_final: valorAvista },
        { tipo: "parcelado", parcelas_max: PARCELAS_MAX, valor_parcela: valorParcela, total: Math.round(valorParcela * PARCELAS_MAX * 100) / 100 },
      ],
    });
  }

  // 2. Fallback: mock determinístico por hash (dev / CPF desconhecido)
  if (!cpf) return res.status(400).json({ error: "cpf ou phone obrigatório" });

  const { nome, nFaturas, valorFatura } = perfil(String(cpf));
  const COMPETENCIAS: [string, number][] = [["abr/2026", 58], ["mai/2026", 27]];
  const faturas = COMPETENCIAS.slice(0, nFaturas).map(([comp, dias], i) => ({
    id: `F-2026-${(4 + i).toString().padStart(2, "0")}`,
    competencia: comp,
    valor: valorFatura,
    dias_atraso: dias,
    status: "aberto" as const,
  }));
  const total = Math.round(faturas.reduce((s, f) => s + f.valor, 0) * 100) / 100;
  const valorAvista = Math.round(total * (1 - DESCONTO_AVISTA_PCT / 100) * 100) / 100;
  const valorParcela = Math.round((total * 1.1) / PARCELAS_MAX * 100) / 100;

  return res.status(200).json({
    nome,
    total,
    faturas,
    ofertas: [
      { tipo: "a_vista", desconto_pct: DESCONTO_AVISTA_PCT, valor_final: valorAvista },
      { tipo: "parcelado", parcelas_max: PARCELAS_MAX, valor_parcela: valorParcela, total: Math.round(valorParcela * PARCELAS_MAX * 100) / 100 },
    ],
  });
}
