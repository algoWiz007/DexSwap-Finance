pragma solidity >=0.4.25 <0.8.0;
import "./xDEXSToken.sol";


// is xDEXSToken
contract xDEXS is xDEXSToken {
    constructor(string memory _name, string memory _symbol, uint _cap) public xDEXSToken(_name, _symbol, _cap) {}
}