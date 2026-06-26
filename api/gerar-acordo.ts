import type { VercelRequest, VercelResponse } from "@vercel/node";

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ((crc & 0xffff) >>> 0).toString(16).toUpperCase().padStart(4, "0");
}

function gerarPixCopiaCola(valor: number, acordoId: string): string {
  const merchantName = "TIM BRASIL SA";
  const merchantCity = "SAO PAULO";
  const txid = acordoId.replace(/[^A-Z0-9]/g, "").slice(0, 25);

  const gui = "BR.GOV.BCB.PIX";
  const key = "cobranca@tim.com.br";
  const merchantAccInfo = `0014${gui.length.toString().padStart(2, "0")}${gui}0136${key.length.toString().padStart(2, "0")}${key}`;

  const valorStr = valor.toFixed(2);
  const addDataField = `05${txid.length.toString().padStart(2, "0")}${txid}`;

  let payload =
    `000201` +
    `010212` +
    `26${merchantAccInfo.length.toString().padStart(2, "0")}${merchantAccInfo}` +
    `52040000` +
    `5303986` +
    `54${valorStr.length.toString().padStart(2, "0")}${valorStr}` +
    `5802BR` +
    `59${merchantName.length.toString().padStart(2, "0")}${merchantName}` +
    `60${merchantCity.length.toString().padStart(2, "0")}${merchantCity}` +
    `62${addDataField.length.toString().padStart(2, "0")}${addDataField}` +
    `6304`;

  return payload + crc16(payload);
}

function gerarVencimento(diasAFrente: number): string {
  const d = new Date();
  d.setDate(d.getDate() + diasAFrente);
  return d.toISOString().split("T")[0];
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cpf, tipo, valor, meio, num_parcelas } = req.body ?? {};

  if (!cpf || !tipo || !valor) {
    return res.status(400).json({ error: "cpf, tipo e valor são obrigatórios" });
  }

  const digits = cpf.replace(/\D/g, "").slice(-6);
  const acordoId = `ACD-TIM-${digits.toUpperCase()}`;
  const vencimento = gerarVencimento(3);

  if (tipo === "a_vista") {
    const pixCopiaCola = gerarPixCopiaCola(Number(valor), acordoId);
    const boletoLinha = `34191.79001 01043.510047 91020.150008 1 ${String(Math.round(Number(valor) * 100)).padStart(17, "0")}`;

    return res.status(200).json({
      acordo_id: acordoId,
      tipo: "a_vista",
      valor: Number(valor),
      meio: meio ?? "pix",
      vencimento,
      pix_copia_cola: pixCopiaCola,
      boleto_linha_digitavel: boletoLinha,
      boleto_url: `https://pag.tim.com.br/b/${acordoId}`,
    });
  }

  // parcelado
  const parcelas = Number(num_parcelas ?? 6);
  const valorParcela = parseFloat((Number(valor) / parcelas).toFixed(2));
  const vencimentos = Array.from({ length: parcelas }, (_, i) =>
    gerarVencimento(3 + i * 30)
  );

  return res.status(200).json({
    acordo_id: acordoId,
    tipo: "parcelado",
    num_parcelas: parcelas,
    valor_parcela: valorParcela,
    total: parseFloat((valorParcela * parcelas).toFixed(2)),
    vencimentos,
    boleto_1_url: `https://pag.tim.com.br/b/${acordoId}-P01`,
  });
}
