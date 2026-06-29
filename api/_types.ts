export interface Fatura {
  id: string;
  competencia: string;
  valor: number;
  vencimento?: string; // ISO date (YYYY-MM-DD) do vencimento original
  dias_atraso: number;
  status: "aberto" | "quitado" | "negociado";
}

export interface Acordo {
  acordo_id: string;
  tipo: "a_vista" | "parcelado";
  valor: number;
  vencimento: string;
  criado_em: string;
  status: "pendente" | "pago";
}

export interface Cliente {
  cpf: string;
  nome: string;
  telefone: string; // +55XXXXXXXXXXX
  desconto_pct?: number;  // desconto oferecido pelo banco para este cliente
  parcelas_max?: number;  // máximo de parcelas permitido pelo banco
  faturas: Fatura[];
  acordos: Acordo[];
}
