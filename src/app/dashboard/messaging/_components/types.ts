// Compartilhado entre tabs do Messaging Studio. Espelha shapes do
// backend (src/modules/messaging/messaging.service.ts).

export type Channel       = 'whatsapp' | 'instagram' | 'tiktok'
export type TriggerEvent  =
  | 'order_paid' | 'order_shipped' | 'order_delivered' | 'order_cancelled'
  | 'post_sale_7d' | 'post_sale_30d' | 'manual' | 'lead_bridge_capture'
export type JourneyMode   = 'automatic' | 'manual' | 'campaign'
export type StepType      = 'send_message' | 'wait' | 'condition'

export interface MessagingTemplate {
  id:              string
  organization_id: string
  name:            string
  channel:         Channel
  trigger_event:   TriggerEvent
  message_body:    string
  variables:       string[]
  is_active:       boolean
  created_at:      string
  updated_at:      string
}

export interface JourneyStep {
  order:            number
  type:             StepType
  template_id?:     string
  delay_hours?:     number
  delay_days?:      number
  condition_field?: string
  condition_value?: unknown
}

export interface MessagingJourney {
  id:              string
  organization_id: string
  name:            string
  description:     string | null
  trigger_event:   TriggerEvent
  trigger_channel: Channel
  is_active:       boolean
  mode:            JourneyMode
  steps:           JourneyStep[]
  created_at:      string
  updated_at:      string
}

export const TRIGGER_LABELS: Record<TriggerEvent, string> = {
  order_paid:          'Pedido confirmado (pago)',
  order_shipped:       'Pedido enviado',
  order_delivered:     'Pedido entregue',
  order_cancelled:     'Pedido cancelado',
  post_sale_7d:        'Pós-venda — 7 dias',
  post_sale_30d:       'Pós-venda — 30 dias',
  manual:              'Disparo manual',
  lead_bridge_capture: 'Captura via Lead Bridge',
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp:  'WhatsApp',
  instagram: 'Instagram (em breve)',
  tiktok:    'TikTok (em breve)',
}

export const MODE_LABELS: Record<JourneyMode, string> = {
  automatic: 'Automático',
  manual:    'Manual',
  campaign:  'Campanha',
}

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  send_message: 'Enviar mensagem',
  wait:         'Aguardar',
  condition:    'Condição',
}

export const SAMPLE_CONTEXT: Record<string, string> = {
  nome:     'João Silva',
  pedido:   '2000123456',
  produto:  'Caixa de Som JBL Charge 5',
  rastreio: 'BR123456789BR',
  loja:     'Vazzo',
  cupom:    'BEMVINDO10',
  valor:    'R$ 599,00',
  phone:    '5511999998888',
}
