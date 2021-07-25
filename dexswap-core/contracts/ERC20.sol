pragma solidity =0.5.16;

import './DexSwapERC20.sol';

contract ERC20 is DexSwapERC20 {
    constructor(uint _totalSupply) public {
        _mint(msg.sender, _totalSupply);
    }
}
