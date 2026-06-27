import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClienteByCpf, saveCliente, deleteCliente, listClientes } from "../_db";
import type { Cliente } from "../_types";

function auth(req: VercelRequest): boolean {
  const token = (req.headers["authorization"] ?? "").replace("Bearer ", "");
  return token === (process.env.ADMIN_TOKEN ?? "tim-admin-2026");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!auth(req)) return res.status(401).json({ error: "Unauthorized" });

  // GET — lista todos ou busca por CPF
  if (req.method === "GET") {
    const { cpf } = req.query;
    if (cpf) {
      const c = await getClienteByCpf(String(cpf));
      return c ? res.status(200).json(c) : res.status(404).json({ error: "Cliente não encontrado" });
    }
    return res.status(200).json(await listClientes());
  }

  // POST — cria ou substitui cliente
  if (req.method === "POST") {
    const body = req.body as Partial<Cliente>;
    if (!body.cpf || !body.nome) return res.status(400).json({ error: "cpf e nome obrigatórios" });
    const cliente: Cliente = {
      cpf: body.cpf,
      nome: body.nome,
      telefone: body.telefone ?? "",
      faturas: body.faturas ?? [],
      acordos: body.acordos ?? [],
    };
    await saveCliente(cliente);
    return res.status(200).json(cliente);
  }

  // DELETE — remove cliente
  if (req.method === "DELETE") {
    const { cpf } = req.query;
    if (!cpf) return res.status(400).json({ error: "cpf obrigatório" });
    await deleteCliente(String(cpf));
    return res.status(200).json({ deleted: cpf });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
