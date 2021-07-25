import chai, { expect } from "chai";
import { Contract } from "ethers";
import { solidity, MockProvider, createFixtureLoader } from "ethereum-waffle";
import { BigNumber, bigNumberify } from "ethers/utils";

import { expandTo18Decimals, mineBlock, encodePrice } from "./shared/utilities";
import { pairFixture } from "./shared/fixtures";
import { AddressZero } from "ethers/constants";

const MINIMUM_LIQUIDITY = bigNumberify(10).pow(3);
const ROUND_EXCEPTION = bigNumberify(10).pow(4);
const FEE_DENOMINATOR = bigNumberify(10).pow(4);

chai.use(solidity);

const overrides = {
    gasLimit: 9999999
};

describe("DexSwapPair", () => {
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
        await feeSetter.setFeeTo(AddressZero);
    });

    it("mint", async () => {
        const token0Amount = expandTo18Decimals(1);
        const token1Amount = expandTo18Decimals(4);
        await token0.transfer(pair.address, token0Amount);
        await token1.transfer(pair.address, token1Amount);

        const expectedLiquidity = expandTo18Decimals(2);
        await expect(pair.connect(wallet).mint(wallet.address, overrides))
            .to.emit(pair, "Transfer")
            .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
            .to.emit(pair, "Transfer")
            .withArgs(
                AddressZero,
                wallet.address,
                expectedLiquidity.sub(MINIMUM_LIQUIDITY)
            )
            .to.emit(pair, "Sync")
            .withArgs(token0Amount, token1Amount)
            .to.emit(pair, "Mint")
            .withArgs(wallet.address, token0Amount, token1Amount);

        expect(await pair.totalSupply()).to.eq(expectedLiquidity);
        expect(await pair.balanceOf(wallet.address)).to.eq(
            expectedLiquidity.sub(MINIMUM_LIQUIDITY)
        );
        expect(await token0.balanceOf(pair.address)).to.eq(token0Amount);
        expect(await token1.balanceOf(pair.address)).to.eq(token1Amount);
        const reserves = await pair.getReserves();
        expect(reserves[0]).to.eq(token0Amount);
        expect(reserves[1]).to.eq(token1Amount);
    });

    async function addLiquidity(
        token0Amount: BigNumber,
        token1Amount: BigNumber
    ) {
        await token0.transfer(pair.address, token0Amount);
        await token1.transfer(pair.address, token1Amount);
        await pair.connect(wallet).mint(wallet.address, overrides);
    }
    const swapTestCases: BigNumber[][] = [
        [1, 5, 10],
        [1, 10, 5],

        [2, 5, 10],
        [2, 10, 5],

        [1, 10, 10],
        [1, 100, 100],
        [1, 1000, 1000]
    ].map(a =>
        a.map(n =>
            typeof n === "string" ? bigNumberify(n) : expandTo18Decimals(n)
        )
    );
    swapTestCases.forEach((swapTestCase, i) => {
        it(`getInputPrice:${i}`, async () => {
            const [swapAmount, token0Amount, token1Amount] = swapTestCase;
            await addLiquidity(token0Amount, token1Amount);
            await token0.transfer(pair.address, swapAmount);
            const amountInWithFee = swapAmount.mul(FEE_DENOMINATOR.sub(15));
            const numerator = amountInWithFee.mul(token1Amount);
            const denominator = token0Amount
                .mul(FEE_DENOMINATOR)
                .add(amountInWithFee);
            const amountOut = numerator.div(denominator);
            await expect(
                pair.swap(0, amountOut.add(1), wallet.address, "0x", overrides)
            ).to.be.revertedWith("DexSwapPair: K");
            await pair.swap(0, amountOut, wallet.address, "0x", overrides);
        });
    });

    const optimisticTestCases: BigNumber[][] = [
        ["998500000000000000", 5, 10, 1], // given amountIn, amountOut = floor(amountIn * .9985)
        ["998500000000000000", 10, 5, 1],
        ["998500000000000000", 5, 5, 1],
        [1, 5, 5, "1001502253380070105"] // given amountOut, amountIn = ceiling(amountOut / .9985)
    ].map(a =>
        a.map(n =>
            typeof n === "string" ? bigNumberify(n) : expandTo18Decimals(n)
        )
    );
    optimisticTestCases.forEach((optimisticTestCase, i) => {
        it(`optimistic:${i}`, async () => {
            const [
                outputAmount,
                token0Amount,
                token1Amount,
                inputAmount
            ] = optimisticTestCase;
            await addLiquidity(token0Amount, token1Amount);
            await token0.transfer(pair.address, inputAmount);
            await expect(
                pair.swap(
                    outputAmount.add(1),
                    0,
                    wallet.address,
                    "0x",
                    overrides
                )
            ).to.be.revertedWith("DexSwapPair: K");
            await pair.swap(
                outputAmount.sub(1),
                0,
                wallet.address,
                "0x",
                overrides
            );
        });
    });

    it("swap:token0", async () => {
        const token0Amount = expandTo18Decimals(5);
        const token1Amount = expandTo18Decimals(10);
        await addLiquidity(token0Amount, token1Amount);

        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = bigNumberify("1662497915624478906");
        await token0.transfer(pair.address, swapAmount);
        await expect(
            pair
                .connect(wallet)
                .swap(0, expectedOutputAmount, wallet.address, "0x", overrides)
        )
            .to.emit(token1, "Transfer")
            .withArgs(pair.address, wallet.address, expectedOutputAmount)
            .to.emit(pair, "Sync")
            .withArgs(
                token0Amount.add(swapAmount),
                token1Amount.sub(expectedOutputAmount)
            )
            .to.emit(pair, "Swap")
            .withArgs(
                wallet.address,
                swapAmount,
                0,
                0,
                expectedOutputAmount,
                wallet.address
            );

        const reserves = await pair.getReserves();
        expect(reserves[0]).to.eq(token0Amount.add(swapAmount));
        expect(reserves[1]).to.eq(token1Amount.sub(expectedOutputAmount));
        expect(await token0.balanceOf(pair.address)).to.eq(
            token0Amount.add(swapAmount)
        );
        expect(await token1.balanceOf(pair.address)).to.eq(
            token1Amount.sub(expectedOutputAmount)
        );
        const totalSupplyToken0 = await token0.totalSupply();
        const totalSupplyToken1 = await token1.totalSupply();
        expect(await token0.balanceOf(wallet.address)).to.eq(
            totalSupplyToken0.sub(token0Amount).sub(swapAmount)
        );
        expect(await token1.balanceOf(wallet.address)).to.eq(
            totalSupplyToken1.sub(token1Amount).add(expectedOutputAmount)
        );
    });

    it("swap:token1", async () => {
        const token0Amount = expandTo18Decimals(5);
        const token1Amount = expandTo18Decimals(10);
        await addLiquidity(token0Amount, token1Amount);

        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = bigNumberify("453305446940074565");
        await token1.transfer(pair.address, swapAmount);
        await expect(
            pair
                .connect(wallet)
                .swap(expectedOutputAmount, 0, wallet.address, "0x", overrides)
        )
            .to.emit(token0, "Transfer")
            .withArgs(pair.address, wallet.address, expectedOutputAmount)
            .to.emit(pair, "Sync")
            .withArgs(
                token0Amount.sub(expectedOutputAmount),
                token1Amount.add(swapAmount)
            )
            .to.emit(pair, "Swap")
            .withArgs(
                wallet.address,
                0,
                swapAmount,
                expectedOutputAmount,
                0,
                wallet.address
            );

        const reserves = await pair.getReserves();
        expect(reserves[0]).to.eq(token0Amount.sub(expectedOutputAmount));
        expect(reserves[1]).to.eq(token1Amount.add(swapAmount));
        expect(await token0.balanceOf(pair.address)).to.eq(
            token0Amount.sub(expectedOutputAmount)
        );
        expect(await token1.balanceOf(pair.address)).to.eq(
            token1Amount.add(swapAmount)
        );
        const totalSupplyToken0 = await token0.totalSupply();
        const totalSupplyToken1 = await token1.totalSupply();
        expect(await token0.balanceOf(wallet.address)).to.eq(
            totalSupplyToken0.sub(token0Amount).add(expectedOutputAmount)
        );
        expect(await token1.balanceOf(wallet.address)).to.eq(
            totalSupplyToken1.sub(token1Amount).sub(swapAmount)
        );
    });

    it("swap:gas", async () => {
        const token0Amount = expandTo18Decimals(5);
        const token1Amount = expandTo18Decimals(10);
        await addLiquidity(token0Amount, token1Amount);

        // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
        await mineBlock(
            provider,
            (await provider.getBlock("latest")).timestamp + 1
        );
        await pair.sync(overrides);

        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = bigNumberify("453305446940074565");
        await token1.transfer(pair.address, swapAmount);
        await mineBlock(
            provider,
            (await provider.getBlock("latest")).timestamp + 1
        );
        const tx = await pair.swap(
            expectedOutputAmount,
            0,
            wallet.address,
            "0x",
            overrides
        );
        const receipt = await tx.wait();
        expect(receipt.gasUsed).to.eq(75647);
    });

    it("burn", async () => {
        const token0Amount = expandTo18Decimals(3);
        const token1Amount = expandTo18Decimals(3);
        await addLiquidity(token0Amount, token1Amount);

        const expectedLiquidity = expandTo18Decimals(3);
        await pair
            .connect(wallet)
            .transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY));
        await expect(pair.connect(wallet).burn(wallet.address, overrides))
            .to.emit(pair, "Transfer")
            .withArgs(
                pair.address,
                AddressZero,
                expectedLiquidity.sub(MINIMUM_LIQUIDITY)
            )
            .to.emit(token0, "Transfer")
            .withArgs(pair.address, wallet.address, token0Amount.sub(1000))
            .to.emit(token1, "Transfer")
            .withArgs(pair.address, wallet.address, token1Amount.sub(1000))
            .to.emit(pair, "Sync")
            .withArgs(1000, 1000)
            .to.emit(pair, "Burn")
            .withArgs(
                wallet.address,
                token0Amount.sub(1000),
                token1Amount.sub(1000),
                wallet.address
            );

        expect(await pair.balanceOf(wallet.address)).to.eq(0);
        expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY);
        expect(await token0.balanceOf(pair.address)).to.eq(1000);
        expect(await token1.balanceOf(pair.address)).to.eq(1000);
        const totalSupplyToken0 = await token0.totalSupply();
        const totalSupplyToken1 = await token1.totalSupply();
        expect(await token0.balanceOf(wallet.address)).to.eq(
            totalSupplyToken0.sub(1000)
        );
        expect(await token1.balanceOf(wallet.address)).to.eq(
            totalSupplyToken1.sub(1000)
        );
    });

    it("price{0,1}CumulativeLast", async () => {
        const token0Amount = expandTo18Decimals(3);
        const token1Amount = expandTo18Decimals(3);
        await addLiquidity(token0Amount, token1Amount);

        const blockTimestamp = (await pair.getReserves())[2];
        await mineBlock(provider, blockTimestamp + 1);
        await pair.sync(overrides);

        const initialPrice = encodePrice(token0Amount, token1Amount);
        expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0]);
        expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1]);
        expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 1);

        const swapAmount = expandTo18Decimals(3);
        await token0.transfer(pair.address, swapAmount);
        await mineBlock(provider, blockTimestamp + 10);
        // swap to a new price eagerly instead of syncing
        await pair.swap(
            0,
            expandTo18Decimals(1),
            wallet.address,
            "0x",
            overrides
        ); // make the price nice

        expect(await pair.price0CumulativeLast()).to.eq(
            initialPrice[0].mul(10)
        );
        expect(await pair.price1CumulativeLast()).to.eq(
            initialPrice[1].mul(10)
        );
        expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 10);

        await mineBlock(provider, blockTimestamp + 20);
        await pair.sync(overrides);

        const newPrice = encodePrice(
            expandTo18Decimals(6),
            expandTo18Decimals(2)
        );
        expect(await pair.price0CumulativeLast()).to.eq(
            initialPrice[0].mul(10).add(newPrice[0].mul(10))
        );
        expect(await pair.price1CumulativeLast()).to.eq(
            initialPrice[1].mul(10).add(newPrice[1].mul(10))
        );
        expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 20);
    });

    it("feeTo:off", async () => {
        const token0Amount = expandTo18Decimals(1000);
        const token1Amount = expandTo18Decimals(1000);
        await addLiquidity(token0Amount, token1Amount);

        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = bigNumberify("996006981039903216");
        await token1.transfer(pair.address, swapAmount);
        await pair
            .connect(wallet)
            .swap(expectedOutputAmount, 0, wallet.address, "0x", overrides);

        const expectedLiquidity = expandTo18Decimals(1000);
        await pair
            .connect(wallet)
            .transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY));
        await pair.connect(wallet).burn(wallet.address, overrides);
        expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY);
    });

    it("feeTo:off, swapFee:0 attack", async () => {
        await feeSetter.setSwapFee(pair.address, 0);
        const token0Amount = expandTo18Decimals(1000);
        const token1Amount = expandTo18Decimals(1000);
        await addLiquidity(token0Amount, token1Amount);

        expect(await token0.balanceOf(pair.address)).to.eq(
            expandTo18Decimals(1000)
        );
        expect(await token1.balanceOf(pair.address)).to.eq(
            expandTo18Decimals(1000)
        );
        expect(await token0.balanceOf(wallet.address)).to.eq(
            expandTo18Decimals(9000)
        );
        expect(await token1.balanceOf(wallet.address)).to.eq(
            expandTo18Decimals(9000)
        );

        // Attack pool
        await token1.transfer(pair.address, expandTo18Decimals(1));
        await expect(
            pair
                .connect(wallet)
                .swap(
                    expandTo18Decimals(999),
                    0,
                    wallet.address,
                    "0x",
                    overrides
                )
        ).to.be.revertedWith("DexSwapPair: K");
        await token0.transfer(pair.address, expandTo18Decimals(1));
        await expect(
            pair
                .connect(wallet)
                .swap(
                    0,
                    expandTo18Decimals(999),
                    wallet.address,
                    "0x",
                    overrides
                )
        ).to.be.revertedWith("DexSwapPair: K");

        expect(await token0.balanceOf(pair.address)).to.eq(
            expandTo18Decimals(1001)
        );
        expect(await token1.balanceOf(pair.address)).to.eq(
            expandTo18Decimals(1001)
        );
        expect(await token0.balanceOf(wallet.address)).to.eq(
            expandTo18Decimals(8999)
        );
        expect(await token1.balanceOf(wallet.address)).to.eq(
            expandTo18Decimals(8999)
        );

        const expectedLiquidity = expandTo18Decimals(1000);
        await pair
            .connect(wallet)
            .transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY));
        await pair.connect(wallet).burn(wallet.address, overrides);
        expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY);
    });

    it("feeTo:on", async () => {
        await feeSetter.setFeeTo(other.address);

        const token0Amount = expandTo18Decimals(1000);
        const token1Amount = expandTo18Decimals(1000);
        await addLiquidity(token0Amount, token1Amount);

        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = bigNumberify("996006981039903216");
        await token1.transfer(pair.address, swapAmount);
        await pair
            .connect(wallet)
            .swap(expectedOutputAmount, 0, wallet.address, "0x", overrides);

        const expectedLiquidity = expandTo18Decimals(1000);
        await pair
            .connect(wallet)
            .transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY));
        await pair.connect(wallet).burn(wallet.address, overrides);
        expect(await pair.totalSupply()).to.eq(
            MINIMUM_LIQUIDITY.add("149850284580759")
        );
        expect(await pair.balanceOf(other.address)).to.eq("149850284580759");

        // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
        // ...because the initial liquidity amounts were equal
        expect(await token0.balanceOf(pair.address)).to.eq(
            bigNumberify(1000).add("149701010218466")
        );
        expect(await token1.balanceOf(pair.address)).to.eq(
            bigNumberify(1000).add("150000112387782")
        );
    });

    it("feeTo:on:0.025", async () => {
        await feeSetter.setFeeTo(other.address);
        await feeSetter.setProtocolFee(11);

        const token0Amount = expandTo18Decimals(1000);
        const token1Amount = expandTo18Decimals(1000);
        await addLiquidity(token0Amount, token1Amount);

        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = bigNumberify("996006981039903216");
        await token1.transfer(pair.address, swapAmount);
        await pair
            .connect(wallet)
            .swap(expectedOutputAmount, 0, wallet.address, "0x", overrides);

        const expectedLiquidity = expandTo18Decimals(1000);
        await pair
            .connect(wallet)
            .transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY));
        await pair.connect(wallet).burn(wallet.address, overrides);
        const expectedTotalSupply = bigNumberify("124875234033868");

        expect((await pair.totalSupply()).div(ROUND_EXCEPTION)).to.eq(
            MINIMUM_LIQUIDITY.add(expectedTotalSupply).div(ROUND_EXCEPTION)
        );
        expect(
            (await pair.balanceOf(other.address)).div(ROUND_EXCEPTION)
        ).to.eq(expectedTotalSupply.div(ROUND_EXCEPTION));

        // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
        // ...because the initial liquidity amounts were equal
        expect(
            (await token0.balanceOf(pair.address)).div(ROUND_EXCEPTION)
        ).to.eq(
            bigNumberify(1000)
                .add("124750841848722")
                .div(ROUND_EXCEPTION)
        );
        expect(
            (await token1.balanceOf(pair.address)).div(ROUND_EXCEPTION)
        ).to.eq(
            bigNumberify(1000)
                .add("125000093656485")
                .div(ROUND_EXCEPTION)
        );
    });

    it("feeTo:on:0.1:swapFee:0.20", async () => {
        await feeSetter.setFeeTo(other.address);
        await feeSetter.setProtocolFee(1);
        await feeSetter.setSwapFee(pair.address, 20);

        const token0Amount = expandTo18Decimals(1000);
        const token1Amount = expandTo18Decimals(1000);
        await addLiquidity(token0Amount, token1Amount);

        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = swapAmount.mul(98).div(100);
        await token1.transfer(pair.address, swapAmount);
        await pair
            .connect(wallet)
            .swap(expectedOutputAmount, 0, wallet.address, "0x", overrides);

        const expectedLiquidity = expandTo18Decimals(1000);
        await pair
            .connect(wallet)
            .transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY));
        await pair.connect(wallet).burn(wallet.address, overrides);
        const expectedTotalSupply = bigNumberify("4754954780487545");

        expect((await pair.totalSupply()).div(ROUND_EXCEPTION)).to.eq(
            MINIMUM_LIQUIDITY.add(expectedTotalSupply).div(ROUND_EXCEPTION)
        );
        expect(
            (await pair.balanceOf(other.address)).div(ROUND_EXCEPTION)
        ).to.eq(expectedTotalSupply.div(ROUND_EXCEPTION));

        // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
        // ...because the initial liquidity amounts were equal
        expect(
            (await token0.balanceOf(pair.address)).div(ROUND_EXCEPTION)
        ).to.eq(
            bigNumberify(1000)
                .add("4750272337472507")
                .div(ROUND_EXCEPTION)
        );
        expect(
            (await token1.balanceOf(pair.address)).div(ROUND_EXCEPTION)
        ).to.eq(
            bigNumberify(1000)
                .add("4759687103171089")
                .div(ROUND_EXCEPTION)
        );
    });

    it("fail on trying to set swap fee higher than 10%", async () => {
        await feeSetter.setSwapFee(pair.address, 0);
        await feeSetter.setSwapFee(pair.address, 1000);
        await expect(
            feeSetter.setSwapFee(pair.address, 1001)
        ).to.be.revertedWith("DexSwapPair: FORBIDDEN_FEE");
    });
});
