import { Wallet, Contract } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import DexSwapFactory from '../../../dexswap-core/build/DexSwapFactory.json'
// import DexSwapFactory from '../../dexswap-core/build/DexSwapFactory.json'
import IDexSwapPair from '../../../dexswap-core/build/IDexSwapPair.json'

import ERC20 from '../../build/ERC20.json'
import WETH9 from '../../build/WETH9.json'
import DexSwapRouter from '../../build/DexSwapRouter.json'
import RouterEventEmitter from '../../build/RouterEventEmitter.json'
import DexSwapRelayer from '../../build/DexSwapRelayer.json'
import OracleCreator from '../../build/OracleCreator.json'


const overrides = {
  gasLimit: 9999999
}

interface DexSwapFixture {
  token0: Contract
  token1: Contract
  WETH: Contract
  WETHPartner: Contract
  dexSwapFactory: Contract
  routerEventEmitter: Contract
  router: Contract
  pair: Contract
  WETHPair: Contract
  dexSwapPair: Contract
  dexSwapRouter: Contract
  uniFactory: Contract
  uniRouter: Contract
  uniPair: Contract
  oracleCreator: Contract
  dexRelayer: Contract
}

export async function dexSwapFixture(provider: Web3Provider, [wallet]: Wallet[]): Promise<DexSwapFixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const WETH = await deployContract(wallet, WETH9)
  const WETHPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])

  // deploy DexSwapFactory
  const dexSwapFactory = await deployContract(wallet, DexSwapFactory, [wallet.address])

  // deploy router
  const router = await deployContract(wallet, DexSwapRouter, [dexSwapFactory.address, WETH.address], overrides)
  const dexSwapRouter = await deployContract(wallet, DexSwapRouter, [dexSwapFactory.address, WETH.address], overrides)
  const uniRouter = await deployContract(wallet, DexSwapRouter, [dexSwapFactory.address, WETH.address], overrides)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

  // initialize DexSwapFactory
  await dexSwapFactory.createPair(tokenA.address, tokenB.address)
  const pairAddress = await dexSwapFactory.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(IDexSwapPair.abi), provider).connect(wallet)
  const dexSwapPair = new Contract(pairAddress, JSON.stringify(IDexSwapPair.abi), provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  await dexSwapFactory.createPair(WETH.address, WETHPartner.address)
  const WETHPairAddress = await dexSwapFactory.getPair(WETH.address, WETHPartner.address)
  const WETHPair = new Contract(WETHPairAddress, JSON.stringify(IDexSwapPair.abi), provider).connect(wallet)

  // deploy UniswapFactory
  const uniFactory = await deployContract(wallet, DexSwapFactory, [wallet.address])

  // initialize DexSwapFactory
  await uniFactory.createPair(tokenA.address, tokenB.address)
  const uniPairAddress = await uniFactory.getPair(tokenA.address, tokenB.address)
  const uniPair = new Contract(uniPairAddress, JSON.stringify(IDexSwapPair.abi), provider).connect(wallet)

  // deploy oracleCreator
  const oracleCreator = await deployContract(wallet, OracleCreator)

  const dexRelayer = await deployContract(
    wallet,
    DexSwapRelayer,
    [wallet.address, dexSwapFactory.address, dexSwapRouter.address, uniFactory.address, uniRouter.address, WETH.address, oracleCreator.address],
    overrides
  )

  return {
    token0,
    token1,
    WETH,
    WETHPartner,
    dexSwapFactory,
    routerEventEmitter,
    router,
    pair,
    WETHPair,
    dexSwapPair,
    dexSwapRouter,
    uniFactory,
    uniRouter,
    uniPair,
    oracleCreator,
    dexRelayer
  }
}