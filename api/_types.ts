export interface Fatura {
  id: string;
  competencia: string;
  valor: number;
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
  faturas: Fatura[];
  acordos: Acordo[];
}
