// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CombatGame
 * @dev Web2.5 Escrow Contract for a Gasless/Trustless fighting game.
 * Uses ECDSA signatures from an authorized backend signer for withdrawals.
 */
contract CombatGame {
    address public owner;
    address public backendSigner; // The wallet used by Laravel to sign vouchers

    mapping(address => uint256) public userBalances;
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // Optional: Keep a historical trace of commits for ultimate trustlessness
    // mapping(bytes32 => mapping(address => bytes32)) public moveCommits;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount, uint256 nonce);
    event MoveCommitted(bytes32 indexed matchHash, address indexed player, bytes32 commitHash);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _backendSigner) {
        owner = msg.sender;
        backendSigner = _backendSigner;
    }

    function setBackendSigner(address _signer) external onlyOwner {
        backendSigner = _signer;
    }

    /**
     * @dev Deposit funds into the game ecosystem.
     * The backend listens to this event to credit the user's off-chain balance.
     */
    function deposit() external payable {
        require(msg.value > 0, "Amount must be > 0");
        userBalances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw funds from the game ecosystem using a backend signature.
     * The backend must sign: keccak256(abi.encodePacked(user, amount, nonce, address(this)))
     */
    function withdraw(uint256 amount, uint256 nonce, bytes memory signature) external {
        require(amount > 0, "Amount must be > 0");
        require(userBalances[msg.sender] >= amount, "Insufficient on-chain balance");
        require(!usedNonces[msg.sender][nonce], "Nonce already used");

        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, amount, nonce, address(this)));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        address recoveredSigner = recoverSigner(ethSignedMessageHash, signature);
        require(recoveredSigner == backendSigner, "Invalid backend signature");

        usedNonces[msg.sender][nonce] = true;
        userBalances[msg.sender] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(msg.sender, amount, nonce);
    }

    /**
     * @dev Historical trace: A player can choose to commit their move hash on-chain.
     * This proves they locked in their choice before the reveal phase.
     */
    function commitMove(bytes32 matchHash, bytes32 commitHash) external {
        // moveCommits[matchHash][msg.sender] = commitHash;
        // In a fully optimized rollup/appchain, we just emit an event to save storage gas.
        emit MoveCommitted(matchHash, msg.sender, commitHash);
    }

    // --- ECDSA Helper ---
    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
