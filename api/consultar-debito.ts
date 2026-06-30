import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClienteByCpf, getClienteByPhone } from "./_db";
import { perfil, DESCONTO_AVISTA_PCT, PARCELAS_MAX } from "./_perfil";

// Moveo lê variáveis de sessão via body.context.{var} e espera a resposta no formato {"context": {...}}
function ok(res: VercelResponse, vars: Record<string, unknown>) {
  return res.status(200).json({ context: vars });
}

function brl(v: number): string {
  const [int, dec] = v.toFixed(2).split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body ?? {};
    const ctx = body.context ?? body.variables ?? body ?? {};

    // Moveo envia variáveis de sessão em body.context
    const cpfRaw = ctx.cpf ?? ctx.user?.cpf ?? null;
    const phoneRaw = ctx.phone ?? ctx.user?.phone ?? null;
    const prefixoRaw = ctx.cpf_prefixo ?? null;

    const cpf = cpfRaw ? String(cpfRaw).replace(/\D/g, "") || null : null;
    const phone = phoneRaw ? String(phoneRaw).replace(/\D/g, "") || null : null;

    // Verifica os 3 primeiros dígitos do CPF (outbound: cpf em contexto)
    if (cpf && prefixoRaw !== null) {
      const prefixo = String(prefixoRaw).replace(/\D/g, "").slice(0, 3);
      if (prefixo.length === 3 && !cpf.startsWith(prefixo)) {
        return ok(res, {
          nome: "Não identificado",
          total: 0,
          num_faturas: 0,
          auth_ok: false,
          mensagem_inicial: "Não consegui confirmar sua identidade. Para sua segurança, não posso prosseguir. Se precisar de ajuda, entre em contato com a TIM.",
        });
      }
    }

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
      const desconto = cliente.desconto_pct ?? DESCONTO_AVISTA_PCT;
      const parcelasMax = cliente.parcelas_max ?? PARCELAS_MAX;
      const valorAvista = Math.round(total * (1 - desconto / 100) * 100) / 100;
      const valorParcela = Math.round((total * 1.1) / parcelasMax * 100) / 100;
      // Data de vencimento da fatura mais antiga em aberto
      const maisAntiga = faturas.sort((a, b) =>
        (a.vencimento ?? a.competencia).localeCompare(b.vencimento ?? b.competencia)
      )[0];
      const dataVencimento = maisAntiga?.vencimento ?? null;
      const nomeVoz = cliente.nome.split(" ")[0];
      const mensagem = faturas.length === 0
        ? `${nomeVoz}, verificamos sua conta e não encontramos faturas em aberto no momento. Se tiver dúvidas, pode falar com nossa equipe.`
        : `${nomeVoz}, identificamos R$ ${brl(total)} em faturas em aberto na sua conta TIM. Posso te ajudar a regularizar hoje?`;
      return ok(res, {
        cpf: cliente.cpf,
        nome: cliente.nome,
        total,
        total_fmt: `R$ ${brl(total)}`,
        desconto_pct: desconto,
        valor_avista: valorAvista,
        valor_avista_fmt: `R$ ${brl(valorAvista)}`,
        parcelas_max: parcelasMax,
        valor_parcela: valorParcela,
        valor_parcela_fmt: `R$ ${brl(valorParcela)}`,
        num_faturas: faturas.length,
        data_vencimento: dataVencimento,
        mensagem_inicial: mensagem,
      });
    }

    // Sem identificador real (web tester / sessão sem CPF e sem telefone) — usa perfil demo
    if (!cpf && !phone) {
      const cpfDemo = "00000000000";
      const { nome, nFaturas, valorFatura } = perfil(cpfDemo);
      const total = Math.round(nFaturas * valorFatura * 100) / 100;
      const valorAvista = Math.round(total * (1 - DESCONTO_AVISTA_PCT / 100) * 100) / 100;
      const valorParcela = Math.round((total * 1.1) / PARCELAS_MAX * 100) / 100;
      const nomeVoz = nome.split(" ")[0];
      const mensagem = `${nomeVoz}, identificamos R$ ${brl(total)} em faturas em aberto na sua conta TIM. Posso te ajudar a regularizar hoje?`;
      return ok(res, {
        cpf: cpfDemo,
        nome,
        total,
        total_fmt: `R$ ${brl(total)}`,
        desconto_pct: DESCONTO_AVISTA_PCT,
        valor_avista: valorAvista,
        valor_avista_fmt: `R$ ${brl(valorAvista)}`,
        parcelas_max: PARCELAS_MAX,
        valor_parcela: valorParcela,
        valor_parcela_fmt: `R$ ${brl(valorParcela)}`,
        num_faturas: nFaturas,
        data_vencimento: null,
        mensagem_inicial: mensagem,
      });
    }

    // Cliente não encontrado na base com CPF/telefone real
    return ok(res, {
      nome: "Cliente",
      total: 0,
      num_faturas: 0,
      cliente_encontrado: false,
      auth_ok: false,
      mensagem_inicial: "Não encontrei seu cadastro em nossa base. Por favor, entre em contato com a TIM pelo canal de atendimento para regularizar sua situação.",
    });
  } catch (err) {
    console.error("[consultar-debito] unhandled error:", err);
    return res.status(200).json({ context: { nome: "Cliente", total: 0, num_faturas: 0 } });
  }
}
