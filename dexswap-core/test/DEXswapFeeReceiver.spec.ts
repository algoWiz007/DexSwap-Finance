import chai, { expect } from "chai";
import { Contract } from "ethers";
import { AddressZero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";
import {
    solidity,
    MockProvider,
    createFixtureLoader,
    deployContract
} from "ethereum-waffle";

import { expandTo18Decimals, getCreate2Address } from "./shared/utilities";
import { pairFixture } from "./shared/fixtures";

import DexSwapPair from "../build/DexSwapPair.json";
import ERC20 from "../build/ERC20.json";
import DexSwapFeeReceiver from "../build/DexSwapFeeReceiver.json";

const FEE_DENOMINATOR = bigNumberify(10).pow(4);
const ROUND_EXCEPTION = bigNumberify(10).pow(4);

chai.use(solidity);

const TEST_ADDRESSES: [string, string] = [
    "0x1000000000000000000000000000000000000000",
    "0x2000000000000000000000000000000000000000"
];

describe("DexSwapFeeReceiver", () => {
    const provider = new MockProvider({
        hardfork: "istanbul",
        mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
        gasLimit: 9999999
    });
    const overrides = {
        gasLimit: 9999999
    };
    const [xdexs, wallet, protocolFeeReceiver, other] = provider.getWallets();
    const loadFixture = createFixtureLoader(provider, [
        xdexs,
        wallet,
        protocolFeeReceiver
    ]);

    async function getAmountOut(
        pair: Contract,
        tokenIn: string,
        amountIn: BigNumber
    ) {
        const [reserve0, reserve1] = await pair.getReserves();
        const token0 = await pair.token0();
        return getAmountOutSync(
            reserve0,
            reserve1,
            token0 === tokenIn,
            amountIn,
            await pair.swapFee()
        );
    }

    function getAmountOutSync(
        reserve0: BigNumber,
        reserve1: BigNumber,
        usingToken0: boolean,
        amountIn: BigNumber,
        swapFee: BigNumber
    ) {
        const tokenInBalance = usingToken0 ? reserve0 : reserve1;
        const tokenOutBalance = usingToken0 ? reserve1 : reserve0;
        const amountInWithFee = amountIn.mul(FEE_DENOMINATOR.sub(swapFee));
        return amountInWithFee
            .mul(tokenOutBalance)
            .div(tokenInBalance.mul(FEE_DENOMINATOR).add(amountInWithFee));
    }

    // Calculate how much will be payed from liquidity as protocol fee in the next mint/burn
    async function calcProtocolFee(pair: Contract) {
        const [token0Reserve, token1Reserve, _] = await pair.getReserves();
        const kLast = await pair.kLast();
        const feeTo = await factory.feeTo();
        const protocolFeeDenominator = await factory.protocolFeeDenominator();
        const totalSupply = await pair.totalSupply();
        let rootK, rootKLast;
        if (feeTo != AddressZero) {
            // Check for math overflow when dealing with big big balances
            if (
                Math.sqrt(token0Reserve.mul(token1Reserve)) > Math.pow(10, 19)
            ) {
                const denominator =
                    10 **
                    (Number(
                        Math.log10(
                            Math.sqrt(token0Reserve.mul(token1Reserve))
                        ).toFixed(0)
                    ) -
                        18);
                rootK = bigNumberify(
                    (
                        Math.sqrt(token0Reserve.mul(token1Reserve)) /
                        denominator
                    ).toString()
                );
                rootKLast = bigNumberify(
                    (Math.sqrt(kLast) / denominator).toString()
                );
            } else {
                rootK = bigNumberify(
                    Math.sqrt(token0Reserve.mul(token1Reserve)).toString()
                );
                rootKLast = bigNumberify(Math.sqrt(kLast).toString());
            }

            return totalSupply
                .mul(rootK.sub(rootKLast))
                .div(rootK.mul(protocolFeeDenominator).add(rootKLast));
        } else {
            return bigNumberify(0);
        }
    }

    let factory: Contract;
    let token0: Contract;
    let token1: Contract;
    let pair: Contract;
    let wethPair: Contract;
    let WETH: Contract;
    let feeSetter: Contract;
    let feeReceiver: Contract;
    beforeEach(async () => {
        const fixture = await loadFixture(pairFixture);
        factory = fixture.factory;
        token0 = fixture.token0;
        token1 = fixture.token1;
        pair = fixture.pair;
        wethPair = fixture.wethPair;
        WETH = fixture.WETH;
        feeSetter = fixture.feeSetter;
        feeReceiver = fixture.feeReceiver;
    });

    // Where token0-token1 and token1-WETH pairs exist
    it("should receive token0 to fallbackreceiver and ETH to ethReceiver when extracting fee from token0-token1", async () => {
        const tokenAmount = expandTo18Decimals(100);
        const wethAmount = expandTo18Decimals(100);
        const amountIn = expandTo18Decimals(10);

        await token0.transfer(pair.address, tokenAmount);
        await token1.transfer(pair.address, tokenAmount);
        await pair.mint(wallet.address, overrides);

        await token1.transfer(wethPair.address, tokenAmount);
        await WETH.transfer(wethPair.address, wethAmount);
        await wethPair.mint(wallet.address, overrides);

        let amountOut = await getAmountOut(pair, token0.address, amountIn);

        await token0.transfer(pair.address, amountIn);
        await pair.swap(0, amountOut, wallet.address, "0x", overrides);

        amountOut = await getAmountOut(pair, token1.address, amountIn);
        await token1.transfer(pair.address, amountIn);
        await pair.swap(amountOut, 0, wallet.address, "0x", overrides);

        const protocolFeeToReceive = await calcProtocolFee(pair);

        await token0.transfer(pair.address, expandTo18Decimals(10));
        await token1.transfer(pair.address, expandTo18Decimals(10));
        await pair.mint(wallet.address, overrides);

        const protocolFeeLPToknesReceived = await pair.balanceOf(
            feeReceiver.address
        );
        expect(protocolFeeLPToknesReceived.div(ROUND_EXCEPTION)).to.be.eq(
            protocolFeeToReceive.div(ROUND_EXCEPTION)
        );

        const token0FromProtocolFee = protocolFeeLPToknesReceived
            .mul(await token0.balanceOf(pair.address))
            .div(await pair.totalSupply());
        const token1FromProtocolFee = protocolFeeLPToknesReceived
            .mul(await token1.balanceOf(pair.address))
            .div(await pair.totalSupply());

        const wethFromToken1FromProtocolFee = await getAmountOut(
            wethPair,
            token1.address,
            token1FromProtocolFee
        );

        const protocolFeeReceiverBalanceBeforeTake = await provider.getBalance(
            protocolFeeReceiver.address
        );

        await feeReceiver
            .connect(wallet)
            .takeProtocolFee([pair.address], overrides);

        expect(await token0.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await token1.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await WETH.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await pair.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await provider.getBalance(feeReceiver.address)).to.eq(0);

        expect(await provider.getBalance(protocolFeeReceiver.address)).to.be.eq(
            protocolFeeReceiverBalanceBeforeTake.add(
                wethFromToken1FromProtocolFee
            )
        );
        expect(await token0.balanceOf(xdexs.address)).to.be.eq(
            token0FromProtocolFee
        );
    });

    it("should receive everything in ETH from one WETH-token1 pair", async () => {
        const tokenAmount = expandTo18Decimals(100);
        const wethAmount = expandTo18Decimals(100);
        const amountIn = expandTo18Decimals(50);

        await token1.transfer(wethPair.address, tokenAmount);
        await WETH.transfer(wethPair.address, wethAmount);
        await wethPair.mint(wallet.address, overrides);

        const token1IsFirstToken = token1.address < WETH.address;

        let amountOut = await getAmountOut(wethPair, token1.address, amountIn);
        await token1.transfer(wethPair.address, amountIn);
        await wethPair.swap(
            token1IsFirstToken ? 0 : amountOut,
            token1IsFirstToken ? amountOut : 0,
            wallet.address,
            "0x",
            overrides
        );

        amountOut = await getAmountOut(wethPair, WETH.address, amountIn);
        await WETH.transfer(wethPair.address, amountIn);
        await wethPair.swap(
            token1IsFirstToken ? amountOut : 0,
            token1IsFirstToken ? 0 : amountOut,
            wallet.address,
            "0x",
            overrides
        );

        const protocolFeeToReceive = await calcProtocolFee(wethPair);

        await token1.transfer(wethPair.address, expandTo18Decimals(10));
        await WETH.transfer(wethPair.address, expandTo18Decimals(10));
        await wethPair.mint(wallet.address, overrides);

        const protocolFeeLPToknesReceived = await wethPair.balanceOf(
            feeReceiver.address
        );
        expect(protocolFeeLPToknesReceived.div(ROUND_EXCEPTION)).to.be.eq(
            protocolFeeToReceive.div(ROUND_EXCEPTION)
        );

        const token1FromProtocolFee = protocolFeeLPToknesReceived
            .mul(await token1.balanceOf(wethPair.address))
            .div(await wethPair.totalSupply());
        const wethFromProtocolFee = protocolFeeLPToknesReceived
            .mul(await WETH.balanceOf(wethPair.address))
            .div(await wethPair.totalSupply());

        const token1ReserveBeforeSwap = (
            await token1.balanceOf(wethPair.address)
        ).sub(token1FromProtocolFee);
        const wethReserveBeforeSwap = (
            await WETH.balanceOf(wethPair.address)
        ).sub(wethFromProtocolFee);
        const wethFromToken1FromProtocolFee = await getAmountOutSync(
            token1IsFirstToken
                ? token1ReserveBeforeSwap
                : wethReserveBeforeSwap,
            token1IsFirstToken
                ? wethReserveBeforeSwap
                : token1ReserveBeforeSwap,
            token1IsFirstToken,
            token1FromProtocolFee,
            await wethPair.swapFee()
        );

        const protocolFeeReceiverBalanceBeforeTake = await provider.getBalance(
            protocolFeeReceiver.address
        );

        await feeReceiver
            .connect(wallet)
            .takeProtocolFee([wethPair.address], overrides);

        expect(await token1.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await WETH.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await wethPair.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await provider.getBalance(feeReceiver.address)).to.eq(0);
        expect(await token1.balanceOf(xdexs.address)).to.be.eq(0);
        expect(await provider.getBalance(protocolFeeReceiver.address)).to.be.eq(
            protocolFeeReceiverBalanceBeforeTake
                .add(wethFromToken1FromProtocolFee)
                .add(wethFromProtocolFee)
        );
    });

    it("should receive only tokens when extracting fee from tokenA-tokenB pair that has no path to WETH", async () => {
        const tokenA = await deployContract(
            wallet,
            ERC20,
            [expandTo18Decimals(10000)],
            overrides
        );
        const tokenB = await deployContract(
            wallet,
            ERC20,
            [expandTo18Decimals(10000)],
            overrides
        );

        const tokenAmount = expandTo18Decimals(100);
        const amountIn = expandTo18Decimals(50);

        await factory.createPair(tokenA.address, tokenB.address);
        const tokenATokenBPair = new Contract(
            await factory.getPair(
                tokenA.address < tokenB.address
                    ? tokenA.address
                    : tokenB.address,
                tokenA.address < tokenB.address
                    ? tokenB.address
                    : tokenA.address
            ),
            JSON.stringify(DexSwapPair.abi),
            provider
        ).connect(wallet);

        await tokenA.transfer(tokenATokenBPair.address, tokenAmount);
        await tokenB.transfer(tokenATokenBPair.address, tokenAmount);
        await tokenATokenBPair.mint(wallet.address, overrides);

        let amountOut = await getAmountOut(
            tokenATokenBPair,
            tokenA.address,
            amountIn
        );
        await tokenA.transfer(tokenATokenBPair.address, amountIn);
        await tokenATokenBPair.swap(
            tokenA.address < tokenB.address ? 0 : amountOut,
            tokenA.address < tokenB.address ? amountOut : 0,
            wallet.address,
            "0x",
            overrides
        );

        amountOut = await getAmountOut(
            tokenATokenBPair,
            tokenB.address,
            amountIn
        );
        await tokenB.transfer(tokenATokenBPair.address, amountIn);
        await tokenATokenBPair.swap(
            tokenA.address < tokenB.address ? amountOut : 0,
            tokenA.address < tokenB.address ? 0 : amountOut,
            wallet.address,
            "0x",
            overrides
        );

        const protocolFeeToReceive = await calcProtocolFee(tokenATokenBPair);

        await tokenA.transfer(tokenATokenBPair.address, expandTo18Decimals(10));
        await tokenB.transfer(tokenATokenBPair.address, expandTo18Decimals(10));
        await tokenATokenBPair.mint(wallet.address, overrides);

        const protocolFeeLPTokenAtokenBPair = await tokenATokenBPair.balanceOf(
            feeReceiver.address
        );
        expect(protocolFeeLPTokenAtokenBPair.div(ROUND_EXCEPTION)).to.be.eq(
            protocolFeeToReceive.div(ROUND_EXCEPTION)
        );

        const tokenAFromProtocolFee = protocolFeeLPTokenAtokenBPair
            .mul(await tokenA.balanceOf(tokenATokenBPair.address))
            .div(await tokenATokenBPair.totalSupply());
        const tokenBFromProtocolFee = protocolFeeLPTokenAtokenBPair
            .mul(await tokenB.balanceOf(tokenATokenBPair.address))
            .div(await tokenATokenBPair.totalSupply());

        const protocolFeeReceiverBalance = await provider.getBalance(
            protocolFeeReceiver.address
        );

        await feeReceiver
            .connect(wallet)
            .takeProtocolFee([tokenATokenBPair.address], overrides);

        expect(await tokenA.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await tokenB.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await WETH.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await tokenATokenBPair.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await provider.getBalance(feeReceiver.address)).to.eq(0);

        expect(await provider.getBalance(protocolFeeReceiver.address)).to.be.eq(
            protocolFeeReceiverBalance
        );
        expect(await tokenA.balanceOf(xdexs.address)).to.be.eq(
            tokenAFromProtocolFee
        );
        expect(await tokenB.balanceOf(xdexs.address)).to.be.eq(
            tokenBFromProtocolFee
        );
    });

    it("should receive only tokens when extracting fee from both tokenA-tonkenB pair and tokenC-tokenD pair", async () => {
        const tokenAmount = expandTo18Decimals(100);
        const amountIn = expandTo18Decimals(50);

        // Set up tokenA-tokenB
        const tokenA = await deployContract(
            wallet,
            ERC20,
            [expandTo18Decimals(10000)],
            overrides
        );
        const tokenB = await deployContract(
            wallet,
            ERC20,
            [expandTo18Decimals(10000)],
            overrides
        );

        await factory.createPair(tokenA.address, tokenB.address);
        const tokenATokenBPair = new Contract(
            await factory.getPair(
                tokenA.address < tokenB.address
                    ? tokenA.address
                    : tokenB.address,
                tokenA.address < tokenB.address
                    ? tokenB.address
                    : tokenA.address
            ),
            JSON.stringify(DexSwapPair.abi),
            provider
        ).connect(wallet);

        await tokenA.transfer(tokenATokenBPair.address, tokenAmount);
        await tokenB.transfer(tokenATokenBPair.address, tokenAmount);
        await tokenATokenBPair.mint(wallet.address, overrides);

        let amountOut = await getAmountOut(
            tokenATokenBPair,
            tokenA.address,
            amountIn
        );
        await tokenA.transfer(tokenATokenBPair.address, amountIn);
        await tokenATokenBPair.swap(
            tokenA.address < tokenB.address ? 0 : amountOut,
            tokenA.address < tokenB.address ? amountOut : 0,
            wallet.address,
            "0x",
            overrides
        );

        amountOut = await getAmountOut(
            tokenATokenBPair,
            tokenB.address,
            amountIn
        );
        await tokenB.transfer(tokenATokenBPair.address, amountIn);
        await tokenATokenBPair.swap(
            tokenA.address < tokenB.address ? amountOut : 0,
            tokenA.address < tokenB.address ? 0 : amountOut,
            wallet.address,
            "0x",
            overrides
        );

        let protocolFeeToReceive = await calcProtocolFee(tokenATokenBPair);

        await tokenA.transfer(tokenATokenBPair.address, expandTo18Decimals(10));
        await tokenB.transfer(tokenATokenBPair.address, expandTo18Decimals(10));
        await tokenATokenBPair.mint(wallet.address, overrides);

        const protocolFeeLPTokenAtokenBPair = await tokenATokenBPair.balanceOf(
            feeReceiver.address
        );
        expect(protocolFeeLPTokenAtokenBPair.div(ROUND_EXCEPTION)).to.be.eq(
            protocolFeeToReceive.div(ROUND_EXCEPTION)
        );

        // Set up tokenC-tokenD pair
        const tokenC = await deployContract(
            wallet,
            ERC20,
            [expandTo18Decimals(10000)],
            overrides
        );
        const tokenD = await deployContract(
            wallet,
            ERC20,
            [expandTo18Decimals(10000)],
            overrides
        );

        await factory.createPair(tokenC.address, tokenD.address);
        const tokenCTokenDPair = new Contract(
            await factory.getPair(
                tokenC.address < tokenD.address
                    ? tokenC.address
                    : tokenD.address,
                tokenC.address < tokenD.address
                    ? tokenD.address
                    : tokenC.address
            ),
            JSON.stringify(DexSwapPair.abi),
            provider
        ).connect(wallet);

        await tokenC.transfer(tokenCTokenDPair.address, tokenAmount);
        await tokenD.transfer(tokenCTokenDPair.address, tokenAmount);
        await tokenCTokenDPair.mint(wallet.address, overrides);

        amountOut = await getAmountOut(
            tokenCTokenDPair,
            tokenC.address,
            amountIn
        );
        await tokenC.transfer(tokenCTokenDPair.address, amountIn);
        await tokenCTokenDPair.swap(
            tokenC.address < tokenD.address ? 0 : amountOut,
            tokenC.address < tokenD.address ? amountOut : 0,
            wallet.address,
            "0x",
            overrides
        );

        amountOut = await getAmountOut(
            tokenCTokenDPair,
            tokenD.address,
            amountIn
        );
        await tokenD.transfer(tokenCTokenDPair.address, amountIn);
        await tokenCTokenDPair.swap(
            tokenC.address < tokenD.address ? amountOut : 0,
            tokenC.address < tokenD.address ? 0 : amountOut,
            wallet.address,
            "0x",
            overrides
        );

        protocolFeeToReceive = await calcProtocolFee(tokenCTokenDPair);

        await tokenC.transfer(tokenCTokenDPair.address, expandTo18Decimals(10));
        await tokenD.transfer(tokenCTokenDPair.address, expandTo18Decimals(10));
        await tokenCTokenDPair.mint(wallet.address, overrides);

        const protocolFeeLPTokenCtokenDPair = await tokenCTokenDPair.balanceOf(
            feeReceiver.address
        );
        expect(protocolFeeLPTokenCtokenDPair.div(ROUND_EXCEPTION)).to.be.eq(
            protocolFeeToReceive.div(ROUND_EXCEPTION)
        );

        const tokenAFromProtocolFee = protocolFeeLPTokenAtokenBPair
            .mul(await tokenA.balanceOf(tokenATokenBPair.address))
            .div(await tokenATokenBPair.totalSupply());
        const tokenBFromProtocolFee = protocolFeeLPTokenAtokenBPair
            .mul(await tokenB.balanceOf(tokenATokenBPair.address))
            .div(await tokenATokenBPair.totalSupply());
        const tokenCFromProtocolFee = protocolFeeLPTokenCtokenDPair
            .mul(await tokenC.balanceOf(tokenCTokenDPair.address))
            .div(await tokenCTokenDPair.totalSupply());
        const tokenDFromProtocolFee = protocolFeeLPTokenCtokenDPair
            .mul(await tokenD.balanceOf(tokenCTokenDPair.address))
            .div(await tokenCTokenDPair.totalSupply());

        const protocolFeeReceiverBalance = await provider.getBalance(
            protocolFeeReceiver.address
        );

        await feeReceiver
            .connect(wallet)
            .takeProtocolFee(
                [tokenATokenBPair.address, tokenCTokenDPair.address],
                overrides
            );

        expect(await provider.getBalance(protocolFeeReceiver.address)).to.eq(
            protocolFeeReceiverBalance.toString()
        );

        expect(await tokenA.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await tokenB.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await tokenC.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await tokenD.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await WETH.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await pair.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await provider.getBalance(feeReceiver.address)).to.eq(0);

        expect(await provider.getBalance(protocolFeeReceiver.address)).to.be.eq(
            protocolFeeReceiverBalance
        );
        expect(await tokenA.balanceOf(xdexs.address)).to.be.eq(
            tokenAFromProtocolFee
        );
        expect(await tokenB.balanceOf(xdexs.address)).to.be.eq(
            tokenBFromProtocolFee
        );
        expect(await tokenC.balanceOf(xdexs.address)).to.be.eq(
            tokenCFromProtocolFee
        );
        expect(await tokenD.balanceOf(xdexs.address)).to.be.eq(
            tokenDFromProtocolFee
        );
    });

    it("should only allow owner to transfer ownership", async () => {
        await expect(
            feeReceiver.connect(other).transferOwnership(other.address)
        ).to.be.revertedWith("DexSwapFeeReceiver: FORBIDDEN");
        await feeReceiver.connect(xdexs).transferOwnership(other.address);
        expect(await feeReceiver.owner()).to.be.eq(other.address);
    });

    it("should only allow owner to change receivers", async () => {
        await expect(
            feeReceiver
                .connect(other)
                .changeReceivers(other.address, other.address)
        ).to.be.revertedWith("DexSwapFeeReceiver: FORBIDDEN");
        await feeReceiver
            .connect(xdexs)
            .changeReceivers(other.address, other.address);
        expect(await feeReceiver.ethReceiver()).to.be.eq(other.address);
        expect(await feeReceiver.fallbackReceiver()).to.be.eq(other.address);
    });

    it("should revert with insufficient liquidity error if there is not any liquidity in the WETH pair", async () => {
        const tokenAmount = expandTo18Decimals(100);
        const wethAmount = expandTo18Decimals(100);
        const amountIn = expandTo18Decimals(50);

        await token0.transfer(pair.address, tokenAmount);
        await token1.transfer(pair.address, tokenAmount);
        await pair.mint(wallet.address, overrides);

        let amountOut = await getAmountOut(pair, token0.address, amountIn);
        await token0.transfer(pair.address, amountIn);
        await pair.swap(0, amountOut, wallet.address, "0x", overrides);

        amountOut = await getAmountOut(pair, token1.address, amountIn);
        await token1.transfer(pair.address, amountIn);
        await pair.swap(amountOut, 0, wallet.address, "0x", overrides);

        const protocolFeeToReceive = await calcProtocolFee(pair);

        await token0.transfer(pair.address, expandTo18Decimals(10));
        await token1.transfer(pair.address, expandTo18Decimals(10));
        await pair.mint(wallet.address, overrides);

        const protocolFeeLPToknesReceived = await pair.balanceOf(
            feeReceiver.address
        );
        expect(protocolFeeLPToknesReceived.div(ROUND_EXCEPTION)).to.be.eq(
            protocolFeeToReceive.div(ROUND_EXCEPTION)
        );

        const protocolFeeReceiverBalance = await provider.getBalance(
            protocolFeeReceiver.address
        );

        await expect(
            feeReceiver
                .connect(wallet)
                .takeProtocolFee([pair.address], overrides)
        ).to.be.revertedWith("DexSwapFeeReceiver: INSUFFICIENT_LIQUIDITY");

        expect(await pair.balanceOf(feeReceiver.address)).to.eq(
            protocolFeeLPToknesReceived
        );
        expect(await token0.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await token1.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await WETH.balanceOf(feeReceiver.address)).to.eq(0);
        expect(await provider.getBalance(feeReceiver.address)).to.eq(0);

        expect(await provider.getBalance(protocolFeeReceiver.address)).to.be.eq(
            protocolFeeReceiverBalance
        );
        expect(await token0.balanceOf(xdexs.address)).to.be.eq(0);
        expect(await token1.balanceOf(xdexs.address)).to.be.eq(0);
    });
});
