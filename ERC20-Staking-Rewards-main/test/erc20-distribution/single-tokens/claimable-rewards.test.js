const BN = require("bn.js");
const { expect } = require("chai");
const { initializeDistribution } = require("../../utils");

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
    "ERC20StakingRewardsDistribution - Single reward/stakable token - Get claimable rewards",
    () => {
        let erc20DistributionFactoryInstance,
            firstRewardTokenInstance,
            secondRewardTokenInstance,
            stakableTokenInstance,
            ownerAddress,
            firstStakerAddress;

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
            firstStakerAddress = accounts[1];
            firstRewardTokenInstance = await FirstRewardERC20.new();
            secondRewardTokenInstance = await SecondRewardERC20.new();
            stakableTokenInstance = await FirstStakableERC20.new();
            firstStakerAddress = accounts[1];
        });

        it("should give an empty array back when the distribution has not been initialized yet", async () => {
            const erc20DistributionInstance = await ERC20StakingRewardsDistribution.new(
                { from: ownerAddress }
            );
            const claimableRewards = await erc20DistributionInstance.claimableRewards(
                firstStakerAddress
            );
            expect(claimableRewards).to.have.length(0);
        });

        it("should give an array back with length 1 when the distribution has been initialized with 1 reward token but not yet started", async () => {
            const { erc20DistributionInstance } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [firstRewardTokenInstance],
                rewardAmounts: ["10"],
                duration: 10,
            });
            const claimableRewards = await erc20DistributionInstance.claimableRewards(
                firstStakerAddress
            );
            expect(claimableRewards).to.have.length(1);
            expect(claimableRewards[0]).to.be.equalBn(new BN(0));
        });

        it("should give an array back with length 2 when the distribution has been initialized with 2 reward token but not yet started", async () => {
            const { erc20DistributionInstance } = await initializeDistribution({
                from: ownerAddress,
                erc20DistributionFactoryInstance,
                stakableToken: stakableTokenInstance,
                rewardTokens: [
                    firstRewardTokenInstance,
                    secondRewardTokenInstance,
                ],
                rewardAmounts: ["10", "1"],
                duration: 10,
            });
            const claimableRewards = await erc20DistributionInstance.claimableRewards(
                firstStakerAddress
            );
            expect(claimableRewards).to.have.length(2);
            expect(claimableRewards[0]).to.be.equalBn(new BN(0));
            expect(claimableRewards[1]).to.be.equalBn(new BN(0));
        });
    }
);
