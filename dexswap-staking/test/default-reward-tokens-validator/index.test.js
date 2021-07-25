require("../utils/assertion");
const BN = require("bn.js");
const { expect } = require("chai");

const FirstRewardERC20 = artifacts.require("FirstRewardERC20");
const SecondRewardERC20 = artifacts.require("SecondRewardERC20");
const DEXTokenRegistry = artifacts.require("DEXTokenRegistry");
const DefaultRewardTokensValidator = artifacts.require(
    "DefaultRewardTokensValidator"
);

contract("DefaultRewardTokensValidator", () => {
    let dexTokenRegistryInstance,
        firstRewardTokenInstance,
        secondRewardTokenInstance,
        defaultRewardTokensValidatorInstance,
        ownerAddress,
        randomAddress;

    beforeEach(async () => {
        const accounts = await web3.eth.getAccounts();
        ownerAddress = accounts[1];
        randomAddress = accounts[0];
        firstRewardTokenInstance = await FirstRewardERC20.new();
        secondRewardTokenInstance = await SecondRewardERC20.new();
        dexTokenRegistryInstance = await DEXTokenRegistry.new();
        defaultRewardTokensValidatorInstance = await DefaultRewardTokensValidator.new(
            dexTokenRegistryInstance.address,
            1,
            { from: ownerAddress }
        );
    });

    it("should fail when trying to deploy the contract with a 0-address token registry", async () => {
        try {
            await DefaultRewardTokensValidator.new(
                "0x0000000000000000000000000000000000000000",
                1,
                { from: ownerAddress }
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: 0-address token registry address"
            );
        }
    });

    it("should fail when trying to deploy the contract with an invalid token list id", async () => {
        try {
            await DefaultRewardTokensValidator.new(
                dexTokenRegistryInstance.address,
                0,
                { from: ownerAddress }
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: invalid token list id"
            );
        }
    });

    it("should succeed when trying to deploy the contract with an valid token registry address and token list id", async () => {
        const instance = await DefaultRewardTokensValidator.new(
            dexTokenRegistryInstance.address,
            1,
            { from: ownerAddress }
        );
        expect(await instance.dexTokenRegistry()).to.be.equal(
            dexTokenRegistryInstance.address
        );
        expect(await instance.dexTokenRegistryListId()).to.be.equalBn(new BN(1));
        expect(await instance.owner()).to.be.equal(ownerAddress);
    });

    it("should fail when a non-owner tries to set a new dex token registry address", async () => {
        try {
            await defaultRewardTokensValidatorInstance.setDexTokenRegistry(
                dexTokenRegistryInstance.address,
                { from: randomAddress }
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "Ownable: caller is not the owner"
            );
        }
    });

    it("should fail when the owner tries to set a 0-address dex token registry", async () => {
        try {
            await defaultRewardTokensValidatorInstance.setDexTokenRegistry(
                "0x0000000000000000000000000000000000000000",
                { from: ownerAddress }
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: 0-address token registry address"
            );
        }
    });

    it("should succeed when the owner tries to set a valid address as the dex token registry one", async () => {
        expect(
            await defaultRewardTokensValidatorInstance.dexTokenRegistry()
        ).to.be.equal(dexTokenRegistryInstance.address);
        const newDexTokenRegistryAddress =
            "0x0000000000000000000000000000000000000aBc";
        await defaultRewardTokensValidatorInstance.setDexTokenRegistry(
            newDexTokenRegistryAddress,
            { from: ownerAddress }
        );
        expect(
            await defaultRewardTokensValidatorInstance.dexTokenRegistry()
        ).to.be.equal(newDexTokenRegistryAddress);
    });

    it("should fail when a non-owner tries to set a new token list id", async () => {
        try {
            await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                { from: randomAddress }
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "Ownable: caller is not the owner"
            );
        }
    });

    it("should fail when the owner tries to set an invalid token list id", async () => {
        try {
            await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
                0,
                { from: ownerAddress }
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: invalid token list id"
            );
        }
    });

    it("should succeed when the owner tries to set a valid token list id", async () => {
        expect(
            await defaultRewardTokensValidatorInstance.dexTokenRegistryListId()
        ).to.be.equalBn(new BN(1));
        await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
            10,
            { from: ownerAddress }
        );
        expect(
            await defaultRewardTokensValidatorInstance.dexTokenRegistryListId()
        ).to.be.equalBn(new BN(10));
    });

    it("should signal reward tokens as invalid if an empty array is passed", async () => {
        try {
            await defaultRewardTokensValidatorInstance.validateTokens([]);
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: 0-length reward tokens array"
            );
        }
    });

    it("should signal reward tokens as invalid if a single 0-address token is passed in the array", async () => {
        try {
            await defaultRewardTokensValidatorInstance.validateTokens([
                "0x0000000000000000000000000000000000000000",
            ]);
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: 0-address reward token"
            );
        }
    });

    it("should signal reward tokens as invalid if a single 0-address token is passed in the array after a non-0-address token", async () => {
        try {
            // the first token is checked against the set token list, and it has to be
            // there in order to validate the 0-address one, so we need to list it
            await dexTokenRegistryInstance.addList("test");
            await dexTokenRegistryInstance.addTokens(1, [
                firstRewardTokenInstance.address,
            ]);
            await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                {
                    from: ownerAddress,
                }
            );
            await defaultRewardTokensValidatorInstance.validateTokens([
                firstRewardTokenInstance.address,
                "0x0000000000000000000000000000000000000000",
            ]);
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: 0-address reward token"
            );
        }
    });

    it("should signal reward tokens as invalid if a single unlisted token is passed in the array", async () => {
        try {
            // avoid invalid list errors by creating the list and setting it on the validator,
            // but without adding the token under test to it
            await dexTokenRegistryInstance.addList("test");
            await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                {
                    from: ownerAddress,
                }
            );
            await defaultRewardTokensValidatorInstance.validateTokens([
                firstRewardTokenInstance.address,
            ]);
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: invalid reward token"
            );
        }
    });

    it("should signal reward tokens as invalid if a single listed token is passed in alongside an unlisted token in the array", async () => {
        try {
            await dexTokenRegistryInstance.addList("test");
            // only the first reward token is listed
            await dexTokenRegistryInstance.addTokens(1, [
                firstRewardTokenInstance.address,
            ]);
            await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                {
                    from: ownerAddress,
                }
            );
            await defaultRewardTokensValidatorInstance.validateTokens([
                firstRewardTokenInstance.address,
                secondRewardTokenInstance.address,
            ]);
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: invalid reward token"
            );
        }
    });

    it("should signal reward tokens as valid if a single listed token is passed in the array", async () => {
        await dexTokenRegistryInstance.addList("test");
        // only the first reward token is listed
        await dexTokenRegistryInstance.addTokens(1, [
            firstRewardTokenInstance.address,
        ]);
        await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(1, {
            from: ownerAddress,
        });
        await defaultRewardTokensValidatorInstance.validateTokens([
            firstRewardTokenInstance.address,
        ]);
    });

    it("should signal reward tokens as valid if 2 listed token are passed in the array", async () => {
        await dexTokenRegistryInstance.addList("test");
        // only the first reward token is listed
        await dexTokenRegistryInstance.addTokens(1, [
            firstRewardTokenInstance.address,
            secondRewardTokenInstance.address,
        ]);
        await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(1, {
            from: ownerAddress,
        });
        await defaultRewardTokensValidatorInstance.validateTokens([
            firstRewardTokenInstance.address,
            secondRewardTokenInstance.address,
        ]);
    });

    it("should signal reward tokens as invalid if a single listed but invalid token is passed in the array", async () => {
        try {
            await dexTokenRegistryInstance.addList("test");
            await dexTokenRegistryInstance.addTokens(1, [
                firstRewardTokenInstance.address,
            ]);
            // mark the token as invalid
            await dexTokenRegistryInstance.removeTokens(1, [
                firstRewardTokenInstance.address,
            ]);
            await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                {
                    from: ownerAddress,
                }
            );
            await defaultRewardTokensValidatorInstance.validateTokens([
                firstRewardTokenInstance.address,
            ]);
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: invalid reward token"
            );
        }
    });

    it("should signal reward tokens as invalid if a single listed token is passed alongside a listed but invalid one in the array", async () => {
        try {
            await dexTokenRegistryInstance.addList("test");
            // list both tokens
            await dexTokenRegistryInstance.addTokens(1, [
                firstRewardTokenInstance.address,
                secondRewardTokenInstance.address,
            ]);
            // mark the first token as invalid
            await dexTokenRegistryInstance.removeTokens(1, [
                firstRewardTokenInstance.address,
            ]);
            await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                {
                    from: ownerAddress,
                }
            );
            await defaultRewardTokensValidatorInstance.validateTokens([
                firstRewardTokenInstance.address,
                secondRewardTokenInstance.address,
            ]);
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: invalid reward token"
            );
        }
    });
});
