const FirstRewardERC20 = artifacts.require("FirstRewardERC20");
const SecondRewardERC20 = artifacts.require("SecondRewardERC20");
const ZeroDecimalsRewardERC20 = artifacts.require("ZeroDecimalsRewardERC20");
const FirstStakableERC20 = artifacts.require("FirstStakableERC20");
const SecondStakableERC20 = artifacts.require("SecondStakableERC20");
const ERC20StakingRewardsDistribution = artifacts.require(
    "ERC20StakingRewardsDistribution"
);
const ERC20StakingRewardsDistributionFactory = artifacts.require(
    "ERC20StakingRewardsDistributionFactory"
);

module.exports = async (deployer, network) => {
    if (network === "soliditycoverage") {
        await deployer.deploy(ERC20StakingRewardsDistribution);
        deployer.deploy(FirstRewardERC20);
        deployer.deploy(SecondRewardERC20);
        deployer.deploy(ZeroDecimalsRewardERC20);
        deployer.deploy(FirstStakableERC20);
        deployer.deploy(SecondStakableERC20);
        deployer.deploy(
            ERC20StakingRewardsDistributionFactory,
            ERC20StakingRewardsDistribution.address
        );
    }
};
