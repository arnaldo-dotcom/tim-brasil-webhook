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
  desconto_pct?: number;
  parcelas_max?: number;
  faturas: Fatura[];
  acordos: Acordo[];
  propensao?: number;        // intencao_de_pagar 0-10, salvo pelo webhook de insights
  perfil_psicologico?: string;
  resumo_sessao?: string;
}
