const BN = require("bn.js");
const { expect } = require("chai");
const { getEvmTimestamp } = require("../../utils/network");

const ERC20StakingRewardsDistributionFactory = artifacts.require(
    "ERC20StakingRewardsDistributionFactory"
);
const ERC20StakingRewardsDistribution = artifacts.require(
    "ERC20StakingRewardsDistribution"
);
const FirstRewardERC20 = artifacts.require("FirstRewardERC20");
const FirstStakableERC20 = artifacts.require("FirstStakableERC20");

contract(
    "ERC20StakingRewardsDistributionFactory - Distribution creation",
    () => {
        let erc20DistributionFactoryInstance,
            erc20DistributionInstance,
            rewardsTokenInstance,
            stakableTokenInstance,
            ownerAddress;

        beforeEach(async () => {
            const accounts = await web3.eth.getAccounts();
            ownerAddress = accounts[1];
            erc20DistributionInstance = await ERC20StakingRewardsDistribution.new();
            erc20DistributionFactoryInstance = await ERC20StakingRewardsDistributionFactory.new(
                erc20DistributionInstance.address,
                { from: ownerAddress }
            );
            rewardsTokenInstance = await FirstRewardERC20.new();
            stakableTokenInstance = await FirstStakableERC20.new();
        });

        it("should fail when the caller has not enough reward token", async () => {
            try {
                // 10 seconds from now
                const startingTimestamp = (await getEvmTimestamp()).add(
                    new BN(10)
                );
                await erc20DistributionFactoryInstance.createDistribution(
                    [rewardsTokenInstance.address],
                    stakableTokenInstance.address,
                    [10],
                    startingTimestamp,
                    startingTimestamp.add(new BN(10)),
                    false,
                    0
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain(
                    "ERC20: transfer amount exceeds balance"
                );
            }
        });

        it("should fail when the caller has enough reward token but no approval was given to the factory contract", async () => {
            try {
                // 10 seconds from now
                const rewardAmount = 10;
                await rewardsTokenInstance.mint(ownerAddress, rewardAmount);
                const startingTimestamp = (await getEvmTimestamp()).add(
                    new BN(10)
                );
                await erc20DistributionFactoryInstance.createDistribution(
                    [rewardsTokenInstance.address],
                    stakableTokenInstance.address,
                    [rewardAmount],
                    startingTimestamp,
                    startingTimestamp.add(new BN(10)),
                    false,
                    0,
                    { from: ownerAddress }
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain(
                    "ERC20: transfer amount exceeds allowance"
                );
            }
        });

        it("should succeed when in the right conditions", async () => {
            // 10 seconds from now
            const rewardAmount = 10;
            await rewardsTokenInstance.mint(ownerAddress, rewardAmount);
            await rewardsTokenInstance.approve(
                erc20DistributionFactoryInstance.address,
                rewardAmount,
                { from: ownerAddress }
            );
            const rewardAmounts = [rewardAmount];
            const rewardTokens = [rewardsTokenInstance.address];
            const startingTimestamp = (await getEvmTimestamp()).add(new BN(10));
            const endingTimestamp = startingTimestamp.add(new BN(10));
            const locked = false;
            await erc20DistributionFactoryInstance.createDistribution(
                rewardTokens,
                stakableTokenInstance.address,
                rewardAmounts,
                startingTimestamp,
                endingTimestamp,
                locked,
                0,
                { from: ownerAddress }
            );
            expect(
                await erc20DistributionFactoryInstance.getDistributionsAmount()
            ).to.be.equalBn(new BN(1));
            const createdDistributionAddress = await erc20DistributionFactoryInstance.distributions(
                0
            );
            const erc20DistributionInstance = await ERC20StakingRewardsDistribution.at(
                createdDistributionAddress
            );

            const onchainRewardTokens = await erc20DistributionInstance.getRewardTokens();
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();

            expect(onchainRewardTokens).to.have.length(rewardTokens.length);
            expect(await erc20DistributionInstance.stakableToken()).to.be.equal(
                stakableTokenInstance.address
            );
            for (let i = 0; i < onchainRewardTokens.length; i++) {
                const token = onchainRewardTokens[i];
                const amount = await erc20DistributionInstance.rewardAmount(
                    token
                );
                expect(amount.toNumber()).to.be.equal(rewardAmounts[i]);
            }
            expect(onchainStartingTimestamp).to.be.equalBn(startingTimestamp);
            expect(onchainEndingTimestamp).to.be.equalBn(endingTimestamp);
            expect(await erc20DistributionInstance.owner()).to.be.equal(
                ownerAddress
            );
        });
    }
);
