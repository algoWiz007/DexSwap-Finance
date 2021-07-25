/* eslint-disable prefer-const */
import { log } from '@graphprotocol/graph-ts'
import { DexswapFactory, Pair, Token, Bundle } from '../types/schema'
import { PairCreated } from '../types/Factory/Factory'
import { Pair as PairTemplate } from '../types/templates'
import {
  ZERO_BD,
  ZERO_BI,
  fetchTokenSymbol,
  fetchTokenName,
  fetchTokenDecimals,
  fetchTokenTotalSupply
} from './helpers'
import { getFactoryAddress } from '../commons/addresses'

export function handleNewPair(event: PairCreated): void {
  // load factory (create if first exchange)
  let factoryAddress = getFactoryAddress()
  let factory = DexswapFactory.load(factoryAddress)
  if (factory === null) {
    factory = new DexswapFactory(factoryAddress)
    factory.pairCount = 0
    factory.totalVolumeNativeCurrency = ZERO_BD
    factory.totalLiquidityNativeCurrency = ZERO_BD
    factory.totalVolumeBADGER = ZERO_BD
    factory.untrackedVolumeBADGER = ZERO_BD
    factory.totalLiquidityBADGER = ZERO_BD
    factory.txCount = ZERO_BI

    // create new bundle
    let bundle = new Bundle('1')
    bundle.nativeCurrencyPrice = ZERO_BD
    bundle.save()
  }
  factory.pairCount = factory.pairCount + 1
  factory.save()

  // create the tokens
  let token0 = Token.load(event.params.token0.toHexString())
  let token1 = Token.load(event.params.token1.toHexString())

  // fetch info if null
  if (token0 === null) {
    token0 = new Token(event.params.token0.toHexString())
    token0.symbol = fetchTokenSymbol(event.params.token0)
    token0.name = fetchTokenName(event.params.token0)
    token0.totalSupply = fetchTokenTotalSupply(event.params.token0)
    let decimals = fetchTokenDecimals(event.params.token0)
    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      log.debug('mybug the decimal on token 0 was null', [])
      return
    }

    token0.decimals = decimals
    token0.derivedNativeCurrency = ZERO_BD
    token0.tradeVolume = ZERO_BD
    token0.tradeVolumeBADGER = ZERO_BD
    token0.untrackedVolumeBADGER = ZERO_BD
    token0.totalLiquidity = ZERO_BD
    // token0.allPairs = []
    token0.txCount = ZERO_BI
  }

  // fetch info if null
  if (token1 === null) {
    token1 = new Token(event.params.token1.toHexString())
    token1.symbol = fetchTokenSymbol(event.params.token1)
    token1.name = fetchTokenName(event.params.token1)
    token1.totalSupply = fetchTokenTotalSupply(event.params.token1)
    let decimals = fetchTokenDecimals(event.params.token1)

    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      return
    }
    token1.decimals = decimals
    token1.derivedNativeCurrency = ZERO_BD
    token1.tradeVolume = ZERO_BD
    token1.tradeVolumeBADGER = ZERO_BD
    token1.untrackedVolumeBADGER = ZERO_BD
    token1.totalLiquidity = ZERO_BD
    // token1.allPairs = []
    token1.txCount = ZERO_BI
  }

  let pair = new Pair(event.params.pair.toHexString()) as Pair
  pair.token0 = token0.id
  pair.token1 = token1.id
  pair.liquidityProviderCount = ZERO_BI
  pair.createdAtTimestamp = event.block.timestamp
  pair.createdAtBlockNumber = event.block.number
  pair.txCount = ZERO_BI
  pair.reserve0 = ZERO_BD
  pair.reserve1 = ZERO_BD
  pair.trackedReserveNativeCurrency = ZERO_BD
  pair.reserveNativeCurrency = ZERO_BD
  pair.reserveBADGER = ZERO_BD
  pair.totalSupply = ZERO_BD
  pair.volumeToken0 = ZERO_BD
  pair.volumeToken1 = ZERO_BD
  pair.volumeBADGER = ZERO_BD
  pair.untrackedVolumeBADGER = ZERO_BD
  pair.token0Price = ZERO_BD
  pair.token1Price = ZERO_BD

  // create the tracked contract based on the template
  PairTemplate.create(event.params.pair)

  // save updated values
  token0.save()
  token1.save()
  pair.save()
  factory.save()
}
