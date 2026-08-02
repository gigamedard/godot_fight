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
    mapping(address => uint256) public treasuryBalances; // Commission des entrées
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // --- Escrow par poule (winner-take-all) ---
    // poolEscrow[poolId][user] = mise déposée par l'utilisateur dans la poule poolId
    mapping(uint256 => mapping(address => uint256)) public poolEscrow;
    mapping(uint256 => uint256) public poolTotal;          // pot total (N x mise) détenu en escrow
    mapping(uint256 => bool) public poolSettled;           // tremière poule déjà payée
    mapping(uint256 => mapping(uint256 => bool)) public poolUsedNonces;

    uint256 public feeBps = 250; // 2,5 % de commission sur la mise d'entrée, reconfigurable

    // Optional: Keep a historical trace of commits for ultimate trustlessness
    // mapping(bytes32 => mapping(address => bytes32)) public moveCommits;

    event Deposit(address indexed user, uint256 amount);
    event DepositWithFee(address indexed user, uint256 stake, uint256 fee);
    event PoolDeposit(uint256 indexed poolId, address indexed user, uint256 stake);
    event PoolClaimed(uint256 indexed poolId, address indexed winner, uint256 amount);
    event TreasuryWithdrawn(address indexed owner, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount, uint256 nonce);
    event MoveCommitted(bytes32 indexed matchHash, address indexed player, bytes32 commitHash);
    event MatchSettled(address indexed winner, address indexed loser, uint256 amount);

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
     * @dev Met à jour la commission d'entrée (en points de base, 10000 = 100%).
     * Restreint au owner pour reconfigurer les frais.
     */
    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 10000, "Fee too high");
        feeBps = _feeBps;
    }

    /**
     * @dev Dépôt de la mise d'entrée frais inclus (comptabilité serveur).
     * Le joueur envoie : stake + fee, où fee = (stake * feeBps) / 10000.
     * - stake est crédité à userBalances[msg.sender] => il compose le POT (N x mise).
     * - fee   est crédité à treasuryBalances[owner] (trésorerie du contrat, hors pot).
     * L'égalité est vérifiée exactement pour garantir pot = N x mise sans erreur d'arrondi.
     */
    function register(uint256 stake) external payable {
        require(stake > 0, "Stake must be > 0");
        uint256 fee = (stake * feeBps) / 10000;
        require(msg.value == stake + fee, "Send exact stake + fee");

        userBalances[msg.sender] += stake;
        treasuryBalances[owner] += fee;

        emit DepositWithFee(msg.sender, stake, fee);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Dépôt de la mise d'entrée dans l'escrow d'une poule (frais inclus).
     * Le joueur envoie stake + fee, avec fee = (stake * feeBps) / 10000).
     * - stake  est verrouillé dans poolEscrow[poolId][sender] et compose le pot de la poule.
     * - fee    part en trésorerie (commission du serveur, hors escrow).
     * L'égalité exacte garantit pot = prix de la poule sans erreur d'arrondi.
     */
    function registerForPool(uint256 poolId, uint256 stake) external payable {
        require(stake > 0, "Stake must be > 0");
        uint256 fee = (stake * feeBps) / 10000;
        require(msg.value == stake + fee, "Send exact stake + fee");
        require(!poolSettled[poolId], "Pool already settled");

        poolEscrow[poolId][msg.sender] += stake;
        poolTotal[poolId] += stake;
        treasuryBalances[owner] += fee;

        emit PoolDeposit(poolId, msg.sender, stake);
    }

    /**
     * @dev Winner-take-all : le champion retire l'intégralité du pot de la poule,
     * en une seule fois, depuis l'escrow de la poule.
     * Autorisé par une signature unique du backend signer sur
     *     keccak256(abi.encodePacked( poolId, winner, amount, nonce, address(this) ))
     * puis préfixé EIP-191. amount == poolTotal[poolId] doit être strict.
     * Une fois payée, la poule est marquée settled : plus aucun dépôt/claim possible.
     */
    function claimPool(uint256 poolId, uint256 amount, uint256 nonce, bytes calldata signature) external {
        require(amount == poolTotal[poolId], "Amount != pool total");
        require(amount > 0, "Nothing to claim");
        require(!poolSettled[poolId], "Pool already settled");
        require(!poolUsedNonces[poolId][nonce], "Nonce already used");

        bytes32 messageHash = keccak256(abi.encodePacked(poolId, msg.sender, amount, nonce, address(this)));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address recovered = recoverSigner(ethSignedMessageHash, signature);
        require(recovered == backendSigner, "Invalid backend signature");

        poolUsedNonces[poolId][nonce] = true;
        poolSettled[poolId] = true;
        poolTotal[poolId] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit PoolClaimed(poolId, msg.sender, amount);
    }

    /**
     * @dev Owner peut retirer les frais accumulés dans la trésorerie.
     */
    function withdrawTreasury() external onlyOwner {
        uint256 amount = treasuryBalances[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        treasuryBalances[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        emit TreasuryWithdrawn(msg.sender, amount);
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
     * @dev Winner-takes-all: transfère l'escrow du perdant vers le gagnant.
     * Autorisé par une signature du backend signer (comme les retraits).
     * Le backend signe : keccak256(abi.encodePacked(winner, loser, address(this)))
     */
    function settleLoser(address winner, address loser, bytes memory signature) external {
        require(loser != winner, "Same address");
        uint256 amt = userBalances[loser];
        require(amt > 0, "Nothing to settle");

        bytes32 messageHash = keccak256(abi.encodePacked(winner, loser, address(this)));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));

        address recoveredSigner = recoverSigner(ethSignedMessageHash, signature);
        require(recoveredSigner == backendSigner, "Invalid backend signature");

        userBalances[loser] = 0;
        userBalances[winner] += amt;

        emit MatchSettled(winner, loser, amt);
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
