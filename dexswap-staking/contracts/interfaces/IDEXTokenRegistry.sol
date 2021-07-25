// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0;

interface IDEXTokenRegistry {
    function isTokenActive(uint256 _listId, address _token)
        external
        view
        returns (bool);
}
