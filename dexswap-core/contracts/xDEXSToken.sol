pragma solidity >=0.4.25 <0.8.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


/**
 * @title xDEXSToken, base on zeppelin contract.
 * @dev ERC20 compatible token. It is a mintable, burnable token.
 */

contract xDEXSToken is ERC20, ERC20Burnable, Ownable {

    string public name;
    string public symbol;
    // solhint-disable-next-line const-name-snakecase
    uint8 public constant decimals = 18;
    uint256 public cap;

    /**
    * @dev Constructor
    * @param _name - token name
    * @param _symbol - token symbol
    * @param _cap - token cap - 0 value means no cap
    */
    constructor(string memory _name, string memory _symbol, uint256 _cap)
    public {
        name = _name;
        symbol = _symbol;
        cap = _cap;
    }

    /**
     * @dev Function to mint tokens
     * @param _to The address that will receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     */
    function mint(address _to, uint256 _amount) public onlyOwner returns (bool) {
        if (cap > 0)
            require(totalSupply().add(_amount) <= cap);
        _mint(_to, _amount);
        return true;
    }
}