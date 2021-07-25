pragma solidity >=0.4.25 <0.8.0;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC20Detailed } from "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract MockERC20 is ERC20, ERC20Detailed {
  function mint(address account, uint256 amount) external {
    _mint(account, amount);
  }
}

contract USDT is MockERC20 {
  constructor() public ERC20Detailed("Tether USD", "USDT", 6) {}
}

contract DIGG is MockERC20 {
  constructor() public ERC20Detailed("Digg", "DIGG", 9) {}
}

contract WBTC is MockERC20 {
  constructor() public ERC20Detailed("Wrapped BTC", "WBTC", 8) {}
}
