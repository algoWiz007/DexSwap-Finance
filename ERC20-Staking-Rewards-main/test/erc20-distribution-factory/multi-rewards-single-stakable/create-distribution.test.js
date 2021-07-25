const BN = require("bn.js");
const { expect } = require("chai");
const { getEvmTimestamp } = require("../../utils/network");

const ERC20StakingRewardsDistributionFactory = artifacts.require(
    "ERC20StakingRewardsDistributionFactory"
);
const ERC20StakingRewardsDistribution = artifacts.require(
    "ERC20StakingRewardsDistribution"
);
const UpgradedERC20StakingRewardsDistribution = artifacts.require(
    "UpgradedERC20StakingRewardsDistribution"
);
const FirstRewardERC20 = artifacts.require("FirstRewardERC20");
const SecondRewardERC20 = artifacts.require("SecondRewardERC20");
const FirstStakableERC20 = artifacts.require("FirstStakableERC20");

contract(
    "ERC20StakingRewardsDistributionFactory - Distribution creation",
    () => {
        let erc20DistributionFactoryInstance,
            firstRewardsTokenInstance,
            secondRewardsTokenInstance,
            stakableTokenInstance,
            ownerAddress;

        beforeEach(async () => {
            const accounts = await web3.eth.getAccounts();
            ownerAddress = accounts[1];
            const implementation = await ERC20StakingRewardsDistribution.new();
            erc20DistributionFactoryInstance = await ERC20StakingRewardsDistributionFactory.new(
                implementation.address,
                { from: ownerAddress }
            );
            firstRewardsTokenInstance = await FirstRewardERC20.new();
            secondRewardsTokenInstance = await SecondRewardERC20.new();
            stakableTokenInstance = await FirstStakableERC20.new();
        });

        it("should fail when the caller has not enough first reward token", async () => {
            try {
                // 10 seconds from now
                const startingTimestamp = (await getEvmTimestamp()).add(
                    new BN(10)
                );
                await erc20DistributionFactoryInstance.createDistribution(
                    [
                        firstRewardsTokenInstance.address,
                        secondRewardsTokenInstance.address,
                    ],
                    stakableTokenInstance.address,
                    [10, 10],
                    startingTimestamp,
                    startingTimestamp.add(new BN(10)),
                    false,
                    0
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain(
                    "ERC20: transfer amount exceeds balance"
                );
            }
        });

        it("should fail when the caller has enough first reward token, but no approval was set by the owner", async () => {
            try {
                // 10 seconds from now
                const firstRewardAmount = 20;
                await firstRewardsTokenInstance.mint(
                    ownerAddress,
                    firstRewardAmount
                );
                // no allowance given
                const startingTimestamp = (await getEvmTimestamp()).add(
                    new BN(10)
                );
                await erc20DistributionFactoryInstance.createDistribution(
                    [
                        firstRewardsTokenInstance.address,
                        secondRewardsTokenInstance.address,
                    ],
                    stakableTokenInstance.address,
                    [firstRewardAmount, 10],
                    startingTimestamp,
                    startingTimestamp.add(new BN(10)),
                    false,
                    0,
                    { from: ownerAddress }
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain(
                    "ERC20: transfer amount exceeds allowance"
                );
            }
        });

        it("should fail when the caller has not enough second reward token", async () => {
            try {
                // 10 seconds from now
                const firstRewardAmount = 20;
                await firstRewardsTokenInstance.mint(
                    ownerAddress,
                    firstRewardAmount
                );
                await firstRewardsTokenInstance.approve(
                    erc20DistributionFactoryInstance.address,
                    firstRewardAmount,
                    { from: ownerAddress }
                );
                const startingTimestamp = (await getEvmTimestamp()).add(
                    new BN(10)
                );
                await erc20DistributionFactoryInstance.createDistribution(
                    [
                        firstRewardsTokenInstance.address,
                        secondRewardsTokenInstance.address,
                    ],
                    stakableTokenInstance.address,
                    [firstRewardAmount, 10],
                    startingTimestamp,
                    startingTimestamp.add(new BN(10)),
                    false,
                    0
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain(
                    "ERC20: transfer amount exceeds balance"
                );
            }
        });

        it("should fail when the caller has enough second reward token, but no approval was set by the owner", async () => {
            try {
                // 10 seconds from now
                const firstRewardAmount = 20;
                await firstRewardsTokenInstance.mint(
                    ownerAddress,
                    firstRewardAmount
                );
                await firstRewardsTokenInstance.approve(
                    erc20DistributionFactoryInstance.address,
                    firstRewardAmount,
                    { from: ownerAddress }
                );
                const secondRewardAmount = 40;
                await secondRewardsTokenInstance.mint(
                    ownerAddress,
                    secondRewardAmount
                );
                // no allowance given
                const startingTimestamp = (await getEvmTimestamp()).add(
                    new BN(10)
                );
                await erc20DistributionFactoryInstance.createDistribution(
                    [
                        firstRewardsTokenInstance.address,
                        secondRewardsTokenInstance.address,
                    ],
                    stakableTokenInstance.address,
                    [firstRewardAmount, secondRewardAmount],
                    startingTimestamp,
                    startingTimestamp.add(new BN(10)),
                    false,
                    0,
                    { from: ownerAddress }
                );
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain(
                    "ERC20: transfer amount exceeds allowance"
                );
            }
        });

        it("should succeed when in the right conditions", async () => {
            const firstRewardAmount = 10;
            await firstRewardsTokenInstance.mint(
                ownerAddress,
                firstRewardAmount
            );
            await firstRewardsTokenInstance.approve(
                erc20DistributionFactoryInstance.address,
                firstRewardAmount,
                { from: ownerAddress }
            );

            const secondRewardAmount = 20;
            await secondRewardsTokenInstance.mint(
                ownerAddress,
                secondRewardAmount
            );
            await secondRewardsTokenInstance.approve(
                erc20DistributionFactoryInstance.address,
                secondRewardAmount,
                { from: ownerAddress }
            );
            const rewardAmounts = [firstRewardAmount, secondRewardAmount];
            const rewardTokens = [
                firstRewardsTokenInstance.address,
                secondRewardsTokenInstance.address,
            ];
            const startingTimestamp = (await getEvmTimestamp()).add(new BN(10));
            const endingTimestamp = startingTimestamp.add(new BN(10));
            const locked = false;
            await erc20DistributionFactoryInstance.createDistribution(
                rewardTokens,
                stakableTokenInstance.address,
                rewardAmounts,
                startingTimestamp,
                endingTimestamp,
                locked,
                0,
                { from: ownerAddress }
            );
            expect(
                await erc20DistributionFactoryInstance.getDistributionsAmount()
            ).to.be.equalBn(new BN(1));
            const createdDistributionAddress = await erc20DistributionFactoryInstance.distributions(
                0
            );
            const erc20DistributionInstance = await ERC20StakingRewardsDistribution.at(
                createdDistributionAddress
            );

            const onchainRewardTokens = await erc20DistributionInstance.getRewardTokens();
            const onchainStakableToken = await erc20DistributionInstance.stakableToken();
            const onchainStartingTimestamp = await erc20DistributionInstance.startingTimestamp();
            const onchainEndingTimestamp = await erc20DistributionInstance.endingTimestamp();

            expect(onchainRewardTokens).to.have.length(rewardTokens.length);
            expect(onchainStakableToken).to.be.equal(
                stakableTokenInstance.address
            );
            for (let i = 0; i < onchainRewardTokens.length; i++) {
                const token = onchainRewardTokens[i];
                const amount = await erc20DistributionInstance.rewardAmount(
                    token
                );
                expect(amount.toNumber()).to.be.equal(rewardAmounts[i]);
            }
            expect(onchainStartingTimestamp).to.be.equalBn(startingTimestamp);
            expect(onchainEndingTimestamp).to.be.equalBn(endingTimestamp);
            expect(await erc20DistributionInstance.owner()).to.be.equal(
                ownerAddress
            );
        });

        it("should succeed when upgrading the implementation (new campaigns must use the new impl, old ones the previous one)", async () => {
            const firstRewardAmount = 20;
            await firstRewardsTokenInstance.mint(
                ownerAddress,
                firstRewardAmount
            );
            await firstRewardsTokenInstance.approve(
                erc20DistributionFactoryInstance.address,
                firstRewardAmount,
                { from: ownerAddress }
            );

            const secondRewardAmount = 40;
            await secondRewardsTokenInstance.mint(
                ownerAddress,
                secondRewardAmount
            );
            await secondRewardsTokenInstance.approve(
                erc20DistributionFactoryInstance.address,
                secondRewardAmount,
                { from: ownerAddress }
            );
            const rewardAmounts = [
                firstRewardAmount / 2,
                secondRewardAmount / 2,
            ];
            const rewardTokens = [
                firstRewardsTokenInstance.address,
                secondRewardsTokenInstance.address,
            ];
            const startingTimestamp = (await getEvmTimestamp()).add(new BN(10));
            const endingTimestamp = startingTimestamp.add(new BN(10));
            const locked = false;
            // proxy 1
            await erc20DistributionFactoryInstance.createDistribution(
                rewardTokens,
                stakableTokenInstance.address,
                rewardAmounts,
                startingTimestamp,
                endingTimestamp,
                locked,
                0,
                { from: ownerAddress }
            );

            // upgrading implementation
            const upgradedDistribution = await UpgradedERC20StakingRewardsDistribution.new();
            await erc20DistributionFactoryInstance.upgradeImplementation(
                upgradedDistribution.address,
                { from: ownerAddress }
            );

            // proxy 2
            await erc20DistributionFactoryInstance.createDistribution(
                rewardTokens,
                stakableTokenInstance.address,
                rewardAmounts,
                startingTimestamp,
                endingTimestamp,
                locked,
                0,
                { from: ownerAddress }
            );
            expect(
                await erc20DistributionFactoryInstance.getDistributionsAmount()
            ).to.be.equalBn(new BN(2));
            const proxy1Address = await erc20DistributionFactoryInstance.distributions(
                0
            );
            const proxy2Address = await erc20DistributionFactoryInstance.distributions(
                1
            );
            const distribution1Instance = await UpgradedERC20StakingRewardsDistribution.at(
                proxy1Address
            );
            const distribution2Instance = await UpgradedERC20StakingRewardsDistribution.at(
                proxy2Address
            );

            try {
                await distribution1Instance.isUpgraded();
                throw new Error("should have failed");
            } catch (error) {
                expect(error.message).to.contain("revert");
            }

            expect(await distribution2Instance.isUpgraded()).to.be.true;
        });
    }
);
