import chai, { expect } from "chai";
import { Contract } from "ethers";
import { AddressZero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";
import { solidity, MockProvider, createFixtureLoader } from "ethereum-waffle";

import { getCreate2Address } from "./shared/utilities";
import { factoryFixture } from "./shared/fixtures";

import DexSwapPair from "../build/DexSwapPair.json";

chai.use(solidity);

const TEST_ADDRESSES: [string, string] = [
    "0x1000000000000000000000000000000000000000",
    "0x2000000000000000000000000000000000000000"
];

describe("DexSwapFactory", () => {
    const provider = new MockProvider({
        hardfork: "istanbul",
        mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
        gasLimit: 9999999
    });
    const [wallet, protocolFeeReceiver, other] = provider.getWallets();
    const loadFixture = createFixtureLoader(provider, [
        wallet,
        protocolFeeReceiver,
        other
    ]);

    let factory: Contract;
    let feeSetter: Contract;
    beforeEach(async () => {
        const fixture = await loadFixture(factoryFixture);
        factory = fixture.factory;
        feeSetter = fixture.feeSetter;

        // Set feeToSetter to wallet.address to test the factory methdos from an ETH account
        await feeSetter.setFeeTo(AddressZero);
        await feeSetter.setFeeToSetter(wallet.address);
    });

    it("feeTo, feeToSetter, allPairsLength, INIT_CODE_PAIR_HASH", async () => {
        expect(await factory.feeTo()).to.eq(AddressZero);
        expect(await factory.feeToSetter()).to.eq(wallet.address);
        expect(await factory.allPairsLength()).to.eq(0);
        expect(await factory.INIT_CODE_PAIR_HASH()).to.eq(
            "0x5502cb210d91d4da624396928b178634c0b968b32da675f3f8921c2bd36f00d7"
        );
    });

    async function createPair(tokens: [string, string]) {
        const bytecode = "0x" + DexSwapPair.bytecode;
        const create2Address = getCreate2Address(
            factory.address,
            tokens,
            bytecode
        );
        await expect(factory.createPair(...tokens))
            .to.emit(factory, "PairCreated")
            .withArgs(
                TEST_ADDRESSES[0],
                TEST_ADDRESSES[1],
                create2Address,
                bigNumberify(1)
            );

        await expect(factory.createPair(...tokens)).to.be.reverted; // DexSwap: PAIR_EXISTS
        await expect(factory.createPair(...tokens.slice().reverse())).to.be
            .reverted; // DexSwap: PAIR_EXISTS
        expect(await factory.getPair(...tokens)).to.eq(create2Address);
        expect(await factory.getPair(...tokens.slice().reverse())).to.eq(
            create2Address
        );
        expect(await factory.allPairs(0)).to.eq(create2Address);
        expect(await factory.allPairsLength()).to.eq(1);

        const pair = new Contract(
            create2Address,
            JSON.stringify(DexSwapPair.abi),
            provider
        );
        expect(await pair.factory()).to.eq(factory.address);
        expect(await pair.token0()).to.eq(TEST_ADDRESSES[0]);
        expect(await pair.token1()).to.eq(TEST_ADDRESSES[1]);
    }

    it("createPair", async () => {
        await createPair(TEST_ADDRESSES);
    });

    it("createPair:reverse", async () => {
        await createPair(TEST_ADDRESSES.slice().reverse() as [string, string]);
    });

    it("createPair:gas", async () => {
        const tx = await factory.createPair(...TEST_ADDRESSES);
        const receipt = await tx.wait();
        expect(receipt.gasUsed).to.eq(2136142);
    });

    it("setFeeTo", async () => {
        await expect(
            factory.connect(other).setFeeTo(other.address)
        ).to.be.revertedWith("DexSwapFactory: FORBIDDEN");
        await factory.setFeeTo(wallet.address);
        expect(await factory.feeTo()).to.eq(wallet.address);
    });

    it("setFeeToSetter", async () => {
        await expect(
            factory.connect(other).setFeeToSetter(other.address)
        ).to.be.revertedWith("DexSwapFactory: FORBIDDEN");
        await factory.setFeeToSetter(other.address);
        expect(await factory.feeToSetter()).to.eq(other.address);
        await expect(factory.setFeeToSetter(wallet.address)).to.be.revertedWith(
            "DexSwapFactory: FORBIDDEN"
        );
    });
});
