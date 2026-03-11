// supabase/functions/_shared/types.ts

export interface GenerationFormData {
  tipo: 'risco' | 'bordado_colorido';
  modo?: 'texto' | 'imagem';
  imageBase64?: string;
  imageMediaType?: 'image/jpeg' | 'image/png' | 'image/webp';
  style?: 'simples' | 'detalhado' | 'infantil' | 'minimal' | 'outline' | 'detailed';
  includeText?: boolean;
  isFaceless?: boolean;
  nomeTexto?: string;
  estilo?: 'floral' | 'geometrico' | 'bebe' | 'religioso' | 'natureza' | 'folk';
  elementos?: string[];
  paletaCores?: 'rose_dusty' | 'azul_bebe' | 'neutros' | 'colorido_vibrante' | 'verde_sage' | 'lilas';
  formato?: 'bastidor_circular' | 'bastidor_quadrado' | 'livre';
  ocasiao?: 'nascimento' | 'casamento' | 'decoracao' | 'presente' | 'aniversario' | 'religioso';
  tamanhoTexto?: 'pequeno' | 'medio' | 'grande';
  observacoes?: string;
  descricao?: string;
  coresSelecionadas?: string[];
  coresDescricao?: string;
  referenceImageBase64?: string;
  referenceImageMediaType?: string;
}

export interface GenerationResponse {
  success: boolean;
  imageUrl?: string;
  generationId?: string;
  imageExpiresAt?: string;
  error?: string;
  requiresUpgrade?: boolean;
}

export interface PricingFormData {
  productName: string;
  materialsCost: number;
  laborHours: number;
  hourlyRate: number;
  overheadCost: number;
  profitMargin: number;
  productDescription?: string;
}

export interface PricingResponse {
  success: boolean;
  calculation?: {
    laborCost: number;
    totalCost: number;
    finalPrice: number;
  };
  geminiAnalysis?: {
    marketAnalysis: string;
    suggestions: string[];
    priceRange: { min: number; max: number };
    tips: string;
  };
  calculationId?: string;
  error?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  conversationId?: string;
  title?: string;
  error?: string;
}

// Payment Types
export interface CardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export interface PaymentRequest {
  paymentMethod: 'credit_card' | 'pix';
  cardData?: CardData;
}
