const BN = require("bn.js");
const { expect } = require("chai");
const { MAXIMUM_VARIANCE, ZERO_BN } = require("../../constants");
const {
    initializeDistribution,
    initializeStaker,
    stakeAtTimestamp,
    withdrawAtTimestamp,
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
const SecondRewardERC20 = artifacts.require("SecondRewardERC20");
const FirstStakableERC20 = artifacts.require("FirstStakableERC20");

contract(
    "ERC20StakingRewardsDistribution - Single stakable, multi reward tokens - Claiming",
    () => {
        let erc20DistributionFactoryInstance,
            firstRewardTokenInstance,
            secondRewardTokenInstance,
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
            firstRewardTokenInstance = await FirstRewardERC20.new();
            secondRewardTokenInstance = await SecondRewardERC20.new();
            stakableTokenInstance = await FirstStakableERC20.new();
            firstStakerAddress = accounts[1];
            secondStakerAddress = accounts[2];
            thirdStakerAddress = accounts[3];
        });

        it("should succeed in claiming the full reward if only one staker stakes right from the first second", async () => {
            const stakedAmount = await toWei(20, stakableTokenInstance);
            const firstRewardAmount = await toWei(10, firstRewardTokenInstance);
            const secondRewardAmount = await toWei(
                20,
                secondRewardTokenInstance
            );
            const {
                erc20DistributionInstance,
                startingTimestamp,
                endingTimestamp,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardAmount, secondRewardAmount],
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
            const firstStakerRewardsTokenBalance = await firstRewardTokenInstance.balanceOf(
                firstStakerAddress
            );
            expect(firstStakerRewardsTokenBalance).to.equalBn(
                firstRewardAmount
            );
            // additional checks to be extra safe
            expect(firstStakerRewardsTokenBalance).to.equalBn(
                firstRewardAmount
            );

            const secondStakerRewardsTokenBalance = await secondRewardTokenInstance.balanceOf(
                firstStakerAddress
            );
            expect(secondStakerRewardsTokenBalance).to.equalBn(
                secondRewardAmount
            );
            // additional checks to be extra safe
            expect(secondStakerRewardsTokenBalance).to.equalBn(
                secondRewardAmount
            );
        });

        it("should fail when claiming zero rewards (claimAll)", async () => {
            const stakedAmount = await toWei(20, stakableTokenInstance);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                20,
                secondRewardTokenInstance
            );
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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

        it("should succeed when claiming zero first rewards and all of the second rewards", async () => {
            const stakedAmount = await toWei(20, stakableTokenInstance);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                20,
                secondRewardTokenInstance
            );
            const {
                erc20DistributionInstance,
                startingTimestamp,
                endingTimestamp,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
                duration: 10,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            // make sure the staking operation happens as soon as possible
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp
            );
            await fastForwardTo({ timestamp: endingTimestamp.add(new BN(1)) });
            // staker staked for all of the campaign's duration
            await erc20DistributionInstance.claim(
                [firstRewardsAmount, 0],
                firstStakerAddress,
                { from: firstStakerAddress }
            );
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(firstRewardsAmount);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(ZERO_BN);
            expect(
                await firstRewardTokenInstance.balanceOf(
                    erc20DistributionInstance.address
                )
            ).to.be.equalBn(ZERO_BN);
            expect(
                await secondRewardTokenInstance.balanceOf(
                    erc20DistributionInstance.address
                )
            ).to.be.equalBn(secondRewardsAmount);
        });

        it("should succeed when claiming zero first reward and all of the second reward", async () => {
            const stakedAmount = await toWei(20, stakableTokenInstance);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                20,
                secondRewardTokenInstance
            );
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
                duration: 10,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            // make sure the staking operation happens as soon as possible
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp
            );
            await fastForwardTo({ timestamp: endingTimestamp.add(new BN(1)) });
            // staker staked for all of the campaign's duration
            await erc20DistributionInstance.claim(
                [0, secondRewardsAmount],
                firstStakerAddress,
                { from: firstStakerAddress }
            );
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(ZERO_BN);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(secondRewardsAmount);
            expect(
                await firstRewardTokenInstance.balanceOf(
                    erc20DistributionInstance.address
                )
            ).to.be.equalBn(firstRewardsAmount);
            expect(
                await secondRewardTokenInstance.balanceOf(
                    erc20DistributionInstance.address
                )
            ).to.be.equalBn(ZERO_BN);
        });

        it("should succeed when claiming zero first rewards and part of the second rewards", async () => {
            const stakedAmount = await toWei(20, stakableTokenInstance);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                20,
                secondRewardTokenInstance
            );
            const {
                erc20DistributionInstance,
                startingTimestamp,
                endingTimestamp,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
                duration: 10,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            // make sure the staking operation happens as soon as possible
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp
            );
            await fastForwardTo({ timestamp: endingTimestamp.add(new BN(1)) });
            // staker staked for all of the campaign's duration, but we only claim half of the first reward
            const halfFirstRewardsAmount = firstRewardsAmount.div(new BN(2));
            await erc20DistributionInstance.claim(
                [halfFirstRewardsAmount, 0],
                firstStakerAddress,
                { from: firstStakerAddress }
            );
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(halfFirstRewardsAmount);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(ZERO_BN);
            expect(
                await firstRewardTokenInstance.balanceOf(
                    erc20DistributionInstance.address
                )
            ).to.be.equalBn(halfFirstRewardsAmount);
            expect(
                await secondRewardTokenInstance.balanceOf(
                    erc20DistributionInstance.address
                )
            ).to.be.equalBn(secondRewardsAmount);
        });

        it("should succeed when claiming zero first reward and all of the second reward", async () => {
            const stakedAmount = await toWei(20, stakableTokenInstance);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                20,
                secondRewardTokenInstance
            );
            const {
                erc20DistributionInstance,
                startingTimestamp,
                endingTimestamp,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
                duration: 10,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            // make sure the staking operation happens as soon as possible
            await stakeAtTimestamp(
                erc20DistributionInstance,
                firstStakerAddress,
                stakedAmount,
                startingTimestamp
            );
            await fastForwardTo({ timestamp: endingTimestamp.add(new BN(1)) });
            // staker staked for all of the campaign's duration, but we only claim half of the second reward
            const halfSecondRewardsAmount = secondRewardsAmount.div(new BN(2));
            await erc20DistributionInstance.claim(
                [0, halfSecondRewardsAmount],
                firstStakerAddress,
                { from: firstStakerAddress }
            );
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(ZERO_BN);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(halfSecondRewardsAmount);
            expect(
                await firstRewardTokenInstance.balanceOf(
                    erc20DistributionInstance.address
                )
            ).to.be.equalBn(firstRewardsAmount);
            expect(
                await secondRewardTokenInstance.balanceOf(
                    erc20DistributionInstance.address
                )
            ).to.be.equalBn(halfSecondRewardsAmount);
        });

        it("should succeed in claiming two multiple rewards if two stakers stake exactly the same amount at different times", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardAmount = await toWei(10, firstRewardTokenInstance);
            const secondRewardAmount = await toWei(
                50,
                secondRewardTokenInstance
            );
            const {
                erc20DistributionInstance,
                startingTimestamp,
                endingTimestamp,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardAmount, secondRewardAmount],
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
            const firstRewardPerSecond = firstRewardAmount.div(
                onchainEndingTimestamp.sub(onchainStartingTimestamp)
            );
            const secondRewardPerSecond = secondRewardAmount.div(
                onchainEndingTimestamp.sub(onchainStartingTimestamp)
            );
            // the first staker had all of the rewards for 5 seconds and half of them for 5
            const expectedFirstFirstStakerReward = firstRewardPerSecond
                .mul(new BN(5))
                .add(firstRewardPerSecond.mul(new BN(5)).div(new BN(2)));
            const expectedSecondFirstStakerReward = secondRewardPerSecond
                .mul(new BN(5))
                .add(secondRewardPerSecond.mul(new BN(5)).div(new BN(2)));
            // the second staker had half of the rewards for 5 seconds
            const expectedFirstSecondStakerReward = firstRewardPerSecond
                .div(new BN(2))
                .mul(new BN(5));
            const expectedSecondSecondStakerReward = secondRewardPerSecond
                .div(new BN(2))
                .mul(new BN(5));
            // first staker claiming/balance checking
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedFirstFirstStakerReward);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedSecondFirstStakerReward);
            // second staker claiming/balance checking
            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.equalBn(expectedFirstSecondStakerReward);
            expect(
                await secondRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.equalBn(expectedSecondSecondStakerReward);
        });

        it("should succeed in claiming three rewards if three stakers stake exactly the same amount at different times", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(12);
            const firstRewardAmount = await toWei(12, firstRewardTokenInstance);
            const secondRewardAmount = await toWei(
                30,
                secondRewardTokenInstance
            );
            const {
                erc20DistributionInstance,
                startingTimestamp,
                endingTimestamp,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardAmount, secondRewardAmount],
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

            const firstRewardPerSecond = firstRewardAmount.div(duration);
            const secondRewardPerSecond = secondRewardAmount.div(duration);
            // the first staker had all of the rewards for 6 seconds,
            // half of them for 3 seconds and a third for 3 seconds
            const expectedFirstFirstStakerReward = firstRewardPerSecond
                .mul(new BN(6))
                .add(firstRewardPerSecond.mul(new BN(3)).div(new BN(2)))
                .add(firstRewardPerSecond.mul(new BN(3)).div(new BN(3)));
            const expectedSecondFirstStakerReward = secondRewardPerSecond
                .mul(new BN(6))
                .add(secondRewardPerSecond.mul(new BN(3)).div(new BN(2)))
                .add(secondRewardPerSecond.mul(new BN(3)).div(new BN(3)));
            // the second staker had half of the rewards for 6 seconds
            // and a third for 3 seconds
            const expectedFirstSecondStakerReward = firstRewardPerSecond
                .mul(new BN(3))
                .div(new BN(2))
                .add(firstRewardPerSecond.mul(new BN(3)).div(new BN(3)));
            const expectedSecondSecondStakerReward = secondRewardPerSecond
                .mul(new BN(3))
                .div(new BN(2))
                .add(secondRewardPerSecond.mul(new BN(3)).div(new BN(3)));
            // the third staker had a third of the rewards for 3 seconds
            // (math says that they'd simply get a full second reward for 3 seconds,
            // but let's do the calculation anyway for added clarity)
            const expectedFirstThirdStakerReward = firstRewardPerSecond
                .mul(new BN(3))
                .div(new BN(3));
            const expectedSecondThirdStakerReward = secondRewardPerSecond
                .mul(new BN(3))
                .div(new BN(3));

            // first staker claiming/balance checking
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedFirstFirstStakerReward, MAXIMUM_VARIANCE);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedSecondFirstStakerReward, MAXIMUM_VARIANCE);

            // second staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.closeBn(expectedFirstSecondStakerReward, MAXIMUM_VARIANCE);
            expect(
                await secondRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.closeBn(expectedSecondSecondStakerReward, MAXIMUM_VARIANCE);

            // third staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(thirdStakerAddress, {
                from: thirdStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(thirdStakerAddress)
            ).to.be.closeBn(expectedFirstThirdStakerReward, MAXIMUM_VARIANCE);
            expect(
                await secondRewardTokenInstance.balanceOf(thirdStakerAddress)
            ).to.be.closeBn(expectedSecondThirdStakerReward, MAXIMUM_VARIANCE);
        });

        it("should succeed in claiming a reward if a staker stakes when the distribution has already started", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                20,
                secondRewardTokenInstance
            );
            const {
                erc20DistributionInstance,
                startingTimestamp,
                endingTimestamp,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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
            // claim and rewards balance check
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(await toWei("5", firstRewardTokenInstance));
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(await toWei("10", secondRewardTokenInstance));
        });

        it("should fail in claiming 0 rewards if a staker stakes at the last second (literally)", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                10,
                secondRewardTokenInstance
            );
            const {
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                20,
                secondRewardTokenInstance
            );
            const {
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
                duration,
            });
            await initializeStaker({
                erc20DistributionInstance,
                stakableTokenInstance,
                stakerAddress: firstStakerAddress,
                stakableAmount: stakedAmount,
            });
            const stakerStartingTimestamp = endingTimestamp.sub(new BN(1));
            await fastForwardTo({ timestamp: stakerStartingTimestamp });
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

            const firstRewardPerSecond = firstRewardsAmount.div(duration);
            const secondRewardPerSecond = secondRewardsAmount.div(duration);
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(firstRewardPerSecond, MAXIMUM_VARIANCE);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(secondRewardPerSecond, MAXIMUM_VARIANCE);
        });

        it("should succeed in claiming two rewards if two stakers stake exactly the same amount at different times, and then the first staker withdraws a portion of his stake", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                40,
                secondRewardTokenInstance
            );
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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
            const firstRewardPerSecond = firstRewardsAmount.div(duration);
            const secondRewardPerSecond = secondRewardsAmount.div(duration);
            // the first staker had all of the rewards for 5 seconds, half of them for 3, and a third for 2
            const expectedFirstFirstStakerReward = firstRewardPerSecond
                .mul(new BN(5))
                .add(firstRewardPerSecond.mul(new BN(3)).div(new BN(2)))
                .add(firstRewardPerSecond.mul(new BN(2)).div(new BN(3)));
            const expectedSecondFirstStakerReward = secondRewardPerSecond
                .mul(new BN(5))
                .add(secondRewardPerSecond.mul(new BN(3)).div(new BN(2)))
                .add(secondRewardPerSecond.mul(new BN(2)).div(new BN(3)));
            // the second staker had half of the rewards for 3 seconds and two thirds for 2
            const expectedFirstSecondStakerReward = firstRewardPerSecond
                .div(new BN(2))
                .mul(new BN(3))
                .add(
                    firstRewardPerSecond
                        .mul(new BN(2))
                        .mul(new BN(2))
                        .div(new BN(3))
                );
            const expectedSecondSecondStakerReward = secondRewardPerSecond
                .div(new BN(2))
                .mul(new BN(3))
                .add(
                    secondRewardPerSecond
                        .mul(new BN(2))
                        .mul(new BN(2))
                        .div(new BN(3))
                );
            // first staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedFirstFirstStakerReward, MAXIMUM_VARIANCE);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedSecondFirstStakerReward, MAXIMUM_VARIANCE);
            // second staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.closeBn(expectedFirstSecondStakerReward, MAXIMUM_VARIANCE);
            expect(
                await secondRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.closeBn(expectedSecondSecondStakerReward, MAXIMUM_VARIANCE);
        });

        it("should succeed in claiming two rewards if two stakers both stake at the last valid distribution second", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                20,
                secondRewardTokenInstance
            );
            const {
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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

            const firstRewardPerSecond = firstRewardsAmount.div(duration);
            const secondRewardPerSecond = secondRewardsAmount.div(duration);
            // the first staker had half of the rewards for 1 second
            const expectedFirstFirstStakerReward = firstRewardPerSecond.div(
                new BN(2)
            );
            const expectedSecondFirstStakerReward = secondRewardPerSecond.div(
                new BN(2)
            );
            // the second staker had half of the rewards for 1 second
            const expectedFirstSecondStakerReward = firstRewardPerSecond.div(
                new BN(2)
            );
            const expectedSecondSecondStakerReward = secondRewardPerSecond.div(
                new BN(2)
            );

            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedFirstFirstStakerReward, MAXIMUM_VARIANCE);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.closeBn(expectedSecondFirstStakerReward, MAXIMUM_VARIANCE);

            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.closeBn(expectedFirstSecondStakerReward, MAXIMUM_VARIANCE);
            expect(
                await secondRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.closeBn(expectedSecondSecondStakerReward, MAXIMUM_VARIANCE);
        });

        it("should succeed in claiming a reward if a staker stakes at second n and then increases their stake", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                100,
                secondRewardTokenInstance
            );
            const amountPerStake = stakedAmount.div(new BN(2));
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(firstRewardsAmount);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(secondRewardsAmount);
        });

        it("should succeed in claiming two rewards if two staker respectively stake and withdraw at the same second", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                10,
                secondRewardTokenInstance
            );
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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

            const firstRewardPerSecond = firstRewardsAmount.div(duration);
            const secondRewardPerSecond = secondRewardsAmount.div(duration);
            // both stakers had all of the rewards for 5 seconds
            const expectedFirstReward = firstRewardPerSecond.mul(new BN(5));
            const expectedSecondReward = secondRewardPerSecond.mul(new BN(5));

            // first staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(firstStakerAddress, {
                from: firstStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedFirstReward);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(expectedSecondReward);

            // second staker claim and rewards balance check
            await erc20DistributionInstance.claimAll(secondStakerAddress, {
                from: secondStakerAddress,
            });
            expect(
                await firstRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.equalBn(expectedFirstReward);
            expect(
                await secondRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.equalBn(expectedSecondReward);
        });

        it("should fail when trying to claim passing an excessive-length amounts array", async () => {
            const duration = new BN(10);
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [
                    await toWei(10, firstRewardTokenInstance),
                    await toWei(10, secondRewardTokenInstance),
                ],
                duration,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            try {
                await erc20DistributionInstance.claim(
                    [new BN(1000), new BN(1000), new BN(1000)],
                    firstStakerAddress
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD14");
            }
        });

        it("should fail when trying to claim passing a defective-length amounts array", async () => {
            const duration = new BN(10);
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [
                    await toWei(10, secondRewardTokenInstance),
                    await toWei(10, secondRewardTokenInstance),
                ],
                duration,
            });
            await fastForwardTo({ timestamp: startingTimestamp });
            try {
                await erc20DistributionInstance.claim(
                    [new BN(1000)],
                    firstStakerAddress
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD14");
            }
        });

        it("should fail when trying to claim only a part of the reward, if the first passed in amount is bigger than allowed", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                10,
                secondRewardTokenInstance
            );
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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
            await fastForwardTo({ timestamp: endingTimestamp });
            try {
                await erc20DistributionInstance.claim(
                    [
                        firstRewardsAmount.add(new BN(1000)),
                        secondRewardsAmount.sub(new BN(1000)),
                    ],
                    firstStakerAddress
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD15");
            }
        });

        it("should fail when trying to claim only a part of the reward, if the second passed in amount is bigger than allowed", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                10,
                secondRewardTokenInstance
            );
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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
            await fastForwardTo({ timestamp: endingTimestamp });
            try {
                await erc20DistributionInstance.claim(
                    [firstRewardsAmount, secondRewardsAmount.add(new BN(1000))],
                    firstStakerAddress
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD15");
            }
        });

        it("should fail when trying to claim only a part of the reward, if the second passed in amount is bigger than allowed", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                10,
                secondRewardTokenInstance
            );
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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
            await fastForwardTo({ timestamp: endingTimestamp });
            try {
                await erc20DistributionInstance.claim(
                    [firstRewardsAmount, secondRewardsAmount.add(new BN(1000))],
                    firstStakerAddress
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD15");
            }
        });

        it("should fail when trying to claim only a part of the reward, if the second passed in amount is bigger than allowed", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                10,
                secondRewardTokenInstance
            );
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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
            await fastForwardTo({ timestamp: endingTimestamp });
            try {
                await erc20DistributionInstance.claim(
                    [firstRewardsAmount, secondRewardsAmount.add(new BN(1000))],
                    firstStakerAddress
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD15");
            }
        });

        it("should succeed in claiming specific amounts under the right conditions", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                10,
                secondRewardTokenInstance
            );
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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
            await fastForwardTo({ timestamp: endingTimestamp });
            await erc20DistributionInstance.claim(
                [firstRewardsAmount, secondRewardsAmount],
                firstStakerAddress,
                { from: firstStakerAddress }
            );
            expect(
                await firstRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(firstRewardsAmount);
            expect(
                await secondRewardTokenInstance.balanceOf(firstStakerAddress)
            ).to.be.equalBn(secondRewardsAmount);
        });

        it("should succeed in claiming specific amounts to a foreign address under the right conditions", async () => {
            const stakedAmount = await toWei(10, stakableTokenInstance);
            const duration = new BN(10);
            const firstRewardsAmount = await toWei(
                10,
                firstRewardTokenInstance
            );
            const secondRewardsAmount = await toWei(
                10,
                secondRewardTokenInstance
            );
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: [firstRewardsAmount, secondRewardsAmount],
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
            await fastForwardTo({ timestamp: endingTimestamp });
            await erc20DistributionInstance.claim(
                [firstRewardsAmount, secondRewardsAmount],
                secondStakerAddress,
                { from: firstStakerAddress }
            );
            expect(
                await firstRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.equalBn(firstRewardsAmount);
            expect(
                await secondRewardTokenInstance.balanceOf(secondStakerAddress)
            ).to.be.equalBn(secondRewardsAmount);
        });
    }
);
