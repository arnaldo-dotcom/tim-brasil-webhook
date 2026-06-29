import type { VercelRequest, VercelResponse } from "@vercel/node";
import { saveCliente } from "../_db";
import type { Cliente } from "../_types";

function auth(req: VercelRequest): boolean {
  const token = (req.headers["authorization"] ?? "").replace("Bearer ", "");
  return token === (process.env.ADMIN_TOKEN ?? "tim-admin-2026");
}

// Datas calculadas a partir de 2026-06-29 (data de referência da campanha)
const DEMO_CLIENTES: Cliente[] = [
  {
    cpf: "12345678901",
    nome: "João da Silva",
    telefone: "+5511999990001",
    desconto_pct: 25,
    parcelas_max: 6,
    acordos: [],
    faturas: [
      { id: "F-2026-04", competencia: "abr/2026", valor: 194.85, vencimento: "2026-05-02", dias_atraso: 58, status: "aberto" },
      { id: "F-2026-05", competencia: "mai/2026", valor: 194.85, vencimento: "2026-06-02", dias_atraso: 27, status: "aberto" },
    ],
  },
  {
    cpf: "98765432100",
    nome: "Maria Oliveira",
    telefone: "+5511999990002",
    desconto_pct: 20,
    parcelas_max: 3,
    acordos: [],
    faturas: [
      { id: "F-2026-05", competencia: "mai/2026", valor: 249.90, vencimento: "2026-05-28", dias_atraso: 32, status: "aberto" },
    ],
  },
  {
    cpf: "11122233344",
    nome: "Carlos Souza",
    telefone: "+5511999990003",
    desconto_pct: 30,
    parcelas_max: 12,
    acordos: [],
    faturas: [
      { id: "F-2026-03", competencia: "mar/2026", valor: 189.90, vencimento: "2026-04-02", dias_atraso: 88, status: "aberto" },
      { id: "F-2026-04", competencia: "abr/2026", valor: 189.90, vencimento: "2026-05-02", dias_atraso: 58, status: "aberto" },
      { id: "F-2026-05", competencia: "mai/2026", valor: 189.90, vencimento: "2026-06-02", dias_atraso: 27, status: "aberto" },
    ],
  },
  {
    cpf: "55566677788",
    nome: "Ana Pereira",
    telefone: "+5511999990004",
    desconto_pct: 15,
    parcelas_max: 2,
    acordos: [],
    faturas: [
      { id: "F-2026-05", competencia: "mai/2026", valor: 149.90, vencimento: "2026-06-14", dias_atraso: 15, status: "aberto" },
    ],
  },
  {
    cpf: "99988877766",
    nome: "Pedro Santos",
    telefone: "+5511999990005",
    desconto_pct: 25,
    parcelas_max: 6,
    acordos: [],
    faturas: [
      { id: "F-2026-04", competencia: "abr/2026", valor: 219.90, vencimento: "2026-05-02", dias_atraso: 58, status: "aberto" },
      { id: "F-2026-05", competencia: "mai/2026", valor: 219.90, vencimento: "2026-06-02", dias_atraso: 27, status: "aberto" },
    ],
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!auth(req)) return res.status(401).json({ error: "Unauthorized" });

  await Promise.all(DEMO_CLIENTES.map(saveCliente));

  return res.status(200).json({
    seeded: DEMO_CLIENTES.length,
    clientes: DEMO_CLIENTES.map((c) => ({
      cpf: c.cpf,
      nome: c.nome,
      desconto_pct: c.desconto_pct,
      parcelas_max: c.parcelas_max,
      num_faturas: c.faturas.length,
    })),
  });
}
