import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClienteByCpf, saveCliente } from "./_db";
import { acordoId, vencimento } from "./_perfil";
import { gerarPixCopiaCola } from "./_pix";
import type { Acordo } from "./_types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body ?? {};
    const ctx = body.context ?? body.variables ?? body ?? {};

    const cpfRaw = ctx.cpf ?? ctx.user?.cpf ?? null;
    const numParcelasRaw = ctx.num_parcelas ?? 1;
    const PT_NUMS: Record<string, number> = { dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6 };
    const rawStr = String(numParcelasRaw).toLowerCase().trim();
    const parsedNum = PT_NUMS[rawStr] ?? parseInt(rawStr, 10);
    const parcelas = Math.max(1, isNaN(parsedNum) ? 1 : parsedNum);
    const tipo: string = ctx.tipo_pagamento ?? (parcelas > 1 ? "parcelado" : "a_vista");
    const meio: string = ctx.meio_pagamento ?? (tipo === "parcelado" ? "boleto" : "pix");
    const valorRaw = ctx.total ?? ctx.valor_avista ?? ctx.valor ?? null;

    if (!cpfRaw || !valorRaw) {
      return res.status(200).json({ context: { erro_acordo: "cpf ou valor ausente" } });
    }

    const cpf = String(cpfRaw).replace(/\D/g, "");
    const valorNum = tipo === "parcelado"
      ? Math.round(parseFloat(String(ctx.total ?? valorRaw)) * 100) / 100
      : Math.round(parseFloat(String(ctx.valor_avista ?? valorRaw)) * 100) / 100;

    const id = acordoId(cpf, tipo, valorNum);
    const venc = vencimento(3);

    const vars: Record<string, unknown> = {
      acordo_id: id,
      tipo_acordo: tipo,
      meio_pagamento: meio,
      valor_acordo: valorNum,
      vencimento_acordo: venc,
    };

    if (tipo === "parcelado") {
      const valorParcela = Math.round((valorNum / parcelas) * 100) / 100;
      vars.num_parcelas_acordo = parcelas;
      vars.valor_parcela_acordo = valorParcela;
      vars.primeira_parcela = venc;
      if (meio === "pix") {
        vars.pix_copia_cola = gerarPixCopiaCola(valorParcela, `${id.replace(/-/g, "")}01`);
      } else {
        vars.boleto_linha = `34191.79001 01043.510047 91020.150008 1 99870000${String(Math.round(valorParcela * 100)).padStart(8, "0")}`;
      }
    } else {
      if (meio === "pix") {
        vars.pix_copia_cola = gerarPixCopiaCola(valorNum, id.replace(/-/g, ""));
      } else {
        vars.boleto_linha = `34191.79001 01043.510047 91020.150008 1 99870000${String(Math.round(valorNum * 100)).padStart(8, "0")}`;
      }
    }

    // Persiste no KV se cliente existir
    try {
      const cliente = await getClienteByCpf(cpf);
      if (cliente) {
        const novoAcordo: Acordo = {
          acordo_id: String(id),
          tipo: tipo as Acordo["tipo"],
          valor: valorNum,
          vencimento: venc,
          criado_em: new Date().toISOString(),
          status: "pendente",
        };
        cliente.faturas = cliente.faturas.map((f) =>
          f.status === "aberto" ? { ...f, status: "negociado" as const } : f
        );
        cliente.acordos = [...(cliente.acordos ?? []), novoAcordo];
        await saveCliente(cliente);
      }
    } catch {
      // KV indisponível — acordo gerado mas não persistido
    }

    return res.status(200).json({ context: vars });
  } catch (err) {
    console.error("[gerar-acordo] error:", err);
    return res.status(200).json({ context: { erro_acordo: "erro interno" } });
  }
}
