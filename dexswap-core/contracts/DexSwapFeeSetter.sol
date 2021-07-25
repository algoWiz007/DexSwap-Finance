// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.5.16;

import './interfaces/IDexSwapFactory.sol';

contract DexSwapFeeSetter {
    address public owner;
    mapping(address => address) public pairOwners;
    IDexSwapFactory public factory;
  
    constructor(address _owner, address _factory) public {
        owner = _owner;
        factory = IDexSwapFactory(_factory);
    }

    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, 'DexSwapFeeSetter: FORBIDDEN');
        owner = newOwner;
    }
    
    function transferPairOwnership(address pair, address newOwner) external {
        require(msg.sender == owner, 'DexSwapFeeSetter: FORBIDDEN');
        pairOwners[pair] = newOwner;
    }

    function setFeeTo(address feeTo) external {
        require(msg.sender == owner, 'DexSwapFeeSetter: FORBIDDEN');
        factory.setFeeTo(feeTo);
    }

    function setFeeToSetter(address feeToSetter) external {
        require(msg.sender == owner, 'DexSwapFeeSetter: FORBIDDEN');
        factory.setFeeToSetter(feeToSetter);
    }
    
    function setProtocolFee(uint8 protocolFeeDenominator) external {
        require(msg.sender == owner, 'DexSwapFeeSetter: FORBIDDEN');
        factory.setProtocolFee(protocolFeeDenominator);
    }
    
    function setSwapFee(address pair, uint32 swapFee) external {
        require((msg.sender == owner) || ((msg.sender == pairOwners[pair])), 'DexSwapFeeSetter: FORBIDDEN');
        factory.setSwapFee(pair, swapFee);
    }
}
