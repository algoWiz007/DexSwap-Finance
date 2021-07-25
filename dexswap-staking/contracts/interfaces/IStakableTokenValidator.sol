// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0;

interface IStakableTokenValidator {
    function validateToken(address _token) external view;
}
