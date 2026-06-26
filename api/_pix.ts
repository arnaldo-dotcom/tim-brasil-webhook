// PIX BR Code (EMV) com CRC16-CCITT — portado do webhook_mock.py

const PIX_KEY = "pagamentos@tim.demo";
const MERCHANT_NAME = "TIM BRASIL DEMO";
const MERCHANT_CITY = "SAO PAULO";

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(payload, "utf-8")) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function gerarPixCopiaCola(valor: number, txid: string): string {
  const tid = (txid || "TIMDEMO").replace(/[^A-Z0-9]/gi, "").slice(0, 25);
  const mai = tlv("00", "br.gov.bcb.pix") + tlv("01", PIX_KEY);
  const payload =
    tlv("00", "01") +
    tlv("26", mai) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", valor.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", MERCHANT_NAME.slice(0, 25)) +
    tlv("60", MERCHANT_CITY.slice(0, 15)) +
    tlv("62", tlv("05", tid)) +
    "6304";
  return payload + crc16ccitt(payload);
}
