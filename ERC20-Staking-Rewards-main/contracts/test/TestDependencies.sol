//SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "../ERC20StakingRewardsDistribution.sol";

contract FirstRewardERC20 is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("First reward", "RWD1") {}
}

contract SecondRewardERC20 is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("Second reward", "RWD2") {}
}

contract ZeroDecimalsRewardERC20 is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("Zero decimals reward", "ZDRWD") {}

    function decimals() public pure override returns (uint8) {
        return 0;
    }
}

contract FirstStakableERC20 is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("First stakable", "STK1") {}
}

contract SecondStakableERC20 is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("Second stakable", "STK2") {}
}

contract UpgradedERC20StakingRewardsDistribution is
    ERC20StakingRewardsDistribution
{
    function isUpgraded() external pure returns (bool) {
        return true;
    }
}
