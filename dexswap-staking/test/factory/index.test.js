require("../utils/assertion");
const BN = require("bn.js");
const { expect } = require("chai");
const { createDeXsPair, getOrderedTokensInPair } = require("../utils");

const DexSwapERC20StakingRewardsDistributionFactory = artifacts.require(
    "DexSwapERC20StakingRewardsDistributionFactory"
);
const ERC20StakingRewardsDistribution = artifacts.require(
    "ERC20StakingRewardsDistribution"
);
const FirstRewardERC20 = artifacts.require("FirstRewardERC20");
const FirstStakableERC20 = artifacts.require("FirstStakableERC20");
const SecondStakableERC20 = artifacts.require("SecondStakableERC20");
const DEXTokenRegistry = artifacts.require("DEXTokenRegistry");
const DexSwapFactory = artifacts.require("DexSwapFactory");
const DexSwapPair = artifacts.require("DexSwapPair");
const DefaultRewardTokensValidator = artifacts.require(
    "DefaultRewardTokensValidator"
);
const DefaultStakableTokenValidator = artifacts.require(
    "DefaultStakableTokenValidator"
);

contract("DexSwapERC20StakingRewardsDistributionFactory", () => {
    let dexDaoERC20DistributionFactoryInstance,
        erc20DistributionImplementationInstance,
        dexTokenRegistryInstance,
        dexSwapFactoryInstance,
        rewardTokenInstance,
        firstStakableTokenInstance,
        secondStakableTokenInstance,
        defaultRewardTokensValidatorInstance,
        defaultStakableTokensValidatorInstance,
        ownerAddress;

    beforeEach(async () => {
        const accounts = await web3.eth.getAccounts();
        ownerAddress = accounts[1];
        dexSwapFactoryInstance = await DexSwapFactory.new(
            "0x0000000000000000000000000000000000000000" // we don't care about fee to setter
        );
        rewardTokenInstance = await FirstRewardERC20.new();
        firstStakableTokenInstance = await FirstStakableERC20.new();
        secondStakableTokenInstance = await SecondStakableERC20.new();
        dexTokenRegistryInstance = await DEXTokenRegistry.new();
        defaultRewardTokensValidatorInstance = await DefaultRewardTokensValidator.new(
            dexTokenRegistryInstance.address,
            1,
            { from: ownerAddress }
        );
        defaultStakableTokensValidatorInstance = await DefaultStakableTokenValidator.new(
            dexTokenRegistryInstance.address,
            1,
            dexSwapFactoryInstance.address,
            { from: ownerAddress }
        );
        erc20DistributionImplementationInstance = await ERC20StakingRewardsDistribution.new();
        dexDaoERC20DistributionFactoryInstance = await DexSwapERC20StakingRewardsDistributionFactory.new(
            defaultRewardTokensValidatorInstance.address,
            defaultStakableTokensValidatorInstance.address,
            erc20DistributionImplementationInstance.address,
            { from: ownerAddress }
        );
    });

    it("should have the expected owner", async () => {
        expect(await dexDaoERC20DistributionFactoryInstance.owner()).to.be.equal(
            ownerAddress
        );
    });

    it("should fail when a non-owner tries to set a new reward tokens validator address", async () => {
        try {
            await dexDaoERC20DistributionFactoryInstance.setRewardTokensValidator(
                defaultRewardTokensValidatorInstance.address
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "Ownable: caller is not the owner"
            );
        }
    });

    it("should succeed when an owner sets a valid reward tokens validator address", async () => {
        expect(
            await dexDaoERC20DistributionFactoryInstance.rewardTokensValidator()
        ).to.be.equal(defaultRewardTokensValidatorInstance.address);
        const newAddress = "0x0000000000000000000000000000000000000aBc";
        await dexDaoERC20DistributionFactoryInstance.setRewardTokensValidator(
            newAddress,
            { from: ownerAddress }
        );
        expect(
            await dexDaoERC20DistributionFactoryInstance.rewardTokensValidator()
        ).to.be.equal(newAddress);
    });

    it("should fail when a non-owner tries to set a new stakable tokens validator address", async () => {
        try {
            await dexDaoERC20DistributionFactoryInstance.setStakableTokenValidator(
                defaultRewardTokensValidatorInstance.address
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "Ownable: caller is not the owner"
            );
        }
    });

    it("should succeed when setting a valid stakable tokens validator address", async () => {
        expect(
            await dexDaoERC20DistributionFactoryInstance.stakableTokenValidator()
        ).to.be.equal(defaultStakableTokensValidatorInstance.address);
        const newAddress = "0x0000000000000000000000000000000000000aBc";
        await dexDaoERC20DistributionFactoryInstance.setStakableTokenValidator(
            newAddress,
            { from: ownerAddress }
        );
        expect(
            await dexDaoERC20DistributionFactoryInstance.stakableTokenValidator()
        ).to.be.equal(newAddress);
    });

    it("should fail when trying to create a distribution with 0-address reward token", async () => {
        try {
            await dexDaoERC20DistributionFactoryInstance.createDistribution(
                ["0x0000000000000000000000000000000000000000"],
                "0x0000000000000000000000000000000000000000",
                ["1"],
                Math.floor(Date.now() / 1000) + 1000,
                Math.floor(Date.now() / 1000) + 2000,
                false,
                0
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: 0-address reward token"
            );
        }
    });

    it("should fail when trying to create a distribution with an unlisted reward token", async () => {
        try {
            // setting valid list on reward tokens validator
            await dexTokenRegistryInstance.addList("test");
            await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                { from: ownerAddress }
            );
            await dexDaoERC20DistributionFactoryInstance.createDistribution(
                [rewardTokenInstance.address],
                "0x0000000000000000000000000000000000000000",
                ["1"],
                Math.floor(Date.now() / 1000) + 1000,
                Math.floor(Date.now() / 1000) + 2000,
                false,
                0
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultRewardTokensValidator: invalid reward token"
            );
        }
    });

    it("should fail when trying to create a distribution with 0-address stakable token", async () => {
        try {
            // listing reward token so that validation passes
            await dexTokenRegistryInstance.addList("test");
            await dexTokenRegistryInstance.addTokens(1, [
                rewardTokenInstance.address,
            ]);
            await dexDaoERC20DistributionFactoryInstance.createDistribution(
                [rewardTokenInstance.address],
                "0x0000000000000000000000000000000000000000",
                ["1"],
                Math.floor(Date.now() / 1000) + 1000,
                Math.floor(Date.now() / 1000) + 2000,
                false,
                0
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: 0-address stakable token"
            );
        }
    });

    it("should fail when trying to create a distribution with a DEXS LP token related to a pair with an unlisted token0", async () => {
        try {
            const { token0Address, token1Address } = getOrderedTokensInPair(
                firstStakableTokenInstance.address,
                secondStakableTokenInstance.address
            );
            await dexTokenRegistryInstance.addList("test");
            await dexTokenRegistryInstance.addTokens(1, [
                rewardTokenInstance.address,
                token1Address,
            ]);
            await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                { from: ownerAddress }
            );
            const lpTokenAddress = await createDeXsPair(
                dexSwapFactoryInstance,
                token0Address,
                token1Address
            );
            // setting valid list on stakable tokens validator
            await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                { from: ownerAddress }
            );
            await dexDaoERC20DistributionFactoryInstance.createDistribution(
                [rewardTokenInstance.address],
                lpTokenAddress,
                ["1"],
                Math.floor(Date.now() / 1000) + 1000,
                Math.floor(Date.now() / 1000) + 2000,
                false,
                0
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: invalid token 0 in DeXs pair"
            );
        }
    });

    it("should fail when trying to create a distribution with a DEXS LP token related to a pair with an unlisted token1", async () => {
        try {
            const { token0Address, token1Address } = getOrderedTokensInPair(
                firstStakableTokenInstance.address,
                secondStakableTokenInstance.address
            );
            await dexTokenRegistryInstance.addList("test");
            await dexTokenRegistryInstance.addTokens(1, [
                rewardTokenInstance.address,
                token0Address,
            ]);
            await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                { from: ownerAddress }
            );
            const lpTokenAddress = await createDeXsPair(
                dexSwapFactoryInstance,
                token0Address,
                token1Address
            );
            // setting valid list on stakable tokens validator
            await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
                1,
                { from: ownerAddress }
            );
            await dexDaoERC20DistributionFactoryInstance.createDistribution(
                [rewardTokenInstance.address],
                lpTokenAddress,
                ["1"],
                Math.floor(Date.now() / 1000) + 1000,
                Math.floor(Date.now() / 1000) + 2000,
                false,
                0
            );
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "DefaultStakableTokenValidator: invalid token 1 in DeXs pair"
            );
        }
    });

    it("should succeed when trying to create a distribution with a stakable token that represents a dexswap pair with both tokens listed", async () => {
        // listing reward token so that validation passes
        await dexTokenRegistryInstance.addList("test");
        await dexTokenRegistryInstance.addTokens(1, [
            rewardTokenInstance.address,
        ]);
        // listing both one stakable tokens
        await dexTokenRegistryInstance.addTokens(1, [
            firstStakableTokenInstance.address,
        ]);
        await dexTokenRegistryInstance.addTokens(1, [
            secondStakableTokenInstance.address,
        ]);
        // setting validation token list to correct id for validators. This has
        // already been done in the before each hook, but redoing it here for
        // clarity
        await defaultRewardTokensValidatorInstance.setDexTokenRegistryListId(1, {
            from: ownerAddress,
        });
        await defaultStakableTokensValidatorInstance.setDexTokenRegistryListId(
            1,
            { from: ownerAddress }
        );
        const { token0Address, token1Address } = getOrderedTokensInPair(
            firstStakableTokenInstance.address,
            secondStakableTokenInstance.address
        );
        // creating pair on dexswap. Both tokens are listed
        const createdPairAddress = await createDeXsPair(
            dexSwapFactoryInstance,
            token0Address,
            token1Address
        );
        const createdPairInstance = await DexSwapPair.at(createdPairAddress);
        expect(await createdPairInstance.token0()).to.be.equal(token0Address);
        expect(await createdPairInstance.token1()).to.be.equal(token1Address);
        expect(await createdPairInstance.factory()).to.be.equal(
            dexSwapFactoryInstance.address
        );
        // minting approving reward tokens to avoid balance and allowance-related fails
        const rewardAmount = new BN(web3.utils.toWei("1"));
        await rewardTokenInstance.mint(ownerAddress, rewardAmount);
        await rewardTokenInstance.approve(
            dexDaoERC20DistributionFactoryInstance.address,
            rewardAmount,
            { from: ownerAddress }
        );
        const startingTimestamp = new BN(Math.floor(Date.now() / 1000) + 1000);
        const endingTimestamp = new BN(Math.floor(Date.now() / 1000) + 2000);
        const duration = endingTimestamp.sub(startingTimestamp);
        await dexDaoERC20DistributionFactoryInstance.createDistribution(
            [rewardTokenInstance.address],
            createdPairAddress,
            [rewardAmount],
            startingTimestamp,
            endingTimestamp,
            false,
            0,
            { from: ownerAddress }
        );
        expect(
            await dexDaoERC20DistributionFactoryInstance.getDistributionsAmount()
        ).to.be.equalBn(new BN(1));
        const erc20DistributionInstance = await ERC20StakingRewardsDistribution.at(
            await dexDaoERC20DistributionFactoryInstance.distributions(0)
        );
        expect(await erc20DistributionInstance.initialized()).to.be.true;

        // reward token related checks
        const onchainRewardTokens = await erc20DistributionInstance.getRewardTokens();
        expect(onchainRewardTokens).to.have.length(1);
        expect(onchainRewardTokens[0]).to.be.equal(rewardTokenInstance.address);
        expect(
            await rewardTokenInstance.balanceOf(
                erc20DistributionInstance.address
            )
        ).to.be.equalBn(rewardAmount);
        expect(
            await erc20DistributionInstance.rewardAmount(
                rewardTokenInstance.address
            )
        ).to.be.equalBn(rewardAmount);

        // stakable token related checks
        expect(await erc20DistributionInstance.stakableToken()).to.be.equal(
            createdPairAddress
        );

        const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
        expect(onchainStartingTimestamp).to.be.equalBn(startingTimestamp);
        const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
        expect(
            onchainEndingTimestamp.sub(onchainStartingTimestamp)
        ).to.be.equalBn(duration);
    });
});
