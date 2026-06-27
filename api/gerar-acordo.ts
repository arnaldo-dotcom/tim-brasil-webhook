import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClienteByCpf, saveCliente } from "./_db";
import { acordoId, vencimento } from "./_perfil";
import { gerarPixCopiaCola } from "./_pix";
import type { Acordo } from "./_types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { cpf: cpfRaw, tipo = "a_vista", meio = "pix", valor, num_parcelas } = req.body ?? {};
  if (!cpfRaw || !valor) return res.status(400).json({ error: "cpf e valor são obrigatórios" });

  // Normaliza CPF: remove tudo que não é dígito
  const cpf = String(cpfRaw).replace(/\D/g, "");

  const valorNum = Math.round(parseFloat(valor) * 100) / 100;
  const id = acordoId(String(cpf), String(tipo), valorNum);

  const resp: Record<string, unknown> = {
    acordo_id: id,
    tipo,
    meio,
    valor: valorNum,
    vencimento: vencimento(3),
  };

  if (meio === "pix") {
    resp.pix_copia_cola = gerarPixCopiaCola(valorNum, id.replace(/-/g, ""));
  } else {
    resp.boleto_linha_digitavel = `34191.79001 01043.510047 91020.150008 1 99870000${String(Math.round(valorNum * 100)).padStart(8, "0")}`;
    resp.boleto_url = `https://pag.tim.demo/b/${id}`;
  }

  if (tipo === "parcelado") {
    const parcelas = Number(num_parcelas ?? 6);
    const valorParcela = Math.round((valorNum / parcelas) * 100) / 100;
    resp.num_parcelas = parcelas;
    resp.valor_parcela = valorParcela;
    resp.vencimentos = Array.from({ length: parcelas }, (_, i) => vencimento(3 + i * 30));
  }

  // Persiste acordo no CRM (KV) se cliente existir
  const cliente = await getClienteByCpf(String(cpf));
  if (cliente) {
    const novoAcordo: Acordo = {
      acordo_id: id,
      tipo: tipo as Acordo["tipo"],
      valor: valorNum,
      vencimento: String(resp.vencimento),
      criado_em: new Date().toISOString(),
      status: "pendente",
    };
    // Marca faturas como negociado
    cliente.faturas = cliente.faturas.map((f) =>
      f.status === "aberto" ? { ...f, status: "negociado" as const } : f
    );
    cliente.acordos = [...(cliente.acordos ?? []), novoAcordo];
    await saveCliente(cliente);
  }

  return res.status(200).json(resp);
}
