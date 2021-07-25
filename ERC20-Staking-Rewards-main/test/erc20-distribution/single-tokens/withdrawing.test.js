const BN = require("bn.js");
const { expect } = require("chai");
const {
    initializeDistribution,
    initializeStaker,
    withdraw,
    stakeAtTimestamp,
    withdrawAtTimestamp,
} = require("../../utils");
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
    "ERC20StakingRewardsDistribution - Single reward/stakable token - Withdrawing",
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
                const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                    { from: ownerAddress }
                );
                await erc20DistributionInstance.withdraw(0);
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD20");
            }
        });

        it("should fail when the distribution has not yet started", async () => {
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
                await erc20DistributionInstance.withdraw(0);
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD20");
            }
        });

        it("should fail when the staker tries to withdraw more than what they staked", async () => {
            try {
                const {
                    startingTimestamp,
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [20],
                    duration: 10,
                });
                await initializeStaker({
                    erc20DistributionInstance,
                    stakableTokenInstance,
                    stakerAddress: stakerAddress,
                    stakableAmount: 1,
                });
                await fastForwardTo({ timestamp: startingTimestamp });
                await stakeAtTimestamp(
                    erc20DistributionInstance,
                    stakerAddress,
                    1,
                    startingTimestamp
                );
                await erc20DistributionInstance.withdraw(2, {
                    from: stakerAddress,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD13");
            }
        });

        it("should succeed in the right conditions, when the distribution has not yet ended", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [await toWei(1, rewardsTokenInstance)],
                duration: 10,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: stakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                stakerAddress,
                stakedAmount,
                startingTimestamp
            );
            expect(
                await erc20DistributionInstance.stakedTokensOf(stakerAddress)
            ).to.be.equalBn(stakedAmount);
            await withdraw(
                erc20DistributionInstance,
                stakerAddress,
                stakedAmount.div(new BN(2))
            );
            expect(
                await erc20DistributionInstance.stakedTokensOf(stakerAddress)
            ).to.be.equalBn(stakedAmount.div(new BN(2)));
            expect(
                await stakableTokenInstance.balanceOf(stakerAddress)
            ).to.be.equalBn(stakedAmount.div(new BN(2)));
        });

        it("should succeed in the right conditions, when the distribution has already ended", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [await toWei(1, rewardsTokenInstance)],
                duration: 10,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: stakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                stakerAddress,
                stakedAmount,
                startingTimestamp
            );
            expect(
                await erc20DistributionInstance.stakedTokensOf(stakerAddress)
            ).to.be.equalBn(stakedAmount);
            await fastForwardTo({ timestamp: endingTimestamp });
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                stakerAddress,
                stakedAmount.div(new BN(2)),
                endingTimestamp
            );
            expect(
                await erc20DistributionInstance.stakedTokensOf(stakerAddress)
            ).to.be.equalBn(stakedAmount.div(new BN(2)));
            expect(
                await stakableTokenInstance.balanceOf(stakerAddress)
            ).to.be.equalBn(stakedAmount.div(new BN(2)));
        });

        it("should fail when trying to withdraw from a non-ended locked distribution, right in the middle of it", async () => {
            try {
                const stakedAmount = await toWei(10, stakableTokenInstance);
                const {
                    startingTimestamp,
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [await toWei(1, rewardsTokenInstance)],
                    duration: 10,
                    locked: true,
                });
                await initializeStaker({
                    erc20DistributionInstance,
                    stakableTokenInstance,
                    stakerAddress: stakerAddress,
                    stakableAmount: stakedAmount,
                });
                await fastForwardTo({ timestamp: startingTimestamp });
                await stakeAtTimestamp(
                    erc20DistributionInstance,
                    stakerAddress,
                    stakedAmount,
                    startingTimestamp
                );
                expect(
                    await erc20DistributionInstance.stakedTokensOf(
                        stakerAddress
                    )
                ).to.be.equalBn(stakedAmount);
                // fast-forward to the middle of the distribution
                const withdrawingTimestamp = startingTimestamp.add(new BN(5));
                await fastForwardTo({ timestamp: withdrawingTimestamp });
                await withdraw(
                    erc20DistributionInstance,
                    stakerAddress,
                    stakedAmount.div(new BN(2))
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD12");
            }
        });

        it("should fail when trying to withdraw from a non-ended locked distribution, right at the last second of it", async () => {
            try {
                const stakedAmount = await toWei(10, stakableTokenInstance);
                const {
                    startingTimestamp,
                    endingTimestamp,
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [await toWei(1, rewardsTokenInstance)],
                    duration: 10,
                    locked: true,
                });
                await initializeStaker({
                    erc20DistributionInstance,
                    stakableTokenInstance,
                    stakerAddress: stakerAddress,
                    stakableAmount: stakedAmount,
                });
                expect(
                    await stakableTokenInstance.balanceOf(stakerAddress)
                ).to.be.equalBn(stakedAmount);
                expect(await erc20DistributionInstance.locked()).to.be.true;
                await fastForwardTo({ timestamp: startingTimestamp });
                await stakeAtTimestamp(
                    erc20DistributionInstance,
                    stakerAddress,
                    stakedAmount,
                    startingTimestamp
                );
                expect(
                    await erc20DistributionInstance.stakedTokensOf(
                        stakerAddress
                    )
                ).to.be.equalBn(stakedAmount);
                // fast-forward to the middle of the distribution
                const withdrawingTimestamp = endingTimestamp;
                await fastForwardTo({
                    timestamp: withdrawingTimestamp,
                    mineBlockAfter: false,
                });
                await withdrawAtTimestamp(
                    erc20DistributionInstance,
                    stakerAddress,
                    stakedAmount.div(new BN(2)),
                    withdrawingTimestamp
                );
                expect(await getEvmTimestamp()).to.be.equalBn(
                    withdrawingTimestamp
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD12");
            }
        });

        it("should succeed when withdrawing from an ended locked distribution", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [await toWei(1, rewardsTokenInstance)],
                duration: 10,
                locked: true,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: stakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                stakerAddress,
                stakedAmount,
                startingTimestamp
            );
            expect(
                await erc20DistributionInstance.stakedTokensOf(stakerAddress)
            ).to.be.equalBn(stakedAmount);
            // fast-forward to the middle of the distribution
            const withdrawingTimestamp = endingTimestamp.add(new BN(2));
            await fastForwardTo({ timestamp: withdrawingTimestamp });
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                stakerAddress,
                stakedAmount,
                withdrawingTimestamp
            );
            expect(await getEvmTimestamp()).to.be.equalBn(withdrawingTimestamp);
            expect(
                await stakableTokenInstance.balanceOf(stakerAddress)
            ).to.be.equalBn(stakedAmount);
        });
    }
);
