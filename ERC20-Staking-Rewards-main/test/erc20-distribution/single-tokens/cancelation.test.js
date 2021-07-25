const BN = require("bn.js");
const { expect } = require("chai");
const { ZERO_BN } = require("../../constants");
const { initializeDistribution } = require("../../utils");
const { toWei } = require("../../utils/conversion");
const { fastForwardTo, getEvmTimestamp } = require("../../utils/network");

const ERC20StakingRewardsDistribution = artifacts.require(
    "ERC20StakingRewardsDistribution"
);
const ERC20StakingRewardsDistributionFactory = artifacts.require(
    "ERC20StakingRewardsDistributionFactory"
);
const FirstRewardERC20 = artifacts.require("FirstRewardERC20");
const FirstStakableERC20 = artifacts.require("FirstStakableERC20");

contract(
    "ERC20StakingRewardsDistribution - Single reward/stakable token - Cancelation",
    () => {
        let erc20DistributionFactoryInstance,
            rewardsTokenInstance,
            stakableTokenInstance,
            ownerAddress,
            stakerAddress;

        beforeEach(async () => {
            const accounts = await web3.eth.getAccounts();
            ownerAddress = accounts[0];
            const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                { from: ownerAddress }
            );
            erc20DistributionFactoryInstance = await ERC20StakingRewardsDistributionFactory.new(
                erc20DistributionInstance.address,
                { from: ownerAddress }
            );
            rewardsTokenInstance = await FirstRewardERC20.new();
            stakableTokenInstance = await FirstStakableERC20.new();
            stakerAddress = accounts[1];
        });

        it("should fail when initialization has not been done", async () => {
            try {
                // initializing now sets the owner
                const {
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [2],
                    duration: 2,
                });
                // canceling deinitializes the distribution
                await erc20DistributionInstance.cancel({ from: ownerAddress });
                await erc20DistributionInstance.cancel({ from: ownerAddress });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD19");
            }
        });

        it("should fail when not called by the owner", async () => {
            try {
                const {
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [2],
                    duration: 2,
                });
                await erc20DistributionInstance.cancel({ from: stakerAddress });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD17");
            }
        });

        it("should fail when the program has already started", async () => {
            try {
                const {
                    startingTimestamp,
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [5],
                    duration: 2,
                });
                await fastForwardTo({ timestamp: startingTimestamp });
                await erc20DistributionInstance.cancel({ from: ownerAddress });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD08");
            }
        });

        it("should succeed in the right conditions", async () => {
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const rewardTokens = [rewardsTokenInstance];
            const { erc20DistributionInstance } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens,
                rewardAmounts: [rewardsAmount],
                duration: 2,
                // future timestamp
                startingTimestamp: (await getEvmTimestamp()).add(new BN(60)),
            });
            await erc20DistributionInstance.cancel({ from: ownerAddress });
            for (let i = 0; i < rewardTokens.length; i++) {
                const rewardToken = rewardTokens[i];
                expect(
                    await rewardToken.balanceOf(
                        erc20DistributionInstance.address
                    )
                ).to.be.equalBn(ZERO_BN);
                expect(await rewardToken.balanceOf(ownerAddress)).to.be.equalBn(
                    rewardsAmount
                );
                expect(
                    await erc20DistributionInstance.rewardAmount(
                        rewardToken.address
                    )
                ).to.be.equalBn(rewardsAmount);
            }
            expect(await erc20DistributionInstance.initialized()).to.be.true;
            expect(await erc20DistributionInstance.canceled()).to.be.true;
        });

        it("shouldn't allow for a second initialization on success", async () => {
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const { erc20DistributionInstance } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration: 2,
                // far-future timestamp
                startingTimestamp: (await getEvmTimestamp()).add(new BN(60)),
            });
            await erc20DistributionInstance.cancel({ from: ownerAddress });
            try {
                await erc20DistributionInstance.initialize(
                    [rewardsTokenInstance.address],
                    stakableTokenInstance.address,
                    [rewardsAmount],
                    1000000000000,
                    10000000000000,
                    false,
                    0
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD18");
            }
        });

        it("shouldn't allow for a second cancelation on success", async () => {
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const { erc20DistributionInstance } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration: 2,
                // far-future timestamp
                startingTimestamp: (await getEvmTimestamp()).add(new BN(60)),
            });
            await erc20DistributionInstance.cancel({ from: ownerAddress });
            try {
                await erc20DistributionInstance.cancel({ from: ownerAddress });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD19");
            }
        });
    }
);
