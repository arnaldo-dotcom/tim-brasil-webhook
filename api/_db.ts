import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});
import type { Cliente } from "./_types";

export async function getClienteByCpf(cpf: string): Promise<Cliente | null> {
  return kv.get<Cliente>(`cliente:${cpf}`);
}

export async function getClienteByPhone(phone: string): Promise<Cliente | null> {
  const cpf = await kv.get<string>(`phone:${phone}`);
  if (!cpf) return null;
  return getClienteByCpf(cpf);
}

export async function saveCliente(cliente: Cliente): Promise<void> {
  await kv.set(`cliente:${cliente.cpf}`, cliente);
  if (cliente.telefone) {
    await kv.set(`phone:${cliente.telefone}`, cliente.cpf);
  }
}

export async function deleteCliente(cpf: string): Promise<void> {
  const c = await getClienteByCpf(cpf);
  if (c?.telefone) await kv.del(`phone:${c.telefone}`);
  await kv.del(`cliente:${cpf}`);
}

export async function listClientes(): Promise<Cliente[]> {
  const keys = await kv.keys("cliente:*");
  if (!keys.length) return [];
  const result = await Promise.all(keys.map((k) => kv.get<Cliente>(k)));
  return result.filter(Boolean) as Cliente[];
}
