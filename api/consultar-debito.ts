import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClienteByCpf, getClienteByPhone } from "./_db";
import { perfil, DESCONTO_AVISTA_PCT, PARCELAS_MAX } from "./_perfil";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
  const body = req.body ?? {};

  // Moveo pode enviar variáveis no nível raiz, em context{} ou em variables{}
  const cpfRaw =
    body.cpf ?? body.context?.cpf ?? body.variables?.cpf ??
    body.session?.cpf ?? body.data?.cpf ?? null;
  const phoneRaw =
    body.phone ?? body.context?.phone ?? body.variables?.phone ??
    body.session?.phone ?? body.data?.phone ?? null;

  // Normaliza CPF: remove tudo que não é dígito (voz Twilio transcreve "1, 2, 3, ...")
  const cpf = cpfRaw ? String(cpfRaw).replace(/\D/g, "") || null : null;
  const phone = phoneRaw ? String(phoneRaw) : null;

  // 1. Tenta buscar no KV (CRM simulado) — com guard para KV indisponível
  let cliente = null;
  try {
    if (cpf) cliente = await getClienteByCpf(cpf);
    if (!cliente && phone) cliente = await getClienteByPhone(phone);
  } catch {
    // KV indisponível — cai no fallback hash
  }

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
  // Usa CPF placeholder se nenhum identificador chegar (nunca retorna 4xx para não travar o fluxo)
  const cpfFallback = cpf || "00000000000";

  const { nome, nFaturas, valorFatura } = perfil(cpfFallback);
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
  } catch (err) {
    console.error("[consultar-debito] unhandled error:", err);
    return res.status(200).json({ nome: "Cliente", total: 0, faturas: [], ofertas: [] });
  }
}
