// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TestToken (USDEMO)
 * @notice Basic ERC-20 token for testing Permit2 integration.
 * @dev This is a minimal ERC-20 WITHOUT native permit support,
 *      demonstrating that Permit2 works with ANY standard ERC-20.
 */
contract TestToken {
    string public constant name = "USD Demo";
    string public constant symbol = "USDEMO";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @notice Mints 1,000,000 USDEMO to the deployer
     */
    constructor() {
        uint256 initialSupply = 1_000_000 * 10 ** decimals;
        balanceOf[msg.sender] = initialSupply;
        totalSupply = initialSupply;
        emit Transfer(address(0), msg.sender, initialSupply);
    }

    /**
     * @notice Transfer tokens to a recipient
     * @param to Recipient address
     * @param value Amount to transfer
     * @return success True if transfer succeeded
     */
    function transfer(address to, uint256 value) external returns (bool success) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    /**
     * @notice Approve spender to transfer tokens on your behalf
     * @param spender Address to approve
     * @param value Amount to approve
     * @return success True if approval succeeded
     */
    function approve(address spender, uint256 value) external returns (bool success) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /**
     * @notice Transfer tokens from one address to another (requires approval)
     * @param from Source address
     * @param to Destination address
     * @param value Amount to transfer
     * @return success True if transfer succeeded
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool success) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");
        balanceOf[from] -= value;
        allowance[from][msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }
}
