const BN = require("bn.js");
const { expect } = require("chai");
const { MAXIMUM_VARIANCE, ZERO_BN } = require("../../constants");
const {
    initializeDistribution,
    initializeStaker,
    stakeAtTimestamp,
    withdrawAtTimestamp,
    claimAllAtTimestamp,
} = require("../../utils");
const { toWei } = require("../../utils/conversion");
const {
    stopMining,
    startMining,
    fastForwardTo,
    getEvmTimestamp,
} = require("../../utils/network");

const ERC20StakingRewardsDistribution = artifacts.require(
    "ERC20StakingRewardsDistribution"
);
const ERC20StakingRewardsDistributionFactory = artifacts.require(
    "ERC20StakingRewardsDistributionFactory"
);
const FirstRewardERC20 = artifacts.require("FirstRewardERC20");
const FirstStakableERC20 = artifacts.require("FirstStakableERC20");

contract(
    "ERC20StakingRewardsDistribution - Single reward/stakable token - Claiming",
    () => {
        let erc20DistributionFactoryInstance,
            rewardsTokenInstance,
            stakableTokenInstance,
            ownerAddress,
            firstStakerAddress,
            secondStakerAddress,
            thirdStakerAddress;

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
            firstStakerAddress = accounts[1];
            secondStakerAddress = accounts[2];
            thirdStakerAddress = accounts[3];
        });

        it("should succeed in claiming the full reward if only one staker stakes right from the first second", async () => {
            const stakedAmount = await toWei(20, stakableTokenInstance);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration: 10,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({
                timestamp: startingTimestamp,
                mineBlockAfter: false,
            });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp
            );
            const stakerStartingTimestamp = await getEvmTimestamp();
            expect(stakerStartingTimestamp).to.be.equalBn(startingTimestamp);
            // make sure the distribution has ended
            await fastForwardTo({ timestamp: endingTimestamp.add(new BN(1)) });
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            expect(onchainStartingTimestamp).to.be.equalBn(startingTimestamp);
            expect(onchainEndingTimestamp).to.be.equalBn(endingTimestamp);
            const stakingDuration = onchainEndingTimestamp.sub(
                onchainStartingTimestamp
            );
            expect(stakingDuration).to.be.equalBn(new BN(10));
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.equalBn(rewardsAmount);
        });

        it("should fail when claiming zero rewards (claimAll)", async () => {
            const stakedAmount = await toWei(20, stakableTokenInstance);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration: 10,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            try {
                await erc20DistributionInstance.claimAll(firstStakerAddress, {
                    from: firstStakerAddress,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD23");
            }
        });

        it("should fail when claiming zero rewards (claim)", async () => {
            const stakedAmount = await toWei(20, stakableTokenInstance);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration: 10,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            try {
                await erc20DistributionInstance.claim([0], firstStakerAddress, {
                    from: firstStakerAddress,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD24");
            }
        });

        it("should succeed in claiming two rewards if two stakers stake exactly the same amount at different times", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: secondStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({
                timestamp: startingTimestamp,
                mineBlockAfter: false,
            });
            // make sure the staking operation happens as soon as possible
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp
            );
            const firstStakerStartingTimestamp = await getEvmTimestamp();
            expect(firstStakerStartingTimestamp).to.be.equalBn(
                startingTimestamp
            );
            // make half of the distribution time pass
            await fastForwardTo({
                timestamp: startingTimestamp.add(new BN(5)),
                mineBlockAfter: false,
            });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                secondStakerAddress,
                stakedAmount,
                startingTimestamp.add(new BN(5))
            );
            const secondStakerStartingTimestamp = await getEvmTimestamp();
            expect(secondStakerStartingTimestamp).to.be.equalBn(
                startingTimestamp.add(new BN(5))
            );
            await fastForwardTo({ timestamp: endingTimestamp });
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            expect(onchainStartingTimestamp).to.be.equalBn(startingTimestamp);
            expect(onchainEndingTimestamp).to.be.equalBn(endingTimestamp);
            expect(
                onchainEndingTimestamp.sub(onchainStartingTimestamp)
            ).to.be.equalBn(duration);
            // first staker staked for 10 seconds
            expect(
                onchainEndingTimestamp.sub(firstStakerStartingTimestamp)
            ).to.be.equalBn(new BN(10));
            // second staker staked for 5 seconds
            expect(
                onchainEndingTimestamp.sub(secondStakerStartingTimestamp)
            ).to.be.equalBn(new BN(5));
            const rewardPerSecond = rewardsAmount.div(duration);
            // the first staker had all of the rewards for 5 seconds and half of them for 5
            const expectedFirstStakerReward = rewardPerSecond
                .mul(new BN(5))
                .add(rewardPerSecond.mul(new BN(5)).div(new BN(2)));
            // the second staker had half of the rewards for 5 seconds
            const expectedSecondStakerReward = rewardPerSecond
                .div(new BN(2))
                .mul(new BN(5));
            // first staker claiming/balance checking
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedFirstStakerReward);
            // second staker claiming/balance checking
            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.equalBn(expectedSecondStakerReward);
        });

        it("should succeed in claiming three rewards if three stakers stake exactly the same amount at different times", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(12);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: secondStakerAddress,
                stakableAmount: stakedAmount,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: thirdStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({
                timestamp: startingTimestamp,
                mineBlockAfter: false,
            });
            // first staker stakes
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp
            );
            const firstStakerStartingTimestamp = await getEvmTimestamp();
            expect(firstStakerStartingTimestamp).to.be.equalBn(
                startingTimestamp
            );
            await fastForwardTo({
                timestamp: startingTimestamp.add(new BN(6)),
                mineBlockAfter: false,
            });
            // second staker stakes
            await stakeAtTimestamp(
                erc20DistributionInstance,
                secondStakerAddress,
                stakedAmount,
                startingTimestamp.add(new BN(6))
            );
            const secondStakerStartingTimestamp = await getEvmTimestamp();
            expect(secondStakerStartingTimestamp).to.be.equalBn(
                startingTimestamp.add(new BN(6))
            );
            await fastForwardTo({
                timestamp: secondStakerStartingTimestamp.add(new BN(3)),
                mineBlockAfter: false,
            });
            // third staker stakes
            await stakeAtTimestamp(
                erc20DistributionInstance,
                thirdStakerAddress,
                stakedAmount,
                secondStakerStartingTimestamp.add(new BN(3))
            );
            const thirdStakerStartingTimestamp = await getEvmTimestamp();
            expect(thirdStakerStartingTimestamp).to.be.equalBn(
                secondStakerStartingTimestamp.add(new BN(3))
            );
            // make sure the distribution has ended
            await fastForwardTo({
                timestamp: endingTimestamp.add(new BN(10)),
            });
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            expect(onchainStartingTimestamp).to.be.equalBn(startingTimestamp);
            expect(onchainEndingTimestamp).to.be.equalBn(endingTimestamp);
            expect(
                onchainEndingTimestamp.sub(onchainStartingTimestamp)
            ).to.be.equalBn(duration);

            // first staker staked for 12 seconds
            expect(
                onchainEndingTimestamp.sub(firstStakerStartingTimestamp)
            ).to.be.equalBn(new BN(12));
            // second staker staked for 6 seconds
            expect(
                onchainEndingTimestamp.sub(secondStakerStartingTimestamp)
            ).to.be.equalBn(new BN(6));
            // third staker staked for 3 seconds
            expect(
                onchainEndingTimestamp.sub(thirdStakerStartingTimestamp)
            ).to.be.equalBn(new BN(3));

            // the first staker had all of the rewards for 6 seconds,
            // half of them for 3 seconds and a third for 3 seconds
            const expectedFirstStakerReward = new BN("7083333333333333333");
            // the second staker had half of the rewards for 6 seconds
            // and a third for 3 seconds
            const expectedSecondStakerReward = new BN("2083333333333333333");
            // the third staker had a third of the rewards for 3 seconds
            const expectedThirdStakerReward = new BN("833333333333333333");

            // first staker claiming/balance checking
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedFirstStakerReward, MAXIMUM_VARIANCE);

            // second staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.closeBn(expectedSecondStakerReward, MAXIMUM_VARIANCE);

            // third staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(thirdStakerAddress, {
                from: thirdStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(thirdStakerAddress)
            ).to.be.closeBn(expectedThirdStakerReward, MAXIMUM_VARIANCE);
        });

        it("should succeed in claiming a reward if a staker stakes when the distribution has already started", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            // fast forward to half of the distribution duration
            await fastForwardTo({
                timestamp: startingTimestamp.add(new BN(5)),
                mineBlockAfter: false,
            });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp.add(new BN(5))
            );
            const stakerStartingTimestamp = await getEvmTimestamp();
            expect(stakerStartingTimestamp).to.be.equalBn(
                startingTimestamp.add(new BN(5))
            );
            await fastForwardTo({ timestamp: endingTimestamp });
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            expect(onchainStartingTimestamp).to.be.equalBn(startingTimestamp);
            expect(onchainEndingTimestamp).to.be.equalBn(endingTimestamp);
            // the staker staked for half of the duration
            expect(
                onchainEndingTimestamp.sub(stakerStartingTimestamp)
            ).to.be.equalBn(new BN(5));
            const rewardPerSecond = rewardsAmount.div(duration);
            // the staker had all of the rewards for 5 seconds
            const expectedFirstStakerReward = rewardPerSecond.mul(new BN(5));
            // claim and rewards balance check
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedFirstStakerReward, MAXIMUM_VARIANCE);
        });

        it("should fail in claiming 0 rewards if a staker stakes at the last second (literally)", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({
                timestamp: endingTimestamp.sub(new BN(1)),
                mineBlockAfter: false,
            });
            const stakerStartingTimestamp = endingTimestamp;
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                stakerStartingTimestamp
            );
            expect(stakerStartingTimestamp).to.be.equalBn(
                await getEvmTimestamp()
            );
            await fastForwardTo({ timestamp: endingTimestamp });
            const campaignEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            expect(
                campaignEndingTimestamp.sub(stakerStartingTimestamp)
            ).to.be.equalBn(ZERO_BN);
            try {
                await erc20DistributionInstance.claimAll(firstStakerAddress, {
                    from: firstStakerAddress,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD23");
            }
        });

        it("should succeed in claiming one rewards if a staker stakes at the last valid distribution second", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({
                timestamp: endingTimestamp.sub(new BN(1)),
                mineBlockAfter: false,
            });
            const stakerStartingTimestamp = endingTimestamp.sub(new BN(1));
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                stakerStartingTimestamp
            );
            expect(stakerStartingTimestamp).to.be.equalBn(
                await getEvmTimestamp()
            );
            await fastForwardTo({ timestamp: endingTimestamp });
            const campaignEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            expect(
                campaignEndingTimestamp.sub(stakerStartingTimestamp)
            ).to.be.equalBn(new BN(1));
            const rewardPerSecond = rewardsAmount.div(duration);
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(rewardPerSecond, MAXIMUM_VARIANCE);
        });

        it("should succeed in claiming two rewards if two stakers stake exactly the same amount at different times, and then the first staker withdraws a portion of his stake", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: secondStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({
                timestamp: startingTimestamp,
                mineBlockAfter: false,
            });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp
            );
            const firstStakerStartingTimestamp = await getEvmTimestamp();
            expect(firstStakerStartingTimestamp).to.be.equalBn(
                startingTimestamp
            );
            await fastForwardTo({
                timestamp: startingTimestamp.add(new BN(5)),
                mineBlockAfter: false,
            });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                secondStakerAddress,
                stakedAmount,
                startingTimestamp.add(new BN(5))
            );
            const secondStakerStartingTimestamp = await getEvmTimestamp();
            expect(secondStakerStartingTimestamp).to.be.equalBn(
                startingTimestamp.add(new BN(5))
            );
            // first staker withdraws at the eight second
            await fastForwardTo({
                timestamp: secondStakerStartingTimestamp.add(new BN(3)),
                mineBlockAfter: false,
            });
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount.div(new BN(2)),
                secondStakerStartingTimestamp.add(new BN(3))
            );
            const firstStakerWithdrawTimestamp = await getEvmTimestamp();
            expect(firstStakerWithdrawTimestamp).to.be.equalBn(
                secondStakerStartingTimestamp.add(new BN(3))
            );
            await fastForwardTo({ timestamp: endingTimestamp });
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            expect(onchainEndingTimestamp).to.be.equalBn(endingTimestamp);
            expect(onchainStartingTimestamp).to.be.equalBn(startingTimestamp);
            expect(
                onchainEndingTimestamp.sub(onchainStartingTimestamp)
            ).to.be.equalBn(duration);
            // first staker staked for 10 seconds
            expect(
                onchainEndingTimestamp.sub(firstStakerStartingTimestamp)
            ).to.be.equalBn(new BN(10));
            // first staker withdrew at second 8, 2 seconds before the end
            expect(
                onchainEndingTimestamp.sub(firstStakerWithdrawTimestamp)
            ).to.be.equalBn(new BN(2));
            // second staker staked for 5 seconds
            expect(
                onchainEndingTimestamp.sub(secondStakerStartingTimestamp)
            ).to.be.equalBn(new BN(5));
            const rewardPerSecond = rewardsAmount.div(duration);
            // the first staker had all of the rewards for 5 seconds, half of them for 3, and a third for 2
            const expectedFirstStakerReward = rewardPerSecond
                .mul(new BN(5))
                .add(rewardPerSecond.mul(new BN(3)).div(new BN(2)))
                .add(rewardPerSecond.mul(new BN(2)).div(new BN(3)));
            // the second staker had half of the rewards for 3 seconds and two thirds for 2
            const expectedSecondStakerReward = rewardPerSecond
                .div(new BN(2))
                .mul(new BN(3))
                .add(
                    rewardPerSecond.mul(new BN(2)).mul(new BN(2)).div(new BN(3))
                );
            // first staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedFirstStakerReward, MAXIMUM_VARIANCE);
            // second staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.closeBn(expectedSecondStakerReward, MAXIMUM_VARIANCE);
        });

        it("should succeed in claiming two rewards if two stakers both stake at the last valid distribution second", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: secondStakerAddress,
                stakableAmount: stakedAmount,
            });
            await stopMining();
            const stakingTimestamp = endingTimestamp.sub(new BN(1));
            await fastForwardTo({
                timestamp: stakingTimestamp,
                mineBlockAfter: false,
            });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                stakingTimestamp
            );
            await stakeAtTimestamp(
                erc20DistributionInstance,
                secondStakerAddress,
                stakedAmount,
                stakingTimestamp
            );
            expect(await getEvmTimestamp()).to.be.equalBn(stakingTimestamp);
            await startMining();
            await fastForwardTo({ timestamp: endingTimestamp });

            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            expect(
                onchainEndingTimestamp.sub(onchainStartingTimestamp)
            ).to.be.equalBn(duration);
            expect(onchainEndingTimestamp.sub(stakingTimestamp)).to.be.equalBn(
                new BN(1)
            );

            const rewardPerSecond = rewardsAmount.div(duration);
            // the first staker had half of the rewards for 1 second
            const expectedFirstStakerReward = rewardPerSecond.div(new BN(2));
            // the second staker had half of the rewards for 1 second
            const expectedSecondStakerReward = rewardPerSecond.div(new BN(2));

            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedFirstStakerReward, MAXIMUM_VARIANCE);

            // second staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.closeBn(expectedSecondStakerReward, MAXIMUM_VARIANCE);
        });

        it("should succeed in claiming a reward if a staker stakes at second n and then increases their stake", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const amountPerStake = stakedAmount.div(new BN(2));
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({
                timestamp: startingTimestamp,
                mineBlockAfter: false,
            });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                amountPerStake,
                startingTimestamp
            );
            const firstStakeStartingTimestamp = await getEvmTimestamp();
            expect(firstStakeStartingTimestamp).to.be.equalBn(
                startingTimestamp
            );
            await fastForwardTo({
                timestamp: startingTimestamp.add(new BN(5)),
                mineBlockAfter: false,
            });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                amountPerStake,
                startingTimestamp.add(new BN(5))
            );
            const secondStakeStartingTimestamp = await getEvmTimestamp();
            await fastForwardTo({ timestamp: endingTimestamp });
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            expect(
                onchainEndingTimestamp.sub(onchainStartingTimestamp)
            ).to.be.equalBn(duration);
            expect(
                onchainEndingTimestamp.sub(firstStakeStartingTimestamp)
            ).to.be.equalBn(new BN(10));
            expect(
                onchainEndingTimestamp.sub(secondStakeStartingTimestamp)
            ).to.be.equalBn(new BN(5));
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(rewardsAmount);
        });

        it("should succeed in claiming two rewards if two staker respectively stake and withdraw at the same second", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const rewardsAmount = await toWei(10, rewardsTokenInstance);
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [rewardsTokenInstance],
                rewardAmounts: [rewardsAmount],
                duration,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: secondStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp
            );
            const firstStakerStartingTimestamp = await getEvmTimestamp();
            expect(firstStakerStartingTimestamp).to.be.equalBn(
                startingTimestamp
            );
            await stopMining();
            const stakeAndWithdrawTimestamp = startingTimestamp.add(new BN(5));
            await fastForwardTo({
                timestamp: stakeAndWithdrawTimestamp,
                mineBlockAfter: false,
            });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                secondStakerAddress,
                stakedAmount,
                stakeAndWithdrawTimestamp
            );
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                stakeAndWithdrawTimestamp
            );
            const secondStakerStartingTimestamp = await getEvmTimestamp();
            const firstStakerWithdrawTimestamp = await getEvmTimestamp();
            await startMining();
            expect(secondStakerStartingTimestamp).to.be.equalBn(
                stakeAndWithdrawTimestamp
            );
            expect(firstStakerWithdrawTimestamp).to.be.equalBn(
                stakeAndWithdrawTimestamp
            );
            await fastForwardTo({ timestamp: endingTimestamp });
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            expect(
                onchainEndingTimestamp.sub(onchainStartingTimestamp)
            ).to.be.equalBn(duration);
            expect(
                firstStakerWithdrawTimestamp.sub(firstStakerStartingTimestamp)
            ).to.be.equalBn(new BN(5));
            expect(
                onchainEndingTimestamp.sub(secondStakerStartingTimestamp)
            ).to.be.equalBn(new BN(5));

            const rewardPerSecond = rewardsAmount.div(duration);
            // both stakers had all of the rewards for 5 seconds
            const expectedReward = rewardPerSecond.mul(new BN(5));

            // first staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedReward);

            // second staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.equalBn(expectedReward);
        });

        it("should succeed when staggered operations happen (test that found a previous bug)", async () => {
            // what happens here:
            // - First staker stakes
            // - Second staker stakes
            // - First staker fully withdraws
            // - Second staker fully withdraws (no more staked tokens in the contract)
            // - First staker claims all
            // - Second staker claims all
            // - First staker restakes right in the ending 2 seconds
            // - First staker claims accrued rewards after the campaign ended

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
                rewardAmounts: [await toWei(10, rewardsTokenInstance)],
                duration: 10,
                stakingCap: 0,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount.mul(new BN(2)),
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: secondStakerAddress,
                stakableAmount: stakedAmount,
            });

            // first staker stakes at the start
            await fastForwardTo({ timestamp: startingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp
            );

            // second staker stakes at 3 seconds
            const secondStakingTimestamp = startingTimestamp.add(new BN(3));
            await fastForwardTo({ timestamp: secondStakingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                secondStakerAddress,
                stakedAmount,
                secondStakingTimestamp
            );

            // first staker withdraws at 5 seconds
            const firstWithdrawingTimestamp = secondStakingTimestamp.add(
                new BN(2)
            );
            await fastForwardTo({ timestamp: firstWithdrawingTimestamp });
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                firstWithdrawingTimestamp
            );

            // second staker withdraws at 6 seconds
            const secondWithdrawingTimestamp = firstWithdrawingTimestamp.add(
                new BN(1)
            );
            await fastForwardTo({ timestamp: secondWithdrawingTimestamp });
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                secondStakerAddress,
                stakedAmount,
                secondWithdrawingTimestamp
            );

            // first staker claims reward and at stakes at 8 seconds
            await stopMining();
            const firstClaimAndRestakeTimestamp = secondWithdrawingTimestamp.add(
                new BN(2)
            );
            await fastForwardTo({
                timestamp: firstClaimAndRestakeTimestamp,
                mineBlockAfter: false,
            });
            await claimAllAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                firstStakerAddress,
                firstClaimAndRestakeTimestamp
            );
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                firstClaimAndRestakeTimestamp
            );
            expect(await getEvmTimestamp()).to.be.equalBn(
                firstClaimAndRestakeTimestamp
            );
            await startMining();

            // second staker now claims their previously accrued rewards. With the found and now fixed bug, this
            // would have reverted due to the fact that when the first staker claimed, the reward per staked token for
            // each reward token was put to 0, alongside the consolidated reward per staked token FOR THE FIRST STAKER ONLY.
            // Issue is that the consolidated reward per staked token of the second staker wasn't put to zero.
            // When then consolidating the reward in the last consolidation period for the second staker, when claiming
            // their reward in the following instruction, a calculation was made:
            // `reward.perStakedToken - staker.consolidatedRewardPerStakedToken[reward.token]`, to account for the last
            // consolidation checkpointing. In this scenario, reward.perStakedToken was zero,
            // while the consolidated amount wasn't. This caused an underflow, which now reverts in Solidity 0.8.0.
            const secondClaimTimestamp = firstClaimAndRestakeTimestamp.add(
                new BN(1)
            );
            await fastForwardTo({
                timestamp: secondClaimTimestamp,
            });
            await claimAllAtTimestamp(
                erc20DistributionInstance,
                secondStakerAddress,
                secondStakerAddress,
                secondClaimTimestamp
            );

            // fast forwarding to the end of the campaign
            await fastForwardTo({
                timestamp: endingTimestamp,
            });

            // first staker staked at the start for 5 seconds, while the second staked at 3 seconds
            // for 3 seconds. The two stakers overlapped by a grand total of 2 seconds.
            // The first staker then staked again in the last 2 seconds, but we'll account for
            // this and claim these rewards later in the test.

            // First staker got full rewards for 3 seconds and half rewards for 2 seconds. At a rate
            // of 1 reward token/second, this translates to a reward of 3 + (0.5 * 2) = 4
            const expectedFirstStakerReward = new BN(
                await toWei(4, rewardsTokenInstance)
            );

            // Second staker got full rewards for 1 second and half rewards for 2 seconds. At a rate
            // of 1 reward token/second, this translates to a reward of 1 + (0.5 * 2) = 2
            const expectedSecondStakerReward = new BN(
                await toWei(2, rewardsTokenInstance)
            );

            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedFirstStakerReward, MAXIMUM_VARIANCE);
            expect(
                await rewardsTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.closeBn(expectedSecondStakerReward, MAXIMUM_VARIANCE);

            // used to see how much stuff was actually claimed in the second claim
            const preClaimBalance = await rewardsTokenInstance.balanceOf(
                firstStakerAddress
            );
            // now claiming the remaining rewards for the first staker (mentioned in the comment above)
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            // the first staker staked at the end for 2 seconds. At a reward rate of 1 token/second,
            // 2 reward tokens are expected to be claimed
            const postClaimBalance = await rewardsTokenInstance.balanceOf(
                firstStakerAddress
            );
            const expectedRemainingReward = await toWei(
                2,
                rewardsTokenInstance
            );
            expect(postClaimBalance.sub(preClaimBalance)).to.be.closeBn(
                expectedRemainingReward,
                MAXIMUM_VARIANCE
            );

            // we also test recovery for good measure. There have been staked tokens in the contract
            // for all but 2 seconds (first staker staked at the start for 5 seconds and second staker
            // staked at second 3 for 3 seconds, overlapping for 2, and then first staker restaked
            // at the 8th second until the end)
            await erc20DistributionInstance.recoverUnassignedRewards({
                from: ownerAddress,
            });
            const expectedRecoveredReward = await toWei(
                2,
                rewardsTokenInstance
            );
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.closeBn(expectedRecoveredReward, MAXIMUM_VARIANCE);

            // At this point all the tokens minus some wei due to integer truncation should
            // have been recovered from the contract.
            // Initial reward was 10 tokens, the first staker got 6 in total, the second staker
            // 2, and the owner recovered 2.
        });
    }
);
