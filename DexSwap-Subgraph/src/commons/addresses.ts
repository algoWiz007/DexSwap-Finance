/* eslint-disable prefer-const */
import { dataSource, log } from '@graphprotocol/graph-ts'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export function getFactoryAddress(): string {
  let network = dataSource.network() as string
  // not using a switch-case because using strings is not yet supported (only u32)
  if (network == 'mainnet') return ADDRESS_ZERO
  if (network == 'rinkeby') return '0xd4e38c2e7b5a930d65e1e44a4ef5f72b4926a031'
  if (network == 'xdai') return ADDRESS_ZERO
  if (network == 'matic') return '0x1d2b4C065D4A34e9dc9c557B7C96529ebBf13b8e'
  log.warning('no factory address for unsupported network {}', [network])
  return ADDRESS_ZERO
}

export function getStakingRewardsFactoryAddress(): string {
  let network = dataSource.network() as string
  // not using a switch-case because using strings is not yet supported (only u32)
  if (network == 'mainnet') return ADDRESS_ZERO
  if (network == 'rinkeby') return '0x1204f1d4dd016b23b4d6a021ab9cea845ac1d728'
  if (network == 'xdai') return ADDRESS_ZERO
  if (network == 'matic') return '0x82d2b88aedc4ea78ff9899e593a28ecfbb0d2450'
  log.warning('no staking rewards factory address for unsupported network {}', [network])
  return ADDRESS_ZERO
}

export function getNativeCurrencyWrapperAddress(): string {
  let network = dataSource.network() as string
  // not using a switch-case because using strings is not yet supported (only u32)
  if (network == 'mainnet') return ADDRESS_ZERO
  if (network == 'rinkeby') return '0xc778417e063141139fce010982780140aa0cd5ab'
  if (network == 'xdai') return ADDRESS_ZERO
  if (network == 'matic') return '0x5C557E8DfB805E9b3c31b0aaD1044251aD7E9D93' //latest deploy
  log.warning('no native currency wrapper address for unsupported network {}', [network])
  return ADDRESS_ZERO
}

export function getLiquidityTrackingTokenAddresses(): string[] {
  let network = dataSource.network() as string
  // not using a switch-case because using strings is not yet supported (only u32)
  if (network == 'mainnet') {
    return [
      '0x3472a5a71965499acd81997a54bba8d852c6e53d', //BADGER
      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', //WBTC
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
      '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
      '0x0000000000085d4780b73119b644ae5ecd22b376', // TUSD
      '0xa1d65e8fb6e87b60feccbc582f7f97804b725521', // DXD
      '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643', // cDAI
      '0x39aa39c021dfbae8fac545936693ac917d5e7563', // cUSDC
      '0x0ae055097c6d159879521c384f1d2123d1f195e6', // STAKE
      '0xa117000000f279d81a1d3cc75430faa017fa5a2e', // ANT
      '0xd56dac73a4d6766464b38ec6d91eb45ce7457c44', // PAN
      '0x86fadb80d8d2cff3c3680819e4da99c10232ba0f', // EBASE
      '0x57ab1ec28d129707052df4df418d58a2d46d5f51', // sUSD
      '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', // MKR
      '0xc00e94cb662c3520282e6f5717214004a7f26888', // COMP
      '0x514910771af9ca656af840dff83e8264ecf986ca', // LINK
      '0x960b236a07cf122663c4303350609a66a7b288c0', // ANTyar
      '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f', // SNX
      '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e', // YFI
      '0xdf5e0e81dff6faf3a7e52ba697820c5e32d806a8', // yCurv
      '0xd533a949740bb3306d119cc777fa900ba034cd52' // CRV
    ]
  }
  if (network == 'rinkeby') {
    return [
      '0xa9c6d7f92a894310b9c04968326a9de6d0e38724', // xDEXS
      '0xc778417e063141139fce010982780140aa0cd5ab' // WETH
    ]
  }
  if (network == 'xdai') {
    return [
      '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d', // WXDAI
      '0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1' // WETH
    ]
  }
  if (network == 'matic') {
    return [
      '0xC3F25C140d23c00cF6248a93eC564F6f2fc96624', // xDEXS
      '0x5C557E8DfB805E9b3c31b0aaD1044251aD7E9D93', // latest deploy
      '0x4dfae612aacb5b448c12a591cd0879bfa2e51d62' // WETH MATIC
    ]
  }
  log.warning('no liquidity tracking token address for unsupported network {}', [network])
  return []
}

export function getBadgerNativeCurrencyWrapperPairAddress(): string {
  let network = dataSource.network() as string
  // not using a switch-case because using strings is not yet supported (only u32)
  if (network == 'mainnet') return ADDRESS_ZERO
  if (network == 'rinkeby') return '0x17c7427abe133b14962e16664b322b3d056e97f3' 
  if (network == 'matic') return  '0x4F20003d97072b86d398e9C233eBfc220b40BFc4'
  if (network == 'xdai') return ADDRESS_ZERO
  log.warning('no badger native currency wrapper pair address for unsupported network {}', [network])
  return ADDRESS_ZERO
}

export function getDiggNativeCurrencyWrapperPair(): string {
  let network = dataSource.network() as string
  // not using a switch-case because using strings is not yet supported (only u32)
  if (network == 'mainnet') return ADDRESS_ZERO
  if (network == 'rinkeby') return '0xCc2Dc009438931768508165452bEAFa5D391988A'
  if (network == 'xdai') return ADDRESS_ZERO
  if (network == 'matic') return ADDRESS_ZERO
  log.warning('no digg native currency wrapper pair address for unsupported network {}', [network])
  return ADDRESS_ZERO
}

export function getDaiNativeCurrencyWrapperPairAddress(): string {
  let network = dataSource.network() as string
  // not using a switch-case because using strings is not yet supported (only u32)
  if (network == 'mainnet') return ADDRESS_ZERO
  if (network == 'rinkeby') return ADDRESS_ZERO
  if (network == 'matic') return ADDRESS_ZERO
  if (network == 'xdai') return ADDRESS_ZERO
  log.warning('no dai native currency wrapper pair address for unsupported network {}', [network])
  return ADDRESS_ZERO
}


