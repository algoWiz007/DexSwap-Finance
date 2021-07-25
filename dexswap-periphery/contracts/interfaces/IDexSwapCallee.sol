// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.6;

interface IDexSwapCallee {
    function DexSwapCall(address sender, uint amount0, uint amount1, bytes calldata data) external;
}
