import { Contract, Wallet } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { defaultAbiCoder } from 'ethers/utils'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import ERC20 from '../../build/ERC20.json';
import WETH9 from '../../build/WETH.json';
import DexSwapFactory from '../../build/DexSwapFactory.json';
import DexSwapPair from '../../build/DexSwapPair.json';
import DexSwapDeployer from '../../build/DexSwapDeployer.json';
import DexSwapFeeSetter from '../../build/DexSwapFeeSetter.json';
import DexSwapFeeReceiver from '../../build/DexSwapFeeReceiver.json';

interface FactoryFixture {
  factory: Contract
  feeSetter: Contract
  feeReceiver: Contract
  WETH: Contract
}

const overrides = {
  gasLimit: 9999999
}

export async function factoryFixture(provider: Web3Provider, [xdexs, ethReceiver]: Wallet[]): Promise<FactoryFixture> {
  const WETH = await deployContract(xdexs, WETH9)
  const dexSwapDeployer = await deployContract(
    xdexs, DexSwapDeployer, [ ethReceiver.address, xdexs.address, WETH.address, [], [], [], ], overrides
  ) 

  await xdexs.sendTransaction({to: dexSwapDeployer.address, gasPrice: 0, value: 1})
  const deployTx = await dexSwapDeployer.deploy()
  const deployTxReceipt = await provider.getTransactionReceipt(deployTx.hash);
  const factoryAddress = deployTxReceipt.logs !== undefined
    ? defaultAbiCoder.decode(['address'], deployTxReceipt.logs[0].data)[0]
    : null
  const factory = new Contract(factoryAddress, JSON.stringify(DexSwapFactory.abi), provider).connect(xdexs)
  const feeSetterAddress = await factory.feeToSetter()
  const feeSetter = new Contract(feeSetterAddress, JSON.stringify(DexSwapFeeSetter.abi), provider).connect(xdexs)
  const feeReceiverAddress = await factory.feeTo()
  const feeReceiver = new Contract(feeReceiverAddress, JSON.stringify(DexSwapFeeReceiver.abi), provider).connect(xdexs)
  return { factory, feeSetter, feeReceiver, WETH }
}

interface PairFixture extends FactoryFixture {
  token0: Contract
  token1: Contract
  pair: Contract
  wethPair: Contract
}

export async function pairFixture(provider: Web3Provider, [xdexs, wallet, ethReceiver]: Wallet[]): Promise<PairFixture> {
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)], overrides)
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)], overrides)
  const WETH = await deployContract(wallet, WETH9)
  await WETH.deposit({value: expandTo18Decimals(1000)})
  const token0 = tokenA.address < tokenB.address ? tokenA : tokenB
  const token1 = token0.address === tokenA.address ? tokenB : tokenA
  
  const dexSwapDeployer = await deployContract(xdexs, DexSwapDeployer, [ethReceiver.address, xdexs.address, WETH.address,
    [token0.address, token1.address],[token1.address, WETH.address], [15, 15], ], overrides
  )
  await xdexs.sendTransaction({to: dexSwapDeployer.address, gasPrice: 0, value: 1})

  const deployTx = await dexSwapDeployer.deploy()

  const deployTxReceipt = await provider.getTransactionReceipt(deployTx.hash);
  
  const factoryAddress = deployTxReceipt.logs !== undefined
    ? defaultAbiCoder.decode(['address'], deployTxReceipt.logs[0].data)[0]
    : null
  
  const factory = new Contract(factoryAddress, JSON.stringify(DexSwapFactory.abi), provider).connect(xdexs)
  const feeSetterAddress = await factory.feeToSetter()
  const feeSetter = new Contract(feeSetterAddress, JSON.stringify(DexSwapFeeSetter.abi), provider).connect(xdexs)
  const feeReceiverAddress = await factory.feeTo()
  const feeReceiver = new Contract(feeReceiverAddress, JSON.stringify(DexSwapFeeReceiver.abi), provider).connect(xdexs)
  const pair = new Contract(
     await factory.getPair(token0.address, token1.address), //DEXSWAP
     JSON.stringify(DexSwapPair.abi), provider
   ).connect(xdexs)
  const wethPair = new Contract(
     await factory.getPair(token1.address, WETH.address), //DEXSWAP -WETH PAIR
     JSON.stringify(DexSwapPair.abi), provider
   ).connect(xdexs)

  return { factory, feeSetter, feeReceiver, WETH, token0, token1, pair, wethPair }
}
