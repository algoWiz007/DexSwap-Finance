const BN = require("bn.js");
const { expect } = require("chai");
const { ZERO_BN } = require("../../constants");
const {
    initializeDistribution,
    initializeStaker,
    withdrawAtTimestamp,
    stakeAtTimestamp,
    claimAllAtTimestamp,
    recoverUnassignedRewardsAtTimestamp,
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
    "ERC20StakingRewardsDistribution - Single reward/stakable token - Reward recovery",
    () => {
        let erc20DistributionFactoryInstance,
            rewardsTokenInstance,
            stakableTokenInstance,
            ownerAddress,
            firstStakerAddress,
            secondStakerAddress;

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
        });

        it("should fail when the distribution is not initialized", async () => {
            try {
                const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                    { from: ownerAddress }
                );
                await erc20DistributionInstance.recoverUnassignedRewards();
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
                    rewardAmounts: [11],
                    duration: 10,
                });
                await erc20DistributionInstance.recoverUnassignedRewards();
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD20");
            }
        });

        it("should recover all of the rewards when the distribution ended and no staker joined", async () => {
            const rewardsAmount = await toWei(100, rewardsTokenInstance);
            const {
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
            // at the start of the distribution, the owner deposited the reward
            // into the staking contract, so theur balance is 0
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(ZERO_BN);
            await fastForwardTo({ timestamp: endingTimestamp });
            await erc20DistributionInstance.recoverUnassignedRewards();
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(rewardsAmount);
        });

        it("should put the recoverable rewards variable to 0 when recovered", async () => {
            const rewardsAmount = await toWei(100, rewardsTokenInstance);
            const {
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
            await fastForwardTo({ timestamp: endingTimestamp });
            await erc20DistributionInstance.recoverUnassignedRewards();
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(rewardsAmount);
            expect(
                await erc20DistributionInstance.recoverableUnassignedReward(
                    rewardsTokenInstance.address
                )
            ).to.be.equalBn(ZERO_BN);
        });

        it("should always send funds to the contract's owner, even when called by another account", async () => {
            const rewardsAmount = await toWei(100, rewardsTokenInstance);
            const {
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
            // at the start of the distribution, the owner deposited the reward
            // into the staking contract, so theur balance is 0
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(ZERO_BN);
            await fastForwardTo({ timestamp: endingTimestamp });
            await erc20DistributionInstance.recoverUnassignedRewards({
                from: secondStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.equalBn(ZERO_BN);
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(rewardsAmount);
        });

        it("should recover half of the rewards when only one staker joined for half of the duration", async () => {
            const rewardsAmount = await toWei(100, rewardsTokenInstance);
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
                stakableAmount: 1,
            });
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(ZERO_BN);
            // stake after 5 seconds until the end of the distribution
            const stakingTimestamp = startingTimestamp.add(new BN(5));
            await fastForwardTo({ timestamp: stakingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                stakingTimestamp
            );
            await fastForwardTo({ timestamp: endingTimestamp });
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            // staker staked for 5 seconds
            expect(onchainEndingTimestamp.sub(stakingTimestamp)).to.be.equalBn(
                new BN(5)
            );
            // staker claims their reward
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(await toWei("50", rewardsTokenInstance));
            await erc20DistributionInstance.recoverUnassignedRewards();
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(await toWei("50", rewardsTokenInstance));
        });

        it("should recover half of the rewards when two stakers stake the same time", async () => {
            const rewardsAmount = await toWei(100, rewardsTokenInstance);
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
                stakableAmount: 1,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: secondStakerAddress,
                stakableAmount: 1,
            });
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(ZERO_BN);
            // stake after 5 seconds until the end of the distribution
            await stopMining();
            const stakingTimestamp = startingTimestamp.add(new BN(5));
            await fastForwardTo({ timestamp: stakingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                stakingTimestamp
            );
            await stakeAtTimestamp(
                erc20DistributionInstance,
                secondStakerAddress,
                [1],
                stakingTimestamp
            );
            expect(await getEvmTimestamp()).to.be.equalBn(stakingTimestamp);
            await startMining();
            await fastForwardTo({ timestamp: endingTimestamp });
            const distributionEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            // each staker staked for 5 seconds
            expect(
                distributionEndingTimestamp.sub(stakingTimestamp)
            ).to.be.equalBn(new BN(5));
            // stakers claim their reward
            const expectedReward = await toWei("25", rewardsTokenInstance);
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedReward);
            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.equalBn(expectedReward);
            await erc20DistributionInstance.recoverUnassignedRewards();
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(rewardsAmount.div(new BN(2)));
        });

        it("should recover a third of the rewards when a staker stakes for two thirds of the distribution duration", async () => {
            const rewardsAmount = await toWei(100, rewardsTokenInstance);
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
                duration: 12,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: 1,
            });
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(ZERO_BN);
            // stake after 4 seconds until the end of the distribution
            const stakingTimestamp = startingTimestamp.add(new BN(4));
            await fastForwardTo({ timestamp: stakingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                stakingTimestamp
            );
            await fastForwardTo({ timestamp: endingTimestamp });
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            expect(onchainEndingTimestamp.sub(stakingTimestamp)).to.be.equalBn(
                new BN(8)
            );
            // staker claims their reward
            const expectedReward = new BN("66666666666666666666");
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedReward);
            await erc20DistributionInstance.recoverUnassignedRewards();
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(new BN("33333333333333333333"));
        });

        it("should recover two thirds of the rewards when a staker stakes for a third of the distribution duration, right in the middle", async () => {
            const rewardsAmount = await toWei(100, rewardsTokenInstance);
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
                duration: 12,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: 1,
            });
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(ZERO_BN);
            // stake after 4 second until the 8th second
            const stakingTimestamp = startingTimestamp.add(new BN(4));
            await fastForwardTo({ timestamp: stakingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                stakingTimestamp
            );
            const withdrawTimestamp = stakingTimestamp.add(new BN(4));
            await fastForwardTo({ timestamp: withdrawTimestamp });
            // withdraw after 4 seconds, occupying 4 seconds in total
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                withdrawTimestamp
            );
            await fastForwardTo({ timestamp: endingTimestamp });

            expect(withdrawTimestamp.sub(stakingTimestamp)).to.be.equalBn(
                new BN(4)
            );
            // staker claims their reward
            const expectedReward = new BN("33333333333333333333");
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedReward);
            await erc20DistributionInstance.recoverUnassignedRewards();
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(new BN("66666666666666666666"));
        });

        it("should recover two thirds of the rewards when a staker stakes for a third of the distribution duration, in the end period", async () => {
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
                duration: 12,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: 1,
            });
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(ZERO_BN);
            const stakingTimestamp = startingTimestamp.add(new BN(8));
            await fastForwardTo({ timestamp: stakingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                stakingTimestamp
            );
            await fastForwardTo({ timestamp: endingTimestamp });

            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            expect(onchainEndingTimestamp.sub(stakingTimestamp)).to.be.equalBn(
                new BN(4)
            );
            // staker claims their reward
            const expectedReward = new BN("3333333333333333333");
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedReward);
            await erc20DistributionInstance.recoverUnassignedRewards();
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(new BN("6666666666666666666"));
        });

        it("should recover the unassigned rewards when a staker stakes for a certain period, withdraws, stakes again, and withdraws again", async () => {
            const rewardsAmount = await toWei(100, rewardsTokenInstance);
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
                duration: 12,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: 1,
            });
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(ZERO_BN);
            const firstStakingTimestamp = startingTimestamp;
            await fastForwardTo({ timestamp: firstStakingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                firstStakingTimestamp
            );

            const firstWithdrawTimestamp = firstStakingTimestamp.add(new BN(3));
            await fastForwardTo({ timestamp: firstWithdrawTimestamp });
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                firstWithdrawTimestamp
            );

            const secondStakingTimestamp = firstWithdrawTimestamp.add(
                new BN(3)
            );
            // reapproving the stakable token before staking for a second time
            await stakableTokenInstance.approve(
                erc20DistributionInstance.address,
                1,
                { from: firstStakerAddress }
            );
            await stopMining();
            await fastForwardTo({ timestamp: secondStakingTimestamp });
            // should be able to immediately claim the first unassigned rewards from the first 3 empty seconds
            await claimAllAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                firstStakerAddress,
                secondStakingTimestamp
            );
            await recoverUnassignedRewardsAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                secondStakingTimestamp
            );
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                secondStakingTimestamp
            );
            expect(await getEvmTimestamp()).to.be.equalBn(
                secondStakingTimestamp
            );
            await startMining();
            // recoverable unassigned rewards should have been put to 0
            expect(
                await erc20DistributionInstance.recoverableUnassignedReward(
                    rewardsTokenInstance.address
                )
            ).to.be.equalBn(ZERO_BN);

            const secondWithdrawTimestamp = secondStakingTimestamp.add(
                new BN(3)
            );
            await fastForwardTo({ timestamp: secondWithdrawTimestamp });
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                secondWithdrawTimestamp
            );

            await fastForwardTo({ timestamp: endingTimestamp });

            // the staker staked for 6 seconds total
            const expectedReward = await toWei("50", rewardsTokenInstance);
            // claiming for the second time
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedReward);

            // the owner should already have some recovered reward tokens from above
            const expectedRemainingReward = await toWei(
                "25",
                rewardsTokenInstance
            );
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(expectedRemainingReward);
            expect(
                await erc20DistributionInstance.recoverableUnassignedReward(
                    rewardsTokenInstance.address
                )
            ).to.be.equalBn(expectedRemainingReward);
            // claiming the unassigned rewards that accrued starting from the second withdraw
            await erc20DistributionInstance.recoverUnassignedRewards();
            expect(
                await erc20DistributionInstance.recoverableUnassignedReward(
                    rewardsTokenInstance.address
                )
            ).to.be.equalBn(ZERO_BN);
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(expectedRemainingReward.mul(new BN(2)));
        });

        it("should recover the unassigned rewards when a staker stakes for a certain period, withdraws, stakes again, withdraws again, and there's a direct transfer of rewards in the contract", async () => {
            const rewardsAmount = await toWei(100, rewardsTokenInstance);
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
                duration: 12,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: 1,
            });
            // directly mint rewards to the contract (should be recovered at the first recover call)
            const firstMintedAmount = await toWei(10, rewardsTokenInstance);
            await rewardsTokenInstance.mint(
                erc20DistributionInstance.address,
                firstMintedAmount
            );
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(ZERO_BN);
            const firstStakingTimestamp = startingTimestamp;
            await fastForwardTo({ timestamp: firstStakingTimestamp });
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                firstStakingTimestamp
            );

            const firstWithdrawTimestamp = firstStakingTimestamp.add(new BN(3));
            await fastForwardTo({ timestamp: firstWithdrawTimestamp });
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                firstWithdrawTimestamp
            );

            const secondStakingTimestamp = firstWithdrawTimestamp.add(
                new BN(3)
            );
            // reapproving the stakable token before staking for a second time
            await stakableTokenInstance.approve(
                erc20DistributionInstance.address,
                1,
                { from: firstStakerAddress }
            );
            await stopMining();
            await fastForwardTo({ timestamp: secondStakingTimestamp });
            // should be able to immediately claim the first unassigned rewards from the first 3 empty seconds
            await claimAllAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                firstStakerAddress,
                secondStakingTimestamp
            );
            // should recover the first direct reward token transfer
            await recoverUnassignedRewardsAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                secondStakingTimestamp
            );
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                secondStakingTimestamp
            );
            expect(await getEvmTimestamp()).to.be.equalBn(
                secondStakingTimestamp
            );
            await startMining();
            // recoverable unassigned rewards should have been put to 0
            expect(
                await erc20DistributionInstance.recoverableUnassignedReward(
                    rewardsTokenInstance.address
                )
            ).to.be.equalBn(ZERO_BN);

            // directly mint rewards to the contract for the second time
            // (should be recovered at the first recover call)
            const secondMintedAmount = await toWei(20, rewardsTokenInstance);
            await rewardsTokenInstance.mint(
                erc20DistributionInstance.address,
                secondMintedAmount
            );
            const secondWithdrawTimestamp = secondStakingTimestamp.add(
                new BN(3)
            );
            await fastForwardTo({ timestamp: secondWithdrawTimestamp });
            await withdrawAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                [1],
                secondWithdrawTimestamp
            );

            await fastForwardTo({ timestamp: endingTimestamp });

            // the staker staked for 6 seconds total
            const expectedReward = await toWei("50", rewardsTokenInstance);
            // claiming for the second time
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await rewardsTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedReward);

            // the owner should already have some recovered reward tokens from above
            // (also the first minted tokens)
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(
                firstMintedAmount.add(await toWei(25, rewardsTokenInstance))
            );
            // at this point recoverable rewards should be the minted amount sent to the contract
            // (20) plus 3 seconds when the contract did not have any staked amount  (at 100 total
            // reward tokens for a 12 seconds duration, this would be 100/12*3 = 25).
            // The total amount recoverable should be 45
            expect(
                await erc20DistributionInstance.recoverableUnassignedReward(
                    rewardsTokenInstance.address
                )
            ).to.be.equalBn(await toWei(45, rewardsTokenInstance));
            await erc20DistributionInstance.recoverUnassignedRewards();
            // claiming the unassigned rewards that accrued starting from the second withdraw
            expect(
                await erc20DistributionInstance.recoverableUnassignedReward(
                    rewardsTokenInstance.address
                )
            ).to.be.equalBn(ZERO_BN);
            expect(
                await rewardsTokenInstance.balanceOf(ownerAddress)
            ).to.be.equalBn(
                firstMintedAmount
                    .add(secondMintedAmount)
                    .add(await toWei(50, rewardsTokenInstance))
            );
        });
    }
);
