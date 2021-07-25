// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

interface IERC20StakingRewardsDistributionFactory {
    function createDistribution(
        address[] calldata _rewardTokenAddresses,
        address _stakableTokenAddress,
        uint256[] calldata _rewardAmounts,
        uint64 _startingTimestamp,
        uint64 _endingTimestamp,
        bool _locked,
        uint256 _stakingCap
    ) external;

    function getDistributionsAmount() external view returns (uint256);

    function implementation() external view returns (address);

    function upgradeTo(address newImplementation) external;

    function distributions(uint256 _index) external returns (address);

    function stakingPaused() external returns (bool);
}
