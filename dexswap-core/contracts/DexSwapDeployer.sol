// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.5.16;

import './DexSwapFactory.sol';
import './interfaces/IDexSwapPair.sol';
import './DexSwapFeeSetter.sol';
import './DexSwapFeeReceiver.sol';

contract DexSwapDeployer {
    
    address payable public protocolFeeReceiver;
    address payable public owner;
    address public WETH;
    uint8 public state = 0;
    struct TokenPair {
        address tokenA;
        address tokenB;
        uint32 swapFee;
    }
    
    TokenPair[] public initialTokenPairs;

    event FeeReceiverDeployed(address feeReceiver);    
    event FeeSetterDeployed(address feeSetter);
    event PairFactoryDeployed(address factory);
    event PairDeployed(address pair);
        
    // Step 1: Create the deployer contract with all the needed information for deployment.
    constructor(
        address payable _protocolFeeReceiver,
        address payable _owner,
        address _WETH,
        address[] memory tokensA,
        address[] memory tokensB,
        uint32[] memory swapFees
    ) public {
        owner = _owner;
        WETH = _WETH;
        protocolFeeReceiver = _protocolFeeReceiver;
        for(uint8 i = 0; i < tokensA.length; i ++) {
            initialTokenPairs.push(
                TokenPair(
                    tokensA[i],
                    tokensB[i],
                    swapFees[i]
                )
            );
        }
    }
    
    // Step 2: Transfer ETH 
    function() external payable {
        require(state == 0, "DexSwapDeployer: WRONG_DEPLOYER_STATE");
        require(msg.sender == owner, "DexSwapDeployer: CALLER_NOT_FEE_TO_SETTER");
        state = 1;
    }
    
    // Step 3: Deploy DexSwapFactory and all initial pairs
    function deploy() public {
        require(state == 1, 'DexSwapDeployer: WRONG_DEPLOYER_STATE');
        DexSwapFactory dexSwapFactory = new DexSwapFactory(address(this));
        emit PairFactoryDeployed(address(dexSwapFactory));
        for(uint8 i = 0; i < initialTokenPairs.length; i ++) {
            address newPair = dexSwapFactory.createPair(initialTokenPairs[i].tokenA, initialTokenPairs[i].tokenB);
            dexSwapFactory.setSwapFee(newPair, initialTokenPairs[i].swapFee);
            emit PairDeployed(address(newPair));
        }
        DexSwapFeeReceiver dexSwapFeeReceiver = new DexSwapFeeReceiver(
            owner, address(dexSwapFactory), WETH, protocolFeeReceiver, owner
        );
        emit FeeReceiverDeployed(address(dexSwapFeeReceiver));
        dexSwapFactory.setFeeTo(address(dexSwapFeeReceiver));
        
        DexSwapFeeSetter dexSwapFeeSetter = new DexSwapFeeSetter(owner, address(dexSwapFactory));
        emit FeeSetterDeployed(address(dexSwapFeeSetter));
        dexSwapFactory.setFeeToSetter(address(dexSwapFeeSetter));
        state = 2;
        msg.sender.transfer(address(this).balance);
    }
    
  
}
