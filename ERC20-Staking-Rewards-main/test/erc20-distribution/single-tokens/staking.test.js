const { expect } = require("chai");
const {
    initializeDistribution,
    initializeStaker,
    stakeAtTimestamp,
} = require("../../utils");
const { toWei } = require("../../utils/conversion");
const { fastForwardTo, mineBlock } = require("../../utils/network");
const { Duration } = require("luxon");
const { ZERO_BN, MAXIMUM_VARIANCE } = require("../../constants");
const BN = require("bn.js");

const ERC20StakingRewardsDistribution = artifacts.require(
    "ERC20StakingRewardsDistribution"
);
const ERC20StakingRewardsDistributionFactory = artifacts.require(
    "ERC20StakingRewardsDistributionFactory"
);
const FirstRewardERC20 = artifacts.require("FirstRewardERC20");
const ZeroDecimalsRewardERC20 = artifacts.require("ZeroDecimalsRewardERC20");
const FirstStakableERC20 = artifacts.require("FirstStakableERC20");

contract(
    "ERC20StakingRewardsDistribution - Single reward/stakable token - Staking",
    () => {
        let erc20DistributionFactoryInstance,
            rewardsTokenInstance,
            zeroDecimalsRewardTokenInstance,
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
            zeroDecimalsRewardTokenInstance = await ZeroDecimalsRewardERC20.new();
            stakableTokenInstance = await FirstStakableERC20.new();
            stakerAddress = accounts[1];
        });

        it("should fail when initialization has not been done", async () => {
            try {
                const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                    { from: ownerAddress }
                );
                await erc20DistributionInstance.stake([0]);
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD21");
            }
        });

        it("should fail when program has not yet started", async () => {
            try {
                const {
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [3],
                    duration: 2,
                });
                await erc20DistributionInstance.stake([2], {
                    from: stakerAddress,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD21");
            }
        });

        it("should fail when the staker has not enough balance", async () => {
            try {
                const {
                    startingTimestamp,
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [2],
                    duration: 2,
                });
                await mineBlock(startingTimestamp);
                await erc20DistributionInstance.stake([100], {
                    from: stakerAddress,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain(
                    "ERC20: transfer amount exceeds balance"
                );
            }
        });

        it("should fail when no allowance was set by the staker", async () => {
            try {
                await stakableTokenInstance.mint(stakerAddress, 1);
                const {
                    startingTimestamp,
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [2],
                    duration: 2,
                });
                await mineBlock(startingTimestamp);
                await erc20DistributionInstance.stake([1], {
                    from: stakerAddress,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain(
                    "ERC20: transfer amount exceeds allowance"
                );
            }
        });

        it("should fail when not enough allowance was set by the staker", async () => {
            try {
                const {
                    startingTimestamp,
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [3],
                    duration: 2,
                });
                await stakableTokenInstance.mint(stakerAddress, 1);
                await stakableTokenInstance.approve(
                    erc20DistributionInstance.address,
                    1,
                    { from: stakerAddress }
                );
                // mint additional tokens to the staker for which we
                // don't set the correct allowance
                await stakableTokenInstance.mint(stakerAddress, 1);
                await mineBlock(startingTimestamp);
                await erc20DistributionInstance.stake([2], {
                    from: stakerAddress,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain(
                    "ERC20: transfer amount exceeds allowance"
                );
            }
        });

        it("should succeed in the right conditions", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const rewardTokens = [rewardsTokenInstance];
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens,
                rewardAmounts: [await toWei(1, rewardsTokenInstance)],
                duration: 2,
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
            for (let i = 0; i < rewardTokens.length; i++) {
                expect(
                    await erc20DistributionInstance.stakedTokensOf(
                        stakerAddress
                    )
                ).to.be.equalBn(stakedAmount);
            }
            expect(
                await erc20DistributionInstance.totalStakedTokensAmount()
            ).to.be.equalBn(stakedAmount);
        });

        it("should fail when the staking cap is surpassed", async () => {
            try {
                const stakedAmount = await toWei(11, stakableTokenInstance);
                const stakingCap = await toWei(10, stakableTokenInstance);
                const {
                    startingTimestamp,
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [2],
                    duration: 2,
                    stakingCap,
                });
                await initializeStaker({
                    erc20DistributionInstance,
                    stakableTokenInstance,
                    stakerAddress,
                    stakableAmount: stakedAmount,
                });
                await mineBlock(startingTimestamp);
                await erc20DistributionInstance.stake(stakedAmount, {
                    from: stakerAddress,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD10");
            }
        });

        it("should succeed when the staking cap is just hit", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const stakingCap = await toWei(10, stakableTokenInstance);
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [2],
                duration: 2,
                stakingCap,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress,
                stakableAmount: stakedAmount,
            });
            await mineBlock(startingTimestamp);
            await erc20DistributionInstance.stake(stakedAmount, {
                from: stakerAddress,
            });
        });

        it("should correctly consolidate rewards when the user stakes 2 times with a low decimals token, in a lengthy campaign", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const rewardAmount = await toWei(
                10000,
                zeroDecimalsRewardTokenInstance
            );
            const duration = new BN(
                Math.floor(Duration.fromObject({ months: 1 }).toMillis() / 1000)
            );
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [zeroDecimalsRewardTokenInstance],
                rewardAmounts: [rewardAmount],
                duration,
                stakingCap: 0,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            const halfStakableAmount = stakedAmount.div(new BN(2));
            await stakeAtTimestamp(
                erc20DistributionInstance,
                stakerAddress,
                halfStakableAmount,
                startingTimestamp
            );
            const preSecondStakeReward = await erc20DistributionInstance.rewards(
                0
            );
            expect(preSecondStakeReward.perStakedToken).to.be.equalBn(ZERO_BN);
            // fast forwarding to 1/20th of the campaign
            const secondStakingTimestamp = startingTimestamp.add(
                duration.div(new BN(20))
            );
            await fastForwardTo({ timestamp: secondStakingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                stakerAddress,
                halfStakableAmount,
                secondStakingTimestamp
            );
            const postSecondStakeRewards = await erc20DistributionInstance.rewards(
                0
            );
            // in the first stint, the staker staked alone for 1/10th of the distribution
            // calculate expected reward per staked token as if it were done onchain
            const firstStintDuration = secondStakingTimestamp.sub(
                startingTimestamp
            );
            const expectedRewardPerStakedToken = firstStintDuration
                .mul(rewardAmount)
                .mul(new BN(2).pow(new BN(112)))
                .div(halfStakableAmount.mul(duration));
            expect(postSecondStakeRewards.perStakedToken).to.be.equalBn(
                expectedRewardPerStakedToken
            );
            const onChainEarnedAmount = await erc20DistributionInstance.earnedRewardsOf(
                stakerAddress
            );
            expect(onChainEarnedAmount).to.have.length(1);
            expect(onChainEarnedAmount[0]).to.be.closeBn(
                halfStakableAmount // in order to check the consolidation of the first stint we need to use the staked amount in the first stint here, not the current onchain value, which is doubled
                    .mul(expectedRewardPerStakedToken)
                    .div(new BN(2).pow(new BN(112))),
                MAXIMUM_VARIANCE
            );
        });

        it("should fail when the user stakes but staking is disabled", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const rewardAmount = await toWei(
                10000,
                zeroDecimalsRewardTokenInstance
            );
            const duration = new BN(
                Math.floor(Duration.fromObject({ months: 1 }).toMillis() / 1000)
            );
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [zeroDecimalsRewardTokenInstance],
                rewardAmounts: [rewardAmount],
                duration,
                stakingCap: 0,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress,
                stakableAmount: stakedAmount,
            });
            await erc20DistributionFactoryInstance.pauseStaking({
                from: ownerAddress,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            const halfStakableAmount = stakedAmount.div(new BN(2));
            try {
                await stakeAtTimestamp(
                    erc20DistributionInstance,
                    stakerAddress,
                    halfStakableAmount,
                    startingTimestamp
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD25");
            }
        });
    }
);
