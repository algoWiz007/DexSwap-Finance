import invariant from 'tiny-invariant'
import { ChainId } from '../constants'
import { Price } from './fractions'
import { Token } from './token'

/**
 * Represents an ERC20 token and its price, expressed in any given currency.
 */
export class PricedToken extends Token {
  public readonly price: Price

  constructor(chainId: ChainId, address: string, decimals: number, price: Price, symbol?: string, name?: string) {
    invariant(price.baseCurrency.symbol === symbol && price.baseCurrency.decimals === decimals, 'TOKEN')
    super(chainId, address, decimals, symbol, name)
    this.price = price
  }
}
