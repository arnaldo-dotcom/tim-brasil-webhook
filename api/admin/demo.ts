import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listClientes } from "../_db";

function brl(v: number) {
  const [i, d] = v.toFixed(2).split(".");
  return "R$ " + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const clientes = await listClientes();
  clientes.sort((a, b) => a.nome.localeCompare(b.nome));

  const rows = clientes.map((c) => {
    const abertas = c.faturas.filter((f) => f.status === "aberto");
    const total = abertas.reduce((s, f) => s + f.valor, 0);
    const desconto = c.desconto_pct ?? 30;
    const avista = Math.round(total * (1 - desconto / 100) * 100) / 100;
    const parcMax = c.parcelas_max ?? 6;
    const statusAcordo = c.acordos?.length
      ? `<span style="color:#f59e0b">Acordo pendente</span>`
      : abertas.length
      ? `<span style="color:#ef4444">Em aberto</span>`
      : `<span style="color:#22c55e">Quitado</span>`;

    const faturaRows = abertas.map((f) =>
      `<tr>
        <td>${f.competencia}</td>
        <td>${f.vencimento ?? "—"}</td>
        <td>${brl(f.valor)}</td>
        <td>${f.dias_atraso}d</td>
      </tr>`
    ).join("");

    return `
      <tr class="cliente-row">
        <td><strong>${c.nome}</strong><br><small style="color:#6b7280">${c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</small></td>
        <td>${c.telefone}</td>
        <td>${brl(total)}</td>
        <td>${brl(avista)} <small style="color:#6b7280">(${desconto}% off)</small></td>
        <td>até ${parcMax}x</td>
        <td>${statusAcordo}</td>
        <td>
          <details>
            <summary style="cursor:pointer;color:#3b82f6">${abertas.length} fatura(s)</summary>
            <table style="margin-top:6px;font-size:12px;width:100%">
              <thead><tr><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Atraso</th></tr></thead>
              <tbody>${faturaRows || "<tr><td colspan=4 style='color:#6b7280'>Nenhuma fatura aberta</td></tr>"}</tbody>
            </table>
          </details>
        </td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>TIM Brasil — Base Demo</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    th { background: #1e3a5f; color: white; text-align: left; padding: 10px 14px; font-size: 13px; font-weight: 600; }
    td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: top; }
    .cliente-row:hover td { background: #f8fafc; }
    details table { background: #f8fafc; border-radius: 6px; }
    details th { background: #334155; font-size: 11px; padding: 6px 10px; }
    details td { font-size: 11px; padding: 5px 10px; }
    .badge { display:inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .refresh { float:right; font-size:13px; color:#3b82f6; text-decoration:none; }
  </style>
</head>
<body>
  <h1>TIM Brasil — Base Demo <a class="refresh" href="">↻ Atualizar</a></h1>
  <p class="subtitle">${clientes.length} cliente(s) cadastrado(s) · Ambiente de demonstração</p>
  <table>
    <thead>
      <tr>
        <th>Cliente / CPF</th>
        <th>Telefone</th>
        <th>Total em aberto</th>
        <th>Oferta à vista</th>
        <th>Parcelamento</th>
        <th>Status</th>
        <th>Faturas</th>
      </tr>
    </thead>
    <tbody>${rows || "<tr><td colspan=7 style='text-align:center;color:#6b7280;padding:32px'>Nenhum cliente cadastrado. Rode o seed primeiro.</td></tr>"}</tbody>
  </table>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
}
