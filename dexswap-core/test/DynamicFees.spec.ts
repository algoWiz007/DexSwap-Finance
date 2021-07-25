import chai, { expect } from "chai";
import { Contract } from "ethers";
import { solidity, MockProvider, createFixtureLoader } from "ethereum-waffle";
import { BigNumber, bigNumberify } from "ethers/utils";

import { expandTo18Decimals, mineBlock, encodePrice } from "./shared/utilities";
import { pairFixture } from "./shared/fixtures";
import { AddressZero } from "ethers/constants";

const MINIMUM_LIQUIDITY = bigNumberify(10).pow(3);
const SWAP_DEN = bigNumberify(10000);

// Using a Round error exception of 0.00000000000001 in ETH Unit, this equals 10000 in WEI unit, same value used as denominator for swap fee calculation
const ROUND_EXCEPTION = bigNumberify(10000);

chai.use(solidity);

const overrides = {
    gasLimit: 9999999
};

describe("DynamicFees", () => {
    const provider = new MockProvider({
        hardfork: "istanbul",
        mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
        gasLimit: 9999999
    });
    const [xdexs, wallet, protocolFeeReceiver, other] = provider.getWallets();
    const loadFixture = createFixtureLoader(provider, [
        xdexs,
        wallet,
        protocolFeeReceiver
    ]);

    let factory: Contract;
    let token0: Contract;
    let token1: Contract;
    let pair: Contract;
    let feeSetter: Contract;

    beforeEach(async () => {
        const fixture = await loadFixture(pairFixture);
        factory = fixture.factory;
        token0 = fixture.token0;
        token1 = fixture.token1;
        pair = fixture.pair;
        feeSetter = fixture.feeSetter;
    });

    // Adds liquidity to the token pair
    async function addLiquidity(
        token0Amount: BigNumber,
        token1Amount: BigNumber
    ) {
        await token0.transfer(pair.address, token0Amount);
        await token1.transfer(pair.address, token1Amount);
        await pair.mint(wallet.address, overrides);
    }

    // Calculate the total supply based on actual reserves
    async function calcTotalSupply() {
        const [token0Reserve, token1Reserve, _] = await pair.getReserves();
        return bigNumberify(
            Math.sqrt(token0Reserve.mul(token1Reserve)).toString()
        );
    }

    // Calculate how much will be payed from liquidity as protocol fee in the next mint/burn
    async function calcProtocolFee() {
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

    // Calculate the output of tokens for an specific input
    async function calcOutput(token0In: BigNumber, token1In: BigNumber) {
        const reserves = await pair.getReserves();
        const token0Reserve = reserves[0];
        const token1Reserve = reserves[1];
        const swapFee = await pair.swapFee();
        const kReserve = token0Reserve.mul(token1Reserve);

        const token0Out = token0Reserve
            .sub(
                kReserve.div(
                    token1Reserve.add(
                        token1In.mul(SWAP_DEN.sub(swapFee)).div(SWAP_DEN)
                    )
                )
            )
            .sub(bigNumberify(1));
        const token1Out = token1Reserve
            .sub(
                kReserve.div(
                    token0Reserve.add(
                        token0In.mul(SWAP_DEN.sub(swapFee)).div(SWAP_DEN)
                    )
                )
            )
            .sub(bigNumberify(1));

        return [
            token0Out < 0 ? bigNumberify(0) : token0Out,
            token1Out < 0 ? bigNumberify(0) : token1Out
        ];
    }

    // Execute a transfer and swap, since the tokens has to be transfered before traded
    async function execTransferAndSwap(
        _token0In: BigNumber,
        _token1In: BigNumber
    ) {
        const reserveBefore = await pair.getReserves();

        if (_token0In.gt(0)) await token0.transfer(pair.address, _token0In);
        if (_token1In.gt(0)) await token1.transfer(pair.address, _token1In);
        const outputs = await calcOutput(_token0In, _token1In);
        await pair.swap(
            outputs[0],
            outputs[1],
            wallet.address,
            "0x",
            overrides
        );

        // Check value swaped between wallet and pair
        expect(await token0.balanceOf(pair.address)).to.eq(
            reserveBefore[0].add(_token0In).sub(outputs[0])
        );
        expect(await token1.balanceOf(pair.address)).to.eq(
            reserveBefore[1].add(_token1In).sub(outputs[1])
        );
        const totalSupplyToken0 = await token0.totalSupply();
        const totalSupplyToken1 = await token1.totalSupply();
        expect(await token0.balanceOf(wallet.address)).to.eq(
            totalSupplyToken0
                .sub(reserveBefore[0])
                .sub(_token0In)
                .add(outputs[0])
        );
        expect(await token1.balanceOf(wallet.address)).to.eq(
            totalSupplyToken1
                .sub(reserveBefore[1])
                .sub(_token1In)
                .add(outputs[1])
        );

        return outputs;
    }

    it("feeTo:on, swapFee:default, protocolFeeDenominator:default", async () => {
        await feeSetter.setFeeTo(other.address);
        expect(await factory.protocolFeeDenominator()).to.eq(9);

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));

        await execTransferAndSwap(expandTo18Decimals(1), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(1));

        const toMintForProtocol = await calcProtocolFee();

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));
        expect(
            (await pair.balanceOf(other.address)).div(ROUND_EXCEPTION)
        ).to.eq(toMintForProtocol.div(ROUND_EXCEPTION));
    });

    it("feeTo:on, swapFee:default, protocolFeeDenominator:0.025%", async () => {
        await feeSetter.setFeeTo(other.address);
        await feeSetter.setProtocolFee(11);
        expect(await factory.protocolFeeDenominator()).to.eq(11);

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));

        await execTransferAndSwap(expandTo18Decimals(1), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(1));
        await execTransferAndSwap(expandTo18Decimals(2), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(2));
        await execTransferAndSwap(expandTo18Decimals(4), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(4));
        await execTransferAndSwap(expandTo18Decimals(6), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(6));

        const toMintForProtocol = await calcProtocolFee();

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));
        expect(
            (await pair.balanceOf(other.address)).div(ROUND_EXCEPTION)
        ).to.eq(toMintForProtocol.div(ROUND_EXCEPTION));
    });

    it("feeTo:on, swapFee:0.2%, protocolFeeDenominator:0.1%", async () => {
        await feeSetter.setFeeTo(other.address);
        await feeSetter.setProtocolFee(1);
        await feeSetter.setSwapFee(pair.address, 20);
        expect(await factory.protocolFeeDenominator()).to.eq(1);
        expect(await pair.swapFee()).to.eq(20);

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));

        await execTransferAndSwap(expandTo18Decimals(1), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(1));
        await execTransferAndSwap(expandTo18Decimals(2), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(2));

        const toMintForProtocol = await calcProtocolFee();

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));
        expect(
            (await pair.balanceOf(other.address)).div(ROUND_EXCEPTION)
        ).to.eq(toMintForProtocol.div(ROUND_EXCEPTION));
    });

    it("feeTo:on, swapFee:0.2%, protocolFeeDenominator:disabled", async () => {
        await feeSetter.setSwapFee(pair.address, 20);
        expect(await factory.protocolFeeDenominator()).to.eq(9);
        expect(await pair.swapFee()).to.eq(20);

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));

        await execTransferAndSwap(expandTo18Decimals(1), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(1));
        await execTransferAndSwap(expandTo18Decimals(2), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(2));

        const toMintForProtocol = await calcProtocolFee();

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));
        expect(
            (await pair.balanceOf(other.address)).div(ROUND_EXCEPTION)
        ).to.eq(0);
    });

    it("MULTIPLE_TRADES:feeTo:on, swapFee:default, protocolFeeDenominator:default", async () => {
        await feeSetter.setFeeTo(other.address);

        await addLiquidity(expandTo18Decimals(800), expandTo18Decimals(10));

        await execTransferAndSwap(expandTo18Decimals(100), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(50));
        await execTransferAndSwap(expandTo18Decimals(20), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(200));
        await execTransferAndSwap(expandTo18Decimals(40), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(66));
        await execTransferAndSwap(expandTo18Decimals(1), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(5));

        const toMintForProtocol = await calcProtocolFee();

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));
        expect(
            (await pair.balanceOf(other.address)).div(ROUND_EXCEPTION)
        ).to.eq(toMintForProtocol.div(ROUND_EXCEPTION));
    });

    it("MULTIPLE_TRADES:feeTo:on, swapFee:0.01, protocolFeeDenominator:0.0005", async () => {
        await feeSetter.setFeeTo(other.address);
        await feeSetter.setSwapFee(pair.address, 1);
        await feeSetter.setProtocolFee(19);
        expect(await factory.protocolFeeDenominator()).to.eq(19);
        expect(await pair.swapFee()).to.eq(1);

        await addLiquidity(expandTo18Decimals(800), expandTo18Decimals(10));

        await execTransferAndSwap(expandTo18Decimals(100), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(50));
        await execTransferAndSwap(expandTo18Decimals(20), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(200));
        await execTransferAndSwap(expandTo18Decimals(40), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(66));
        await execTransferAndSwap(expandTo18Decimals(1), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(5));

        const toMintForProtocol = await calcProtocolFee();

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));
        expect(
            (await pair.balanceOf(other.address)).div(ROUND_EXCEPTION)
        ).to.eq(toMintForProtocol.div(ROUND_EXCEPTION));
    });

    it("MULTIPLE_TRADES:feeTo:on, swapFee:0, protocolFeeDenominator:default", async () => {
        await feeSetter.setFeeTo(other.address);
        await feeSetter.setSwapFee(pair.address, 0);
        expect(await pair.swapFee()).to.eq(0);

        await addLiquidity(expandTo18Decimals(800), expandTo18Decimals(10));

        await execTransferAndSwap(expandTo18Decimals(100), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(50));
        await execTransferAndSwap(expandTo18Decimals(20), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(200));
        await execTransferAndSwap(expandTo18Decimals(40), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(66));
        await execTransferAndSwap(expandTo18Decimals(1), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(5));

        const toMintForProtocol = await calcProtocolFee();

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));
        expect(
            (await pair.balanceOf(other.address)).div(ROUND_EXCEPTION)
        ).to.eq(toMintForProtocol.div(ROUND_EXCEPTION));
    });

    it("MULTIPLE_TRADES:feeTo:on, swapFee:0, protocolFeeDenominator:0", async () => {
        await feeSetter.setSwapFee(pair.address, 0);
        expect(await pair.swapFee()).to.eq(0);

        await addLiquidity(expandTo18Decimals(800), expandTo18Decimals(10));

        await execTransferAndSwap(expandTo18Decimals(100), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(50));
        await execTransferAndSwap(expandTo18Decimals(20), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(200));
        await execTransferAndSwap(expandTo18Decimals(40), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(66));
        await execTransferAndSwap(expandTo18Decimals(1), bigNumberify(0));
        await execTransferAndSwap(bigNumberify(0), expandTo18Decimals(5));

        const toMintForProtocol = await calcProtocolFee();

        await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10));
        expect(
            (await pair.balanceOf(other.address)).div(ROUND_EXCEPTION)
        ).to.eq(toMintForProtocol.div(ROUND_EXCEPTION));
    });
});
