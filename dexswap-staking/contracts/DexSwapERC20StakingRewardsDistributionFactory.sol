// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

import "erc20-staking-rewards/contracts/ERC20StakingRewardsDistributionFactory.sol";
import "./interfaces/IRewardTokensValidator.sol";
import "./interfaces/IStakableTokenValidator.sol";

contract DexSwapERC20StakingRewardsDistributionFactory is
    ERC20StakingRewardsDistributionFactory
{
    IRewardTokensValidator public rewardTokensValidator;
    IStakableTokenValidator public stakableTokenValidator;

    constructor(
        address _rewardTokensValidatorAddress,
        address _stakableTokenValidatorAddress,
        address _implementation
    ) ERC20StakingRewardsDistributionFactory(_implementation) {
        rewardTokensValidator = IRewardTokensValidator(
            _rewardTokensValidatorAddress
        );
        stakableTokenValidator = IStakableTokenValidator(
            _stakableTokenValidatorAddress
        );
    }

    function setRewardTokensValidator(address _rewardTokensValidatorAddress)
        external
        onlyOwner
    {
        rewardTokensValidator = IRewardTokensValidator(
            _rewardTokensValidatorAddress
        );
    }

    function setStakableTokenValidator(address _stakableTokenValidatorAddress)
        external
        onlyOwner
    {
        stakableTokenValidator = IStakableTokenValidator(
            _stakableTokenValidatorAddress
        );
    }

    function createDistribution(
        address[] calldata _rewardTokensAddresses,
        address _stakableTokenAddress,
        uint256[] calldata _rewardAmounts,
        uint64 _startingTimestamp,
        uint64 _endingTimestmp,
        bool _locked,
        uint256 _stakingCap
    ) public override {
        if (address(rewardTokensValidator) != address(0)) {
            rewardTokensValidator.validateTokens(_rewardTokensAddresses);
        }
        if (address(stakableTokenValidator) != address(0)) {
            stakableTokenValidator.validateToken(_stakableTokenAddress);
        }
        ERC20StakingRewardsDistributionFactory.createDistribution(
            _rewardTokensAddresses,
            _stakableTokenAddress,
            _rewardAmounts,
            _startingTimestamp,
            _endingTimestmp,
            _locked,
            _stakingCap
        );
    }
}
