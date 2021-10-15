// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
/**
* @title Liquid staking pool
*/
interface ILido {

    /**
      * @notice Adds eth to the pool
      * @return StETH Amount of StETH generated
      */
    function submit(address _referral) external payable returns (uint256 StETH);

     /**
     * @notice Moves `_amount` tokens from the caller's account to the `_recipient` account.
     *
     * @return a boolean value indicating whether the operation succeeded.
     */
    function transfer(address _recipient, uint256 _amount) external returns (bool);
}


/**
 * @title Test deposit contract as custody for Lido
 *
 */
contract TestDeposit is ReentrancyGuard {
    using SafeMath for uint256;

    ILido public lido;

    mapping (address => uint256) public shares;
    /**
     * @param _lido address of the Lido contract
     */
    constructor(ILido _lido)
        public
    {
        lido = _lido;
    }

    /**
    * @notice Shortcut to stake ETH and auto-wrap returned stETH
    */
    receive() external payable {
        deposit();
    }

    /**
    * @notice deposit eth to Lido
    */
    function deposit() public payable {
        uint256 amount = lido.submit{value: msg.value}(address(0));
        shares[msg.sender] = shares[msg.sender].add(amount);
        
    }

    /**
     * @notice withdraw stETH from Lido
     * @param amount amount of stETH to withdraw
     * @dev Requirements:
     *  - `amount` must be non-zero
     *  - msg.sender must have at least `amount` stETH.
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(shares[msg.sender] >= amount, "LIMIT_OVERFLOW");
        shares[msg.sender] = shares[msg.sender].sub(amount);
        lido.transfer(msg.sender, amount);
    }
}
