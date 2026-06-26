import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cpf } = req.body ?? {};

  if (!cpf) {
    return res.status(400).json({ error: "cpf is required" });
  }

  // Deterministic mock based on last 2 digits of CPF
  const digits = cpf.replace(/\D/g, "");
  const seed = parseInt(digits.slice(-2), 10);

  if (seed % 10 === 0) {
    // ~10% adimplentes — sem débito
    return res.status(200).json({
      cpf,
      nome: "Maria Aparecida Lima",
      tem_debito: false,
      message: "Nenhuma fatura em aberto encontrada.",
    });
  }

  const total = 194.85 * 2;
  const descontoPct = 30;
  const valorFinal = parseFloat((total * (1 - descontoPct / 100)).toFixed(2));
  const parcelasMax = 6;
  const valorParcela = parseFloat((total / parcelasMax).toFixed(2));

  return res.status(200).json({
    cpf,
    nome: "João da Silva",
    tem_debito: true,
    total,
    faturas: [
      {
        id: "F-2026-04",
        competencia: "abr/2026",
        valor: 194.85,
        dias_atraso: 58,
      },
      {
        id: "F-2026-05",
        competencia: "mai/2026",
        valor: 194.85,
        dias_atraso: 27,
      },
    ],
    ofertas: [
      {
        tipo: "a_vista",
        desconto_pct: descontoPct,
        valor_final: valorFinal,
      },
      {
        tipo: "parcelado",
        parcelas_max: parcelasMax,
        valor_parcela: valorParcela,
        total: parseFloat((valorParcela * parcelasMax).toFixed(2)),
      },
    ],
  });
}
