require("../utils/assertion");
const BN = require("bn.js");
const { expect } = require("chai");
const { createDeXsPair, getOrderedTokensInPair } = require("../utils");

const FirstStakableERC20 = artifacts.require("FirstStakableERC20");
const SecondStakableERC20 = artifacts.require("SecondStakableERC20");
const DEXTokenRegistry = artifacts.require("DEXTokenRegistry");
const DefaultStakableTokenValidator = artifacts.require(
    "DefaultStakableTokenValidator"
);
const DexSwapFactory = artifacts.require("DexSwapFactory");
const FakeDexSwapPair = artifacts.require("FakeDexSwapPair");
const FailingToken0GetterDexSwapPair = artifacts.require(
    "FailingToken0GetterDexSwapPair"
);
const FailingToken1GetterDexSwapPair = artifacts.require(
    "FailingToken1GetterDexSwapPair"
);

contract("DefaultStakableTokenValidator", () => {
    let dexTokenRegistryInstance,
        dexSwapFactoryInstance,
        firstStakableTokenInstance,
        secondStakableTokenInstance,
        defaultStakableTokensValidatorInstance,
        ownerAddress,
        randomAddress;

    beforeEach(async () => {
        const accounts = await web3.eth.getAccounts();
        ownerAddress = accounts[1];
        randomAddress = accounts[0];
        firstStakableTokenInstance = await FirstStakableERC20.new();
        secondStakableTokenInstance = await SecondStakableERC20.new();
        dexTokenRegistryInstance = await DEXTokenRegistry.new();
        dexSwapFactoryInstance = await DexSwapFactory.new(
            "0x0000000000000000000000000000000000000000"
        );
        defaultStakableTokensValidatorInstance = await DefaultStakableTokenValidator.new(
            dexTokenRegistryInstance.address,
            1,
            dexSwapFactoryInstance.address,
            { from: ownerAddress }
        );
    });

    it("should fail when trying to deploy the contract with a 0-address token registry", async () => {
        try {
            await DefaultStakableTokenValidator.new(
                "0x0000000000000000000000000000000000000000",
                1,
                dexSwapFactoryInstance.address,
                { from: ownerAddress }
            );
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: 0-address token registry address"
            );
        }
    });

    it("should fail when trying to deploy the contract with an invalid token list id", async () => {
        try {
            await DefaultStakableTokenValidator.new(
                dexTokenRegistryInstance.address,
                0,
                dexSwapFactoryInstance.address,
                { from: ownerAddress }
            );
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: invalid token list id"
            );
        }
    });

    it("should fail when trying to deploy the contract with a 0-address factory address", async () => {
        try {
            await DefaultStakableTokenValidator.new(
                dexTokenRegistryInstance.address,
                1,
                "0x0000000000000000000000000000000000000000",
                { from: ownerAddress }
            );
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: 0-address factory address"
            );
        }
    });

    it("should succeed when trying to deploy the contract with an valid token registry address, token list id and factory", async () => {
        const instance = await DefaultStakableTokenValidator.new(
            dexTokenRegistryInstance.address,
            1,
            dexSwapFactoryInstance.address,
            { from: ownerAddress }
        );
        expect(await instance.dexTokenRegistry()).to.be.equal(
            dexTokenRegistryInstance.address
        );
        expect(await instance.dexTokenRegistryListId()).to.be.equalBn(new BN(1));
        expect(await instance.dexSwapFactory()).to.be.equal(
            dexSwapFactoryInstance.address
        );
        expect(await instance.owner()).to.be.equal(ownerAddress);
    });

    it("should fail when a non-owner tries to set a new dex token registry address", async () => {
        try {
            await defaultStakableTokensValidatorInstance.setDexTokenRegistry(
                dexTokenRegistryInstance.address,
                { from: randomAddress }
            );
        } catch (error) {
            expect(error.message).to.contain(
                "Ownable: caller is not the owner"
            );
        }
    });

    it("should fail when the owner tries to set a 0-address dex token registry", async () => {
        try {
            await defaultStakableTokensValidatorInstance.setDexTokenRegistry(
                "0x0000000000000000000000000000000000000000",
                { from: ownerAddress }
            );
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: 0-address token registry address"
            );
        }
    });

    it("should succeed when the owner tries to set a valid address as the dex token registry one", async () => {
        expect(
            await defaultStakableTokensValidatorInstance.dexTokenRegistry()
        ).to.be.equal(dexTokenRegistryInstance.address);
        const newDexTokenRegistryAddress =
            "0x0000000000000000000000000000000000000aBc";
        await defaultStakableTokensValidatorInstance.setDexTokenRegistry(
            newDexTokenRegistryAddress,
            { from: ownerAddress }
        );
        expect(
            await defaultStakableTokensValidatorInstance.dexTokenRegistry()
        ).to.be.equal(newDexTokenRegistryAddress);
    });

    it("should fail when a non-owner tries to set a new token list id", async () => {
        try {
            await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                { from: randomAddress }
            );
        } catch (error) {
            expect(error.message).to.contain(
                "Ownable: caller is not the owner"
            );
        }
    });

    it("should fail when the owner tries to set an invalid token list id", async () => {
        try {
            await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
                0,
                { from: ownerAddress }
            );
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: invalid token list id"
            );
        }
    });

    it("should succeed when the owner tries to set a valid token list id", async () => {
        expect(
            await defaultStakableTokensValidatorInstance.dexTokenRegistryListId()
        ).to.be.equalBn(new BN(1));
        await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
            10,
            { from: ownerAddress }
        );
        expect(
            await defaultStakableTokensValidatorInstance.dexTokenRegistryListId()
        ).to.be.equalBn(new BN(10));
    });

    it("should fail when a non-owner tries to set a new dexswap factory address", async () => {
        try {
            await defaultStakableTokensValidatorInstance.setDexSwapFactory(
                dexSwapFactoryInstance.address,
                { from: randomAddress }
            );
        } catch (error) {
            expect(error.message).to.contain(
                "Ownable: caller is not the owner"
            );
        }
    });

    it("should fail when the owner tries to set an invalid dexswap factory address", async () => {
        try {
            await defaultStakableTokensValidatorInstance.setDexSwapFactory(
                "0x0000000000000000000000000000000000000000",
                { from: ownerAddress }
            );
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: 0-address factory address"
            );
        }
    });

    it("should succeed when the owner tries to set a valid dexswap factory address", async () => {
        expect(
            await defaultStakableTokensValidatorInstance.dexSwapFactory()
        ).to.be.equal(dexSwapFactoryInstance.address);
        const newAddress = "0x0000000000000000000000000000000000000aBc";
        await defaultStakableTokensValidatorInstance.setDexSwapFactory(
            newAddress,
            { from: ownerAddress }
        );
        expect(
            await defaultStakableTokensValidatorInstance.dexSwapFactory()
        ).to.be.equal(newAddress);
    });

    it("should signal stakable tokens as invalid if a single 0-address token is passed in the array", async () => {
        try {
            await defaultStakableTokensValidatorInstance.validateToken(
                "0x0000000000000000000000000000000000000000"
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: 0-address stakable token"
            );
        }
    });

    it("should signal stakable tokens as invalid if a single invalid-factory token is passed in the array", async () => {
        const fakeDexswapFactoryInstance = await DexSwapFactory.new(
            "0x0000000000000000000000000000000000000000"
        );
        await dexTokenRegistryInstance.addList("test");
        await dexTokenRegistryInstance.addTokens(1, [
            firstStakableTokenInstance.address,
        ]);
        await dexTokenRegistryInstance.addTokens(1, [
            secondStakableTokenInstance.address,
        ]);
        const lpTokenAddress = await createDeXsPair(
            fakeDexswapFactoryInstance,
            firstStakableTokenInstance.address,
            secondStakableTokenInstance.address
        );
        await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
            1,
            { from: ownerAddress }
        );
        try {
            await defaultStakableTokensValidatorInstance.validateToken(
                lpTokenAddress
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: pair not registered in factory"
            );
        }
    });

    it("should signal stakable tokens as invalid if a pair with only the token0 listed is passed in the array", async () => {
        await dexTokenRegistryInstance.addList("test");
        const { token0Address, token1Address } = getOrderedTokensInPair(
            firstStakableTokenInstance.address,
            secondStakableTokenInstance.address
        );
        // only the token0 is listed
        await dexTokenRegistryInstance.addTokens(1, [token0Address]);
        const lpTokenAddress = await createDeXsPair(
            dexSwapFactoryInstance,
            token0Address,
            token1Address
        );
        await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
            1,
            { from: ownerAddress }
        );
        try {
            await defaultStakableTokensValidatorInstance.validateToken(
                lpTokenAddress
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: invalid token 1 in DeXs pair"
            );
        }
    });

    it("should signal stakable tokens as invalid if a pair with only the token1 listed is passed in the array", async () => {
        await dexTokenRegistryInstance.addList("test");
        const { token0Address, token1Address } = getOrderedTokensInPair(
            firstStakableTokenInstance.address,
            secondStakableTokenInstance.address
        );
        // only the token0 is listed
        await dexTokenRegistryInstance.addTokens(1, [token1Address]);
        const lpTokenAddress = await createDeXsPair(
            dexSwapFactoryInstance,
            token0Address,
            token1Address
        );
        await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
            1,
            { from: ownerAddress }
        );
        try {
            await defaultStakableTokensValidatorInstance.validateToken(
                lpTokenAddress
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: invalid token 0 in DeXs pair"
            );
        }
    });

    it("should mark the stakable tokens as invalid if the array contains a fake lp which passes every check but is not registered in the official factory", async () => {
        await dexTokenRegistryInstance.addList("test");
        const { token0Address, token1Address } = getOrderedTokensInPair(
            firstStakableTokenInstance.address,
            secondStakableTokenInstance.address
        );
        // list both tokens
        await dexTokenRegistryInstance.addTokens(1, [
            token0Address,
            token1Address,
        ]);
        const fakePairInstance = await FakeDexSwapPair.new(
            token0Address,
            token1Address
        );
        await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
            1,
            { from: ownerAddress }
        );
        try {
            await defaultStakableTokensValidatorInstance.validateToken(
                fakePairInstance.address
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: pair not registered in factory"
            );
        }
    });

    it("should mark the stakable tokens as invalid if the array contains a fake lp which passes every check but fails when getting the token0", async () => {
        await dexTokenRegistryInstance.addList("test");
        const { token0Address, token1Address } = getOrderedTokensInPair(
            firstStakableTokenInstance.address,
            secondStakableTokenInstance.address
        );
        // list both tokens
        await dexTokenRegistryInstance.addTokens(1, [
            token0Address,
            token1Address,
        ]);
        const fakePairInstance = await FailingToken0GetterDexSwapPair.new(
            token1Address
        );
        await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
            1,
            { from: ownerAddress }
        );
        try {
            await defaultStakableTokensValidatorInstance.validateToken(
                fakePairInstance.address
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: could not get token0 for pair"
            );
        }
    });

    it("should mark the stakable tokens as invalid if the array contains a fake lp which passes every check but fails when getting the token1", async () => {
        await dexTokenRegistryInstance.addList("test");
        const { token0Address, token1Address } = getOrderedTokensInPair(
            firstStakableTokenInstance.address,
            secondStakableTokenInstance.address
        );
        // list both tokens
        await dexTokenRegistryInstance.addTokens(1, [
            token0Address,
            token1Address,
        ]);
        const fakePairInstance = await FailingToken1GetterDexSwapPair.new(
            token0Address
        );
        await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
            1,
            { from: ownerAddress }
        );
        try {
            await defaultStakableTokensValidatorInstance.validateToken(
                fakePairInstance.address
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: could not get token1 for pair"
            );
        }
    });

    it("should mark the stakable tokens as valid if the array contains an lp token related to a pair where both tokens are listed", async () => {
        await dexTokenRegistryInstance.addList("test");
        const token0 =
            parseInt(firstStakableTokenInstance.address, 16) <
            parseInt(secondStakableTokenInstance.address, 16)
                ? firstStakableTokenInstance.address
                : secondStakableTokenInstance.address;
        const token1 =
            parseInt(firstStakableTokenInstance.address, 16) >=
            parseInt(secondStakableTokenInstance.address, 16)
                ? firstStakableTokenInstance.address
                : secondStakableTokenInstance.address;
        // list both tokens
        await dexTokenRegistryInstance.addTokens(1, [token0, token1]);
        const lpTokenAddress = await createDeXsPair(
            dexSwapFactoryInstance,
            token0,
            token1
        );
        await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
            1,
            { from: ownerAddress }
        );
        await defaultStakableTokensValidatorInstance.validateToken(
            lpTokenAddress
        );
    });
});
