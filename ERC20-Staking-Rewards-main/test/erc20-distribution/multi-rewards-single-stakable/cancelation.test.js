const BN = require("bn.js");
const { expect } = require("chai");
const { ZERO_BN } = require("../../constants");
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
    "ERC20StakingRewardsDistribution - Multi rewards, single stakable token - Cancelation",
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

        it("should succeed in the right conditions", async () => {
            const rewardAmounts = [
                await toWei(10, firstRewardsTokenInstance),
                await toWei(100, secondRewardsTokenInstance),
            ];
            const rewardTokens = [
                firstRewardsTokenInstance,
                secondRewardsTokenInstance,
            ];
            // if not specified, the distribution starts 10 seconds from
            // now, so we have the time to cancel it
            const { erc20DistributionInstance } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens,
                rewardAmounts,
                duration: 2,
            });
            await erc20DistributionInstance.cancel({ from: ownerAddress });
            for (let i = 0; i < rewardTokens.length; i++) {
                const rewardToken = rewardTokens[i];
                const rewardAmount = rewardAmounts[i];
                expect(
                    await rewardToken.balanceOf(
                        erc20DistributionInstance.address
                    )
                ).to.be.equalBn(ZERO_BN);
                expect(await rewardToken.balanceOf(ownerAddress)).to.be.equalBn(
                    rewardAmount
                );
            }
            expect(await erc20DistributionInstance.initialized()).to.be.true;
            expect(await erc20DistributionInstance.canceled()).to.be.true;
        });

        it("shouldn't allow for a second initialization on success", async () => {
            const rewardAmounts = [
                await toWei(10, firstRewardsTokenInstance),
                await toWei(10, firstRewardsTokenInstance),
            ];
            const rewardTokens = [
                firstRewardsTokenInstance,
                secondRewardsTokenInstance,
            ];
            // if not specified, the distribution starts 10 seconds from
            // now, so we have the time to cancel it
            const { erc20DistributionInstance } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens,
                rewardAmounts,
                duration: 2,
            });
            await erc20DistributionInstance.cancel({ from: ownerAddress });
            try {
                const currentTimestamp = await getEvmTimestamp();
                await erc20DistributionInstance.initialize(
                    rewardTokens.map((token) => token.address),
                    stakableTokenInstance.address,
                    rewardAmounts,
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

        it("shouldn't allow for a second cancelation on success", async () => {
            const rewardAmounts = [
                await toWei(10, firstRewardsTokenInstance),
                await toWei(10, firstRewardsTokenInstance),
            ];
            const rewardTokens = [
                firstRewardsTokenInstance,
                secondRewardsTokenInstance,
            ];
            // if not specified, the distribution starts 10 seconds from
            // now, so we have the time to cancel it
            const { erc20DistributionInstance } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens,
                rewardAmounts,
                duration: 2,
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
