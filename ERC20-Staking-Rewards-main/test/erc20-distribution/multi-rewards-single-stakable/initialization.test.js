const BN = require("bn.js");
const { expect } = require("chai");
const { ZERO_ADDRESS } = require("../../constants");
const { initializeDistribution } = require("../../utils");
const { toWei } = require("../../utils/conversion");
const { getEvmTimestamp } = require("../../utils/network");

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
    "ERC20StakingRewardsDistribution - Multi rewards, single stakable token - Initialization",
    () => {
        let erc20DistributionFactoryInstance,
            firstRewardsTokenInstance,
            secondRewardsTokenInstance,
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
            firstRewardsTokenInstance = await FirstRewardERC20.new();
            secondRewardsTokenInstance = await SecondRewardERC20.new();
            stakableTokenInstance = await FirstStakableERC20.new();
        });

        it("should fail when reward tokens/amounts arrays have inconsistent lengths", async () => {
            try {
                const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                    { from: ownerAddress }
                );
                await erc20DistributionInstance.initialize(
                    [
                        firstRewardsTokenInstance.address,
                        secondRewardsTokenInstance.address,
                    ],
                    stakableTokenInstance.address,
                    [11],
                    100000000000,
                    1000000000000,
                    false,
                    0
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD03");
            }
        });

        it("should fail when funding for the first reward token has not been sent to the contract before calling initialize", async () => {
            try {
                const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                    { from: ownerAddress }
                );
                await erc20DistributionInstance.initialize(
                    [
                        firstRewardsTokenInstance.address,
                        secondRewardsTokenInstance.address,
                    ],
                    stakableTokenInstance.address,
                    [11, 36],
                    100000000000,
                    1000000000000,
                    false,
                    0
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD06");
            }
        });

        it("should fail when funding for the second reward token has not been sent to the contract before calling initialize", async () => {
            try {
                const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                    { from: ownerAddress }
                );
                await firstRewardsTokenInstance.mint(
                    erc20DistributionInstance.address,
                    11
                );
                await erc20DistributionInstance.initialize(
                    [
                        firstRewardsTokenInstance.address,
                        secondRewardsTokenInstance.address,
                    ],
                    stakableTokenInstance.address,
                    [11, 36],
                    100000000000,
                    1000000000000,
                    false,
                    0
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD06");
            }
        });

        it("should fail when passing a 0-address second reward token", async () => {
            try {
                const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                    { from: ownerAddress }
                );
                await firstRewardsTokenInstance.mint(
                    erc20DistributionInstance.address,
                    11
                );
                await erc20DistributionInstance.initialize(
                    [firstRewardsTokenInstance.address, ZERO_ADDRESS],
                    stakableTokenInstance.address,
                    [11, 36],
                    100000000000,
                    1000000000000,
                    false,
                    0
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD04");
            }
        });

        it("should fail when passing 0 as the first reward amount", async () => {
            try {
                await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [
                        firstRewardsTokenInstance,
                        secondRewardsTokenInstance,
                    ],
                    rewardAmounts: [0, 10],
                    duration: 10,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD05");
            }
        });

        it("should fail when passing 0 as the second reward amount", async () => {
            try {
                await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [
                        firstRewardsTokenInstance,
                        secondRewardsTokenInstance,
                    ],
                    rewardAmounts: [10, 0],
                    duration: 10,
                });
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("SRD05");
            }
        });

        it("should succeed in the right conditions", async () => {
            const rewardAmounts = [
                new BN(await toWei(10, firstRewardsTokenInstance)),
                new BN(await toWei(100, secondRewardsTokenInstance)),
            ];
            const duration = new BN(10);
            const rewardTokens = [
                firstRewardsTokenInstance,
                secondRewardsTokenInstance,
            ];
            const {
                startingTimestamp,
                erc20DistributionInstance,
            } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens,
                rewardAmounts,
                duration,
            });

            expect(await erc20DistributionInstance.initialized()).to.be.true;
            const onchainRewardTokens = await erc20DistributionInstance.getRewardTokens();
            expect(onchainRewardTokens).to.have.length(2);
            expect(onchainRewardTokens[0]).to.be.equal(
                firstRewardsTokenInstance.address
            );
            expect(onchainRewardTokens[1]).to.be.equal(
                secondRewardsTokenInstance.address
            );
            const onchainStakableToken = await erc20DistributionInstance.stakableToken();
            expect(onchainStakableToken).to.be.equal(
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
            expect(
                onchainEndingTimestamp.sub(onchainStartingTimestamp)
            ).to.be.equalBn(duration);
        });

        it("should fail when trying to initialize a second time", async () => {
            try {
                const {
                    erc20DistributionInstance,
                } = await initializeDistribution({
                    from: ownerAddress,
                    erc20DistributionFactoryInstance,
                    stakableToken: stakableTokenInstance,
                    rewardTokens: [
                        firstRewardsTokenInstance,
                        secondRewardsTokenInstance,
                    ],
                    rewardAmounts: [11, 14],
                    duration: 2,
                });
                const currentTimestamp = await getEvmTimestamp();
                await erc20DistributionInstance.initialize(
                    [
                        firstRewardsTokenInstance.address,
                        secondRewardsTokenInstance.address,
                    ],
                    stakableTokenInstance.address,
                    [17, 12],
                    currentTimestamp.add(new BN(10)),
                    currentTimestamp.add(new BN(20)),
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
