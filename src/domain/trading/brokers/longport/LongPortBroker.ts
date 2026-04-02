import { z } from 'zod'
import { Config, QuoteContext, TradeContext } from 'longbridge'
import type { IBroker, BrokerConfigField, AccountInfo, Position, PlaceOrderResult, OpenOrder, Quote, MarketClock, AccountCapabilities } from '../types.js'
import type { AccountConfig } from '../../../../core/config.js'
import { Contract, ContractDescription, ContractDetails, Order, OrderState, OrderCancel } from '@traderalice/ibkr'
import { BrokerError } from '../types.js'
import Decimal from 'decimal.js'

export class LongPortBroker implements IBroker {
  static configSchema = z.object({
    appKey: z.string().min(1),
    appSecret: z.string().min(1),
    accessToken: z.string().min(1),
  })

  static configFields: BrokerConfigField[] = [
    { name: 'appKey', label: 'App Key', type: 'text', required: true, sensitive: false },
    { name: 'appSecret', label: 'App Secret', type: 'password', required: true, sensitive: true },
    { name: 'accessToken', label: 'Access Token', type: 'password', required: true, sensitive: true },
  ]

  static fromConfig(config: AccountConfig): LongPortBroker {
    const parsed = LongPortBroker.configSchema.parse(config.brokerConfig)
    return new LongPortBroker(config.id, config.label || config.id, parsed)
  }

  readonly id: string
  readonly label: string
  private tc: TradeContext | null = null
  private qc: QuoteContext | null = null
  private config: Config
  private _isConnected = false

  constructor(id: string, label: string, opts: z.infer<typeof LongPortBroker.configSchema>) {
    this.id = id
    this.label = label
    this.config = Config.fromApikey(opts.appKey, opts.appSecret, opts.accessToken)
  }

  async init(): Promise<void> {
    try {
      this.tc = await TradeContext.new(this.config)
      this.qc = await QuoteContext.new(this.config)
      this._isConnected = true
    } catch (err: any) {
      throw BrokerError.from(err)
    }
  }

  async close(): Promise<void> {
    if (this.tc) {
      this.tc.close()
      this.tc = null
    }
    if (this.qc) {
      this.qc.close()
      this.qc = null
    }
    this._isConnected = false
  }

  async getAccount(): Promise<AccountInfo> {
    if (!this.tc) throw new Error('Not connected')
    try {
      const balance = await this.tc.accountBalance()
      const b = balance.find(x => x.currency === 'USD') || balance.find(x => x.currency === 'HKD') || balance[0]
      const baseCurrency = b?.currency || 'USD'
      
      const positions = await this.getPositions()
      
      let totalUnrealizedPnL = 0
      for (const p of positions) {
        let pnl = p.unrealizedPnL || 0
        if (baseCurrency === 'USD' && p.contract.currency === 'HKD') {
          pnl = pnl / 7.82
        } else if (baseCurrency === 'HKD' && p.contract.currency === 'USD') {
          pnl = pnl * 7.82
        }
        totalUnrealizedPnL += pnl
      }
      
      // Convert account assets to USD if HKD is the primary balance returned
      let netLiq = Number(b?.netAssets || 0)
      let totalCash = Number(b?.totalCash || 0)
      let buyingPower = Number(b?.maxFinanceAmount || 0)
      
      // We assume UI displays account totals in USD. If the primary base is HKD, convert it back to USD.
      if (baseCurrency === 'HKD') {
        netLiq = netLiq / 7.82
        totalCash = totalCash / 7.82
        buyingPower = buyingPower / 7.82
        totalUnrealizedPnL = totalUnrealizedPnL / 7.82
      }
      
      return {
        netLiquidation: netLiq,
        totalCashValue: totalCash,
        unrealizedPnL: totalUnrealizedPnL,
        buyingPower: buyingPower
      }
    } catch (err: any) {
      throw BrokerError.from(err)
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.tc || !this.qc) throw new Error('Not connected')
    try {
      const positions = await this.tc.stockPositions()
      const symbols = positions.channels.flatMap(c => c.positions.map(p => p.symbol))
      const quotes = await this.qc.quote(symbols).catch(() => [])

      return positions.channels.flatMap(channel => 
        channel.positions.map(p => {
          const c = new Contract()
          c.symbol = p.symbol
          c.aliceId = `longport|${p.symbol}`
          c.currency = p.currency
          // Determine if it's an option or a stock based on symbol format or secType
          if (p.symbol.length > 10 && /\d{6}[CP]\d+/.test(p.symbol)) {
            c.secType = 'OPT'
          } else {
            c.secType = 'STK'
          }
          
          const qty = Number(p.quantity)
          const costPrice = Number(p.costPrice)
          
          // Longbridge API doesn't return correct real-time market quotes for US options via .quote() 
          // without higher data permissions. For options or fallback, try to derive from marketValue if present
          let marketPrice = 0
          const q = quotes.find(x => x.symbol === p.symbol)
          if (q && Number(q.lastDone) > 0) {
            marketPrice = Number(q.lastDone)
          } else if (p.currency === 'USD' && p.symbol.length > 10) {
            // For options where we can't get live quote due to data access, 
            // We use the cost price as a fallback to avoid showing 0 for unrealized pnl,
            // or if the api provides some internal property we can scrape it.
            // But since longbridge `marketValue` is undefined here, we will just use costPrice.
            marketPrice = costPrice
          } else {
            // Fallback: Use marketValue from position data / quantity
            const mv = Number((p as any).marketValue || 0)
            if (qty !== 0 && mv !== 0) {
              const isOption = c.secType === 'OPT'
              marketPrice = Math.abs(mv / qty) / (isOption ? 100 : 1)
            } else {
              // If marketValue is not available on the object, use cost price as last resort
              marketPrice = costPrice
            }
          }
          
          const isUSD = p.currency === 'USD'
          const fxRate = isUSD ? 7.82 : 1.0 

          // Options multiplier is 100
          const multiplier = c.secType === 'OPT' ? 100 : 1
          const marketValue = marketPrice * qty * multiplier
          
          // Keep Unrealized PnL strictly in the original currency of the position so the UI can separate them
          // We will ONLY do currency conversion during `getAccount` aggregation
          const unrealizedPnL = (marketPrice - costPrice) * qty * multiplier
          
          return {
            contract: c,
            side: qty > 0 ? 'long' : 'short',
            quantity: new Decimal(Math.abs(qty)),
            avgCost: costPrice,
            marketPrice: marketPrice, 
            marketValue: marketValue,
            unrealizedPnL: unrealizedPnL,
            realizedPnL: 0
          } as Position
        })
      )
    } catch (err: any) {
      throw BrokerError.from(err)
    }
  }

