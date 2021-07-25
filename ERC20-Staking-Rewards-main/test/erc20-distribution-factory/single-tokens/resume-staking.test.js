const { expect } = require("chai");

const ERC20StakingRewardsDistributionFactory = artifacts.require(
    "ERC20StakingRewardsDistributionFactory"
);
const ERC20StakingRewardsDistribution = artifacts.require(
    "ERC20StakingRewardsDistribution"
);

contract("ERC20StakingRewardsDistributionFactory - Resume staking", () => {
    let erc20DistributionFactoryInstance,
        erc20DistributionInstance,
        ownerAddress;

    beforeEach(async () => {
        const accounts = await web3.eth.getAccounts();
        ownerAddress = accounts[1];
        erc20DistributionInstance = await ERC20StakingRewardsDistribution.new();
        erc20DistributionFactoryInstance = await ERC20StakingRewardsDistributionFactory.new(
            erc20DistributionInstance.address,
            { from: ownerAddress }
        );
    });

    it("should fail when the caller is not the owner", async () => {
        try {
            // by default the first account is used, which is not the owner
            await erc20DistributionFactoryInstance.resumeStaking();
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain(
                "Ownable: caller is not the owner"
            );
        }
    });

    it("should fail when the staking is already active", async () => {
        try {
            await erc20DistributionFactoryInstance.resumeStaking({
                from: ownerAddress,
            });
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain("SRF02");
        }
    });

    it("should fail when the staking has been paused but already resumed", async () => {
        await erc20DistributionFactoryInstance.pauseStaking({
            from: ownerAddress,
        });
        await erc20DistributionFactoryInstance.resumeStaking({
            from: ownerAddress,
        });
        try {
            await erc20DistributionFactoryInstance.resumeStaking({
                from: ownerAddress,
            });
            throw new Error("should have failed");
        } catch (error) {
            expect(error.message).to.contain("SRF02");
        }
    });

    it("should succeed in the right conditions", async () => {
        expect(await erc20DistributionFactoryInstance.stakingPaused()).to.be
            .false;
        await erc20DistributionFactoryInstance.pauseStaking({
            from: ownerAddress,
        });
        expect(await erc20DistributionFactoryInstance.stakingPaused()).to.be
            .true;
        await erc20DistributionFactoryInstance.resumeStaking({
            from: ownerAddress,
        });
        expect(await erc20DistributionFactoryInstance.stakingPaused()).to.be
            .false;
    });
});
