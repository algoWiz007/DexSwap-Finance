// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IRewardTokensValidator.sol";
import "./interfaces/IDEXTokenRegistry.sol";

contract DefaultRewardTokensValidator is IRewardTokensValidator, Ownable {
    IDEXTokenRegistry public dexTokenRegistry;
    uint256 public dexTokenRegistryListId;

    constructor(address _dexTokenRegistryAddress, uint256 _dexTokenRegistryListId)
    {
        require(
            _dexTokenRegistryAddress != address(0),
            "DefaultRewardTokensValidator: 0-address token registry address"
        );
        require(
            _dexTokenRegistryListId > 0,
            "DefaultRewardTokensValidator: invalid token list id"
        );
        dexTokenRegistry = IDEXTokenRegistry(_dexTokenRegistryAddress);
        dexTokenRegistryListId = _dexTokenRegistryListId;
    }

    function setDexTokenRegistry(address _dexTokenRegistryAddress)
        external
        onlyOwner
    {
        require(
            _dexTokenRegistryAddress != address(0),
            "DefaultRewardTokensValidator: 0-address token registry address"
        );
        dexTokenRegistry = IDEXTokenRegistry(_dexTokenRegistryAddress);
    }

    function setDexTokenRegistryListId(uint256 _dexTokenRegistryListId)
        external
        onlyOwner
    {
        require(
            _dexTokenRegistryListId > 0,
            "DefaultRewardTokensValidator: invalid token list id"
        );
        dexTokenRegistryListId = _dexTokenRegistryListId;
    }

    function validateTokens(address[] calldata _rewardTokens)
        external
        view
        override
    {
        require(
            _rewardTokens.length > 0,
            "DefaultRewardTokensValidator: 0-length reward tokens array"
        );
        for (uint256 _i = 0; _i < _rewardTokens.length; _i++) {
            address _rewardToken = _rewardTokens[_i];
            require(
                _rewardToken != address(0),
                "DefaultRewardTokensValidator: 0-address reward token"
            );
            require(
                dexTokenRegistry.isTokenActive(
                    dexTokenRegistryListId,
                    _rewardToken
                ),
                "DefaultRewardTokensValidator: invalid reward token"
            );
        }
    }
}