  async getOrders(orderIds: string[]): Promise<OpenOrder[]> {
    if (!this.tc) throw new Error('Not connected')
    try {
      const history = await this.tc.historyOrders({ symbol: '', status: [] })
      const filtered = orderIds.length > 0 
        ? history.filter(o => orderIds.includes(o.orderId))
        : history

      return filtered.map(o => {
        const c = new Contract()
        c.symbol = o.symbol
        c.aliceId = `longport|${o.symbol}`
        
        const ord = new Order()
        ord.orderId = Number(o.orderId)
        ord.action = o.side === 'Buy' ? 'BUY' : 'SELL'
        ord.orderType = o.orderType
        ord.totalQuantity = Number(o.quantity)
        
        const state = new OrderState()
        state.status = o.status === 'Filled' ? 'Filled' : 
                       o.status === 'Canceled' ? 'Cancelled' : 
                       'Submitted'

        return {
          contract: c,
          order: ord,
          orderState: state,
          avgFillPrice: Number(o.executedPrice || 0)
        }
      })
    } catch (err: any) {
      throw BrokerError.from(err)
    }
  }

  async getOrder(orderId: string): Promise<OpenOrder | null> {
    const orders = await this.getOrders([orderId])
    return orders.length > 0 ? orders[0] : null
  }

  async searchContracts(pattern: string): Promise<ContractDescription[]> {
    const c = new Contract()
    c.symbol = pattern.toUpperCase()
    c.aliceId = `longport|${c.symbol}`
    return [{ contract: c, derivativeSecTypes: [] }]
  }

  async getContractDetails(query: Contract): Promise<ContractDetails | null> {
    const cd = new ContractDetails()
    cd.contract = query
    return cd
  }

  async getMarketClock(): Promise<MarketClock> {
    return { isOpen: true, timestamp: new Date() }
  }

  async placeOrder(contract: Contract, order: Order): Promise<PlaceOrderResult> {
    if (!this.tc) throw new Error('Not connected')
    try {
      const symbol = contract.symbol
      
      let orderType: any = 1 // LO
      let price = order.lmtPrice?.toString()
      
      if (order.orderType === 'MKT') {
        orderType = 2 // MO
        price = undefined
      }

      const orderSide: any = order.action === 'BUY' ? 1 : 2 // Buy or Sell
      
      const res = await this.tc.submitOrder({
        symbol: symbol,
        orderType: orderType,
        side: orderSide,
        submittedQuantity: order.totalQuantity?.toString() || '1',
        timeInForce: 0, // Day
        submittedPrice: price,
        remark: 'open-alice'
      })
      
      return { success: true, orderId: res.orderId }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async modifyOrder(orderId: string, changes: Partial<Order>): Promise<PlaceOrderResult> {
    if (!this.tc) throw new Error('Not connected')
    try {
      await this.tc.modifyOrder({
        orderId: orderId,
        quantity: changes.totalQuantity?.toString(),
        price: changes.lmtPrice?.toString()
      })
      return { success: true, orderId }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async cancelOrder(orderId: string, orderCancel?: OrderCancel): Promise<PlaceOrderResult> {
    if (!this.tc) throw new Error('Not connected')
    try {
      await this.tc.cancelOrder(orderId)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async closePosition(contract: Contract, quantity?: Decimal): Promise<PlaceOrderResult> {
    const pos = await this.getPositions()
    const p = pos.find(x => x.contract.symbol === contract.symbol)
    if (!p) return { success: false, error: 'Position not found' }
    
    const o = new Order()
    o.action = p.side === 'long' ? 'SELL' : 'BUY'
    o.orderType = 'MKT'
    o.totalQuantity = quantity?.toNumber() || p.quantity.toNumber()
    
    return this.placeOrder(contract, o)
  }

  async getQuote(contract: Contract): Promise<Quote> {
    if (!this.qc) throw new Error('Not connected')
    const resp = await this.qc.quote([contract.symbol])
    const q = resp[0]
    return {
      contract,
      last: Number(q?.lastDone || 0),
      bid: Number(q?.bid?.price || 0),
      ask: Number(q?.ask?.price || 0),
      volume: Number(q?.volume || 0),
      high: Number(q?.high || 0),
      low: Number(q?.low || 0),
      timestamp: new Date()
    }
  }

  getCapabilities(): AccountCapabilities {
    return {
      supportedSecTypes: ['STK'],
      supportedOrderTypes: ['MKT', 'LMT']
    }
  }

  getNativeKey(contract: Contract): string {
    return contract.symbol
  }

  resolveNativeKey(nativeKey: string): Contract {
    const c = new Contract()
    c.symbol = nativeKey
    c.secType = 'STK'
    return c
  }
}

