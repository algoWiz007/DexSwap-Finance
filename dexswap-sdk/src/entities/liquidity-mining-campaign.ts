import { BigintIsh, ChainId, SECONDS_IN_YEAR } from '../constants'
import JSBI from 'jsbi'
import { parseBigintIsh } from '../utils'
import { CurrencyAmount, Fraction, Percent, TokenAmount } from './fractions'
import { PricedTokenAmount } from './fractions/priced-token-amount'
import { Pair } from './pair'
import invariant from 'tiny-invariant'
import { utils } from 'ethers'
import { Token } from './token'

// this value is used as a floor to calculate apy, in order to avoid infinite results
const MINIMUM_STAKED_AMOUNT_NATIVE_CURRENCY: { [chainId in ChainId]: CurrencyAmount } = {
  [ChainId.RINKEBY]: CurrencyAmount.nativeCurrency(
    utils.parseUnits('0.05', Token.getNative(ChainId.RINKEBY).decimals).toString(),
    ChainId.RINKEBY
  ),
  [ChainId.MAINNET]: CurrencyAmount.nativeCurrency(
    utils.parseUnits('0.1', Token.getNative(ChainId.MAINNET).decimals).toString(),
    ChainId.MAINNET
  ),
  [ChainId.XDAI]: CurrencyAmount.nativeCurrency(
    utils.parseUnits('1000', Token.getNative(ChainId.XDAI).decimals).toString(),
    ChainId.XDAI
  ),
  [ChainId.MATIC]: CurrencyAmount.nativeCurrency(
    utils.parseUnits('1000', Token.getNative(ChainId.MATIC).decimals).toString(),
    ChainId.MATIC
  )
}

export class LiquidityMiningCampaign {
  public readonly chainId: ChainId
  public readonly address?: string
  public readonly startsAt: BigintIsh
  public readonly endsAt: BigintIsh
  public readonly rewards: PricedTokenAmount[]
  public readonly targetedPair: Pair
  public readonly staked: PricedTokenAmount
  public readonly duration: BigintIsh
  public readonly locked: boolean
  public readonly stakingCap: TokenAmount

  constructor(
    startsAt: BigintIsh,
    endsAt: BigintIsh,
    targetedPair: Pair,
    rewards: PricedTokenAmount[],
    staked: PricedTokenAmount,
    locked: boolean,
    stakingCap: TokenAmount,
    address?: string
  ) {
    invariant(JSBI.lessThan(parseBigintIsh(startsAt), parseBigintIsh(endsAt)), 'INCONSISTENT_DATES')
    invariant(staked.token.equals(targetedPair.liquidityToken), 'STAKED_LP_TOKEN')
    for (const reward of rewards) {
      invariant(staked.token.chainId === reward.token.chainId, 'CHAIN_ID')
    }
    this.chainId = staked.token.chainId
    this.startsAt = startsAt
    this.endsAt = endsAt
    this.rewards = rewards
    this.targetedPair = targetedPair
    this.staked = staked
    this.duration = JSBI.subtract(parseBigintIsh(endsAt), parseBigintIsh(startsAt))
    this.locked = locked
    this.stakingCap = stakingCap
    this.address = address
  }

  public get remainingDistributionPercentage(): Percent {
    const now = JSBI.BigInt(Math.floor(Date.now() / 1000))
    const jsbiStartsAt = parseBigintIsh(this.startsAt)
    const jsbiEndsAt = parseBigintIsh(this.endsAt)
    if (JSBI.lessThan(now, jsbiStartsAt)) return new Percent('100', '100')
    if (JSBI.greaterThanOrEqual(now, jsbiEndsAt)) return new Percent('0', '100')
    return new Percent(JSBI.subtract(jsbiEndsAt, now), this.duration)
  }

  public get remainingRewards(): PricedTokenAmount[] {
    const remainingDistributionPercentage = this.remainingDistributionPercentage
    return this.rewards.map(reward => {
      return new PricedTokenAmount(reward.token, remainingDistributionPercentage.multiply(reward.raw).toFixed(0))
    })
  }

  public get apy(): Percent {
    const remainingRewards = this.remainingRewards

    let stakedValueNativeCurrency = this.staked.nativeCurrencyAmount
    if (stakedValueNativeCurrency.lessThan(MINIMUM_STAKED_AMOUNT_NATIVE_CURRENCY[this.chainId])) {
      stakedValueNativeCurrency = MINIMUM_STAKED_AMOUNT_NATIVE_CURRENCY[this.chainId]
    }

    const cumulativeRemainingRewardAmountNativeCurrency = remainingRewards.reduce(
      (accumulator, remainingRewardAmount) => {
        return accumulator.add(remainingRewardAmount.nativeCurrencyAmount)
      },
      CurrencyAmount.nativeCurrency('0', this.chainId)
    )

    const yieldInPeriod = cumulativeRemainingRewardAmountNativeCurrency.divide(stakedValueNativeCurrency)
    const annualizationMultiplier = new Fraction(SECONDS_IN_YEAR.toString(), this.duration.toString())
    const rawApy = yieldInPeriod.multiply(annualizationMultiplier)
    return new Percent(rawApy.numerator, rawApy.denominator)
  }

  public get currentlyActive(): boolean {
    const now = JSBI.BigInt(Math.floor(Date.now() / 1000))
    return (
      JSBI.lessThanOrEqual(parseBigintIsh(this.startsAt), now) && JSBI.greaterThan(parseBigintIsh(this.endsAt), now)
    )
  }

  public get ended(): boolean {
    return JSBI.greaterThan(JSBI.BigInt(Math.floor(Date.now() / 1000)), parseBigintIsh(this.endsAt))
  }
}
