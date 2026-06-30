import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClienteByCpf, saveCliente } from "./_db";
import { acordoId, vencimento, DESCONTO_AVISTA_PCT, PARCELAS_MAX } from "./_perfil";
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
    const numMatch = rawStr.match(/\d+/);
    const parsedNum = PT_NUMS[rawStr] ?? (numMatch ? parseInt(numMatch[0], 10) : NaN);
    // Respeita o limite máximo de parcelas definido pelo banco
    const parcelasMaxCtx = ctx.parcelas_max ? parseInt(String(ctx.parcelas_max), 10) : PARCELAS_MAX;
    const parcelas = Math.min(Math.max(1, isNaN(parsedNum) ? 1 : parsedNum), parcelasMaxCtx);
    const tipo: string = ctx.tipo_pagamento ?? (parcelas > 1 ? "parcelado" : "a_vista");
    const meio: string = ctx.meio_pagamento ?? (tipo === "parcelado" ? "boleto" : "pix");
    // Para à vista usa o valor com desconto do banco; para parcelado usa o total com juros
    const descontoPct = ctx.desconto_pct ? parseFloat(String(ctx.desconto_pct)) : DESCONTO_AVISTA_PCT;
    const totalBruto = parseFloat(String(ctx.total ?? 0));
    const valorRaw = tipo === "a_vista"
      ? (ctx.valor_avista ?? Math.round(totalBruto * (1 - descontoPct / 100) * 100) / 100)
      : (ctx.total ?? ctx.valor ?? null);

    if (!cpfRaw || valorRaw === null || valorRaw === undefined) {
      return res.status(200).json({ context: { erro_acordo: "cpf ou valor ausente" } });
    }

    const cpf = String(cpfRaw).replace(/\D/g, "");
    const valorNum = Math.round(parseFloat(String(valorRaw)) * 100) / 100;

    const id = acordoId(cpf, tipo, valorNum);
    const venc = vencimento(2);
    const nomeCtx = ctx.nome ? String(ctx.nome).split(" ")[0] : null;

    function brl(v: number): string {
      const [int, dec] = v.toFixed(2).split(".");
      return int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
    }

    function fmtData(iso: string): string {
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    }

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
      // Código gerado mas NÃO lido em voz — enviado via WhatsApp/SMS
      if (meio === "pix") {
        vars.pix_copia_cola = gerarPixCopiaCola(valorParcela, `${id.replace(/-/g, "")}01`);
      } else {
        vars.boleto_linha = `34191.79001 01043.510047 91020.150008 1 99870000${String(Math.round(valorParcela * 100)).padStart(8, "0")}`;
      }
      const prefixo = nomeCtx ? `${nomeCtx}, ` : "";
      vars.mensagem_confirmacao = `${prefixo}acordo registrado em ${parcelas} parcelas de R$ ${brl(valorParcela)}, com primeira parcela em ${fmtData(venc)}. Os dados de pagamento chegam no seu WhatsApp agora. Posso te ajudar com mais alguma coisa?`;
    } else {
      // Código gerado mas NÃO lido em voz — enviado via WhatsApp/SMS
      if (meio === "pix") {
        vars.pix_copia_cola = gerarPixCopiaCola(valorNum, id.replace(/-/g, ""));
      } else {
        vars.boleto_linha = `34191.79001 01043.510047 91020.150008 1 99870000${String(Math.round(valorNum * 100)).padStart(8, "0")}`;
      }
      const prefixo = nomeCtx ? `${nomeCtx}, ` : "";
      vars.mensagem_confirmacao = `${prefixo}acordo registrado de R$ ${brl(valorNum)} à vista, com vencimento em ${fmtData(venc)}. Os dados de pagamento chegam no seu WhatsApp agora. Posso te ajudar com mais alguma coisa?`;
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
