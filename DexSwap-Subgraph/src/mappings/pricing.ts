/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal, Address, BigInt, dataSource } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD } from './helpers'
import {
  getDaiNativeCurrencyWrapperPairAddress,
  getBadgerNativeCurrencyWrapperPairAddress,
  getDiggNativeCurrencyWrapperPair,
  getNativeCurrencyWrapperAddress,
  getLiquidityTrackingTokenAddresses
} from '../commons/addresses'
import { getMinimumLiquidityThresholdNativeCurrency, getMinimumBadgerThresholdForNewPairs } from '../commons/pricing'

export function getNativeCurrencyPriceInBADGER(): BigDecimal {
  if (dataSource.network() == 'xdai') {
    return ONE_BD
  }

  // fetch native currency prices for each stablecoin
  let daiPair = Pair.load(getDaiNativeCurrencyWrapperPairAddress()) // dai is token0
  let badgerPair = Pair.load(getBadgerNativeCurrencyWrapperPairAddress()) // badger is token0
  let diggPair = Pair.load(getDiggNativeCurrencyWrapperPair()) // digg is token1

  // all 3 have been created
  if (daiPair !== null && badgerPair !== null && diggPair !== null) {
    let totalLiquidityNativeCurrency = daiPair.reserve1.plus(badgerPair.reserve1).plus(diggPair.reserve0)
    let daiWeight = daiPair.reserve1.div(totalLiquidityNativeCurrency)
    let badgerWeight = badgerPair.reserve1.div(totalLiquidityNativeCurrency)
    let diggWeight = diggPair.reserve0.div(totalLiquidityNativeCurrency)
    return daiPair.token0Price
      .times(daiWeight)
      .plus(badgerPair.token0Price.times(badgerWeight))
      .plus(diggPair.token1Price.times(diggWeight))
    // dai and BADGER have been created
  } else if (daiPair !== null && badgerPair !== null) {
    let totalLiquidityNativeCurrency = daiPair.reserve1.plus(badgerPair.reserve1)
    let daiWeight = daiPair.reserve1.div(totalLiquidityNativeCurrency)
    let badgerWeight = badgerPair.reserve1.div(totalLiquidityNativeCurrency)
    return daiPair.token0Price.times(daiWeight).plus(badgerPair.token0Price.times(badgerWeight))
    // BADGER is the only pair so far
  } else if (badgerPair !== null) {
    return badgerPair.token0Price
  } else {
    return ZERO_BD
  }
}

/**
 * Search through graph to find derived native currency per token.
 * @todo update to be derived native currency (add stablecoin estimates)
 **/
export function findNativeCurrencyPerToken(token: Token): BigDecimal {
  if (token.id == getNativeCurrencyWrapperAddress()) {
    return ONE_BD
  }
  let whitelist = getLiquidityTrackingTokenAddresses()
  // loop through whitelist and check if paired with any
  for (let i = 0; i < whitelist.length; i++) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(whitelist[i]))
    if (pairAddress.toHexString() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHexString())
      if (pair.token0 == token.id && pair.reserveNativeCurrency.gt(getMinimumLiquidityThresholdNativeCurrency())) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1.derivedNativeCurrency as BigDecimal) // return token1 per our token * native currency per token 1
      }
      if (pair.token1 == token.id && pair.reserveNativeCurrency.gt(getMinimumLiquidityThresholdNativeCurrency())) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0.derivedNativeCurrency as BigDecimal) // return token0 per our token * native currency per token 0
      }
    }
  }
  return ZERO_BD // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to BADGER.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeBADGER(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedNativeCurrency.times(bundle.nativeCurrencyPrice)
  let price1 = token1.derivedNativeCurrency.times(bundle.nativeCurrencyPrice)

  let whitelist = getLiquidityTrackingTokenAddresses()
  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0BADGER = pair.reserve0.times(price0)
    let reserve1BADGER = pair.reserve1.times(price1)
    if (whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
      if (reserve0BADGER.plus(reserve1BADGER).lt(getMinimumBadgerThresholdForNewPairs())) {
        return ZERO_BD
      }
    }
    if (whitelist.includes(token0.id) && !whitelist.includes(token1.id)) {
      if (reserve0BADGER.times(BigDecimal.fromString('2')).lt(getMinimumBadgerThresholdForNewPairs())) {
        return ZERO_BD
      }
    }
    if (!whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
      if (reserve1BADGER.times(BigDecimal.fromString('2')).lt(getMinimumBadgerThresholdForNewPairs())) {
        return ZERO_BD
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString('2'))
  }

  // take full value of the whitelisted token amount
  if (whitelist.includes(token0.id) && !whitelist.includes(token1.id)) {
    return tokenAmount0.times(price0)
  }

  // take full value of the whitelisted token amount
  if (!whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
    return tokenAmount1.times(price1)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to BADGER * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityBADGER(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedNativeCurrency.times(bundle.nativeCurrencyPrice)
  let price1 = token1.derivedNativeCurrency.times(bundle.nativeCurrencyPrice)

  let whitelist = getLiquidityTrackingTokenAddresses()
  // both are whitelist tokens, take average of both amounts
  if (whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the whitelisted token amount
  if (whitelist.includes(token0.id) && !whitelist.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}
