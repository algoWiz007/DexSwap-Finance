const BN = require("bn.js");
const { expect } = require("chai");
const { ZERO_ADDRESS } = require("../../constants");
const { initializeDistribution } = require("../../utils");
const { toWei } = require("../../utils/conversion");
const { getEvmTimestamp, fastForwardTo } = require("../../utils/network");

const ERC20StakingRewardsDistribution = artifacts.require(
    "ERC20StakingRewardsDistribution"
);
const ERC20StakingRewardsDistributionFactory = artifacts.require(
    "ERC20StakingRewardsDistributionFactory"
);
const FirstRewardERC20 = artifacts.require("FirstRewardERC20");
const FirstStakableERC20 = artifacts.require("FirstStakableERC20");

contract(
    "ERC20StakingRewardsDistribution - Single reward/stakable token - Initialization",
    () => {
        let erc20DistributionFactoryInstance,
            rewardsTokenInstance,
            stakableTokenInstance,
            ownerAddress;

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
        });

        it("should fail when passing a 0-address rewards token", async () => {
            try {
                const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                    { from: ownerAddress }
                );
                await erc20DistributionInstance.initialize(
                    [ZERO_ADDRESS],
                    stakableTokenInstance.address,
                    [10],
                    10000000000,
                    100000000000,
                    false,
                    0
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD04");
            }
        });

        it("should fail when passing a 0-address stakable token", async () => {
            try {
                await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: { address: ZERO_ADDRESS },
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [14],
                    duration: 10,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD07");
            }
        });

        it("should fail when passing 0 as a rewards amount", async () => {
            try {
                await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [0],
                    duration: 10,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD05");
            }
        });

        it("should fail when passing a lower starting timestamp than the current one", async () => {
            try {
                const currentEvmTimestamp = await getEvmTimestamp();
                const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                    { from: ownerAddress }
                );
                await erc20DistributionInstance.initialize(
                    [rewardsTokenInstance.address],
                    stakableTokenInstance.address,
                    [1],
                    currentEvmTimestamp.sub(new BN(10)),
                    currentEvmTimestamp.add(new BN(10)),
                    false,
                    0,
                    { from: ownerAddress }
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD01");
            }
        });

        it("should fail when passing the same starting timestamp as the current one", async () => {
            try {
                const currentEvmTimestamp = await getEvmTimestamp();
                const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                    { from: ownerAddress }
                );
                await erc20DistributionInstance.initialize(
                    [rewardsTokenInstance.address],
                    stakableTokenInstance.address,
                    [1],
                    currentEvmTimestamp,
                    currentEvmTimestamp.add(new BN(10)),
                    false,
                    0,
                    { from: ownerAddress }
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD01");
            }
        });

        it("should fail when passing 0 as seconds duration", async () => {
            try {
                await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [rewardsTokenInstance],
                    rewardAmounts: [1],
                    duration: 0,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD02");
            }
        });

        it("should succeed in the right conditions", async () => {
            const rewardAmounts = [
                new BN(await toWei(10, rewardsTokenInstance)),
            ];
            const duration = new BN(10);
            const rewardTokens = [rewardsTokenInstance];
            const {
                startingTimestamp,
                endingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens,
                rewardAmounts,
                duration,
            });
            await fastForwardTo(startingTimestamp);

            expect(await erc20DistributionInstance.initialized()).to.be.true;
            const onchainRewardTokens = await erc20DistributionInstance.getRewardTokens();
            expect(onchainRewardTokens).to.have.length(rewardTokens.length);
            expect(onchainRewardTokens[0]).to.be.equal(
                rewardsTokenInstance.address
            );
            expect(await erc20DistributionInstance.stakableToken()).to.be.equal(
                stakableTokenInstance.address
            );
            for (let i = 0; i < rewardTokens.length; i++) {
                const rewardAmount = rewardAmounts[i];
                const rewardToken = rewardTokens[i];
                expect(
                    await rewardToken.balanceOf(
                        erc20DistributionInstance.address
                    )
                ).to.be.equalBn(rewardAmount);
                expect(
                    await erc20DistributionInstance.rewardAmount(
                        rewardToken.address
                    )
                ).to.be.equalBn(rewardAmount);
            }
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            expect(onchainStartingTimestamp).to.be.equalBn(startingTimestamp);
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();
            expect(onchainEndingTimestamp.sub(startingTimestamp)).to.be.equalBn(
                duration
            );
            expect(onchainEndingTimestamp).to.be.equalBn(endingTimestamp);
        });

        it("should fail when trying to initialize a second time", async () => {
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
                await erc20DistributionInstance.initialize(
                    [rewardsTokenInstance.address],
                    stakableTokenInstance.address,
                    [7],
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
    }
);
