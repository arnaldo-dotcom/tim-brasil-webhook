// Perfil determinístico por SHA256 do CPF — portado do webhook_mock.py
import { createHash } from "crypto";

const NOMES = [
  "João da Silva",
  "Maria Oliveira",
  "Carlos Souza",
  "Ana Pereira",
  "Pedro Santos",
  "Lucia Costa",
];

export const DESCONTO_AVISTA_PCT = 30;
export const PARCELAS_MAX = 6;

export function soDigitos(cpf: string): string {
  return (cpf ?? "").replace(/\D/g, "");
}

export function perfil(cpf: string): { nome: string; nFaturas: number; valorFatura: number } {
  const digs = soDigitos(cpf) || "00000000000";
  const hex = createHash("sha256").update(digs).digest("hex");
  const h = BigInt("0x" + hex);
  const nome = NOMES[Number(h % BigInt(NOMES.length))];
  const nFaturas = 1 + Number(h % BigInt(2));
  const valorFatura = Math.round((99.9 + Number(h % BigInt(150))) * 100) / 100;
  return { nome, nFaturas, valorFatura };
}

export function acordoId(cpf: string, tipo: string, valor: number): string {
  const input = soDigitos(cpf) + tipo + valor.toFixed(2);
  return "ACD-" + createHash("sha256").update(input).digest("hex").slice(0, 6).toUpperCase();
}

export function vencimento(diasAFrente = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + diasAFrente);
  return d.toISOString().split("T")[0];
}
