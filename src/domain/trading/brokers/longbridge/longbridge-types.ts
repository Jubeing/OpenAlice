/**
 * Longbridge raw API types (from LongBridge OpenAPI SDK v4).
 */

export interface LongPortAccountAsset {
  accountId: string
  netAssets: { toString(): string; [k: string]: unknown }
  totalCash: { toString(): string; [k: string]: unknown }
  cashInfos: Array<{
    withdrawCash: { toString(): string }
    availableCash: { toString(): string }
    frozenCash: { toString(): string }
    settlingCash: { toString(): string }
    currency: string
  }>
  maxFinanceAmount: { toString(): string }
  remainingFinanceAmount: { toString(): string }
  riskLevel: number
  marginCall: { toString(): string }
  currency: string
  buyPower?: { toString(): string }
  initMargin?: { toString(): string }
  maintenanceMargin?: { toString(): string }
}

export interface LongPortPosition {
  symbol: string
  symbolName: string
  quantity: number
  availableQuantity: number
  dryQuantity: number
  costPrice: { toString(): string }
  market: { toString(): string }
  unrealizedPl: { toString(): string }
  unrealizedPlCcy: { toString(): string }
  todayPl: { toString(): string }
  todayPlCcy: { toString(): string }
  positionSide: 'Long' | 'Short'
}

export interface LongPortOrder {
  orderId: string
  orderType: string
  positionSide: string
  side: string
  status: string
  symbol: string
  submittedPrice: { toString(): string }
  submittedQuantity: number
  filledQuantity: number
  avgPrice: { toString(): string }
  createdAt: string
  updatedAt: string
  timeInForce: string
  remark?: string
  lastShare: { toString(): string }
  lastPrice: { toString(): string }
}

export interface LongPortSubmitOrderResponse {
  orderId: string
  status: string
  executedQty?: number
  message?: string
}

export interface LongPortOrderDetail {
  orderId: string
  symbol: string
  orderType: string
  side: string
  positionSide: string
  status: string
  submittedPrice: { toString(): string }
  submittedQuantity: number
  filledQuantity: number
  avgPrice: { toString(): string }
  createdAt: string
  updatedAt: string
  timeInForce: string
  lastShare: { toString(): string }
  lastPrice: { toString(): string }
  legs?: Array<{
    orderId: string; symbol: string; orderType: string; side: string
    submittedPrice: { toString(): string }; submittedQuantity: number
    filledQuantity: number; avgPrice: { toString(): string }
  }>
}

export interface LongPortQuote {
  lastPrice: { toString(): string }
  lastClose?: { toString(): string }
  open?: { toString(): string }
  high?: { toString(): string }
  low?: { toString(): string }
  volume?: number
  timestamp?: number
  tradeSession?: string
}
