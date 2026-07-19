// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CombatGame {
    enum MatchState { Pending, Accepted, Committed, Revealed, Finished, Canceled }
    enum PenaltyMode { OneBaseBet, AllBalance }

    struct Pool {
        uint256 entryFee;
        uint256 maxPlayers;
        PenaltyMode penaltyMode;
        bool isActive;
        address owner; // 0x0 for auto pools
        uint256 playersCount;
    }

    struct Match {
        address challenger;
        address target;
        uint256 betAmount;
        bytes32 challengerCommit;
        bytes32 targetCommit;
        uint8 challengerMove;
        uint8 targetMove;
        uint8 challengerChar;
        uint8 targetChar;
        MatchState state;
        address winner;
        uint256 lastActionTime;
        bool isPoolMatch;
        uint256 poolId;
    }

    address public owner;
    uint256 public feePercent = 25; // 2.5% = 25 / 1000
    uint256 public timeoutDuration = 25 seconds;

    mapping(uint256 => Match) public matches;
    uint256 public matchCounter;
    mapping(address => uint256) public pendingWithdrawals;

    // Pool variables
    mapping(uint256 => Pool) public pools;
    uint256 public poolCounter;
    mapping(uint256 => mapping(address => uint256)) public poolBalances;

    event ChallengeCreated(uint256 indexed matchId, address indexed challenger, address indexed target, uint256 betAmount, uint8 challengerChar);
    event ChallengeAccepted(uint256 indexed matchId, uint8 targetChar);
    event MoveCommitted(uint256 indexed matchId, address indexed player);
    event MoveRevealed(uint256 indexed matchId, address indexed player, uint8 move);
    event MatchFinished(uint256 indexed matchId, address indexed winner, uint256 payout);
    event TimeoutClaimed(uint256 indexed matchId, address indexed winner);
    event FundsClaimed(address indexed user, uint256 amount);
    event SettingsUpdated(uint256 newFee, uint256 newTimeout);

    // Pool events
    event PoolCreated(uint256 indexed poolId, uint256 entryFee, uint256 maxPlayers, PenaltyMode penaltyMode, address owner);
    event PoolJoined(uint256 indexed poolId, address indexed player);
    event PoolMatchFinished(uint256 indexed poolId, uint256 indexed matchId, address indexed winner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function updateSettings(uint256 _feePercent, uint256 _timeoutDuration) external onlyOwner {
        require(_feePercent <= 100, "Fee too high"); // Max 10%
        feePercent = _feePercent;
        timeoutDuration = _timeoutDuration;
        emit SettingsUpdated(_feePercent, _timeoutDuration);
    }

    // --- NORMAL DUELS ---

    function challenge(address target, uint8 charId, uint256 bet) external payable {
        require(bet > 0, "Bet must be > 0");
        require(target != msg.sender, "Cannot challenge yourself");
        
        uint256 fee = (bet * feePercent) / 1000;
        require(msg.value == bet + fee, "Incorrect value sent (must include fee)");

        pendingWithdrawals[owner] += fee;

        matchCounter++;
        matches[matchCounter] = Match({
            challenger: msg.sender,
            target: target,
            betAmount: bet,
            challengerCommit: 0,
            targetCommit: 0,
            challengerMove: 0,
            targetMove: 0,
            challengerChar: charId,
            targetChar: 0,
            state: MatchState.Pending,
            winner: address(0),
            lastActionTime: block.timestamp,
            isPoolMatch: false,
            poolId: 0
        });

        emit ChallengeCreated(matchCounter, msg.sender, target, bet, charId);
    }

    function acceptChallenge(uint256 matchId, uint8 charId, uint256 bet) external payable {
        Match storage m = matches[matchId];
        require(!m.isPoolMatch, "Is a pool match");
        require(m.state == MatchState.Pending, "Match not pending");
        require(m.target == msg.sender, "Not your challenge");
        require(m.betAmount == bet, "Bet mismatch");
        
        uint256 fee = (bet * feePercent) / 1000;
        require(msg.value == bet + fee, "Incorrect value sent (must include fee)");

        pendingWithdrawals[owner] += fee;

        m.targetChar = charId;
        m.state = MatchState.Accepted;
        m.lastActionTime = block.timestamp;

        emit ChallengeAccepted(matchId, charId);
    }

    // --- POOL SYSTEM ---

    function createPool(uint256 entryFee, uint256 maxPlayers, PenaltyMode penaltyMode) external {
        require(entryFee > 0, "Entry fee must be > 0");
        poolCounter++;
        pools[poolCounter] = Pool({
            entryFee: entryFee,
            maxPlayers: maxPlayers,
            penaltyMode: penaltyMode,
            isActive: true,
            owner: msg.sender,
            playersCount: 0
        });
        emit PoolCreated(poolCounter, entryFee, maxPlayers, penaltyMode, msg.sender);
    }

    function createAndJoinPool(uint256 entryFee, uint256 maxPlayers, PenaltyMode penaltyMode) external payable {
        require(entryFee > 0, "Entry fee must be > 0");
        poolCounter++;
        pools[poolCounter] = Pool({
            entryFee: entryFee,
            maxPlayers: maxPlayers,
            penaltyMode: penaltyMode,
            isActive: true,
            owner: msg.sender,
            playersCount: 0
        });
        emit PoolCreated(poolCounter, entryFee, maxPlayers, penaltyMode, msg.sender);
        
        // Immediately join the newly created pool
        _joinPoolInternal(poolCounter, msg.sender, msg.value);
    }

    function createAutoPool(uint256 entryFee, uint256 maxPlayers, PenaltyMode penaltyMode) external onlyOwner {
        require(entryFee > 0, "Entry fee must be > 0");
        poolCounter++;
        pools[poolCounter] = Pool({
            entryFee: entryFee,
            maxPlayers: maxPlayers,
            penaltyMode: penaltyMode,
            isActive: true,
            owner: address(0),
            playersCount: 0
        });
        emit PoolCreated(poolCounter, entryFee, maxPlayers, penaltyMode, address(0));
    }

    function joinPool(uint256 poolId) external payable {
        _joinPoolInternal(poolId, msg.sender, msg.value);
    }

    function _joinPoolInternal(uint256 poolId, address player, uint256 value) internal {
        Pool storage p = pools[poolId];
        require(p.isActive, "Pool not active");
        require(p.playersCount < p.maxPlayers, "Pool is full");
        
        uint256 fee = (p.entryFee * feePercent) / 1000;
        require(value == p.entryFee + fee, "Incorrect value sent (must include fee)");

        pendingWithdrawals[owner] += fee;
        poolBalances[poolId][player] += p.entryFee;
        p.playersCount++;

        emit PoolJoined(poolId, player);
    }

    function challengePool(address target, uint8 charId, uint256 poolId) external {
        Pool storage p = pools[poolId];
        require(p.isActive, "Pool not active");
        require(poolBalances[poolId][msg.sender] >= p.entryFee, "Insufficient pool balance");
        require(poolBalances[poolId][target] >= p.entryFee, "Target not in pool");
        require(target != msg.sender, "Cannot challenge yourself");

        matchCounter++;
        matches[matchCounter] = Match({
            challenger: msg.sender,
            target: target,
            betAmount: p.entryFee, // In pool, bet is always the entryFee base
            challengerCommit: 0,
            targetCommit: 0,
            challengerMove: 0,
            targetMove: 0,
            challengerChar: charId,
            targetChar: 0,
            state: MatchState.Pending,
            winner: address(0),
            lastActionTime: block.timestamp,
            isPoolMatch: true,
            poolId: poolId
        });

        emit ChallengeCreated(matchCounter, msg.sender, target, p.entryFee, charId);
    }

    function acceptPoolChallenge(uint256 matchId, uint8 charId) external {
        Match storage m = matches[matchId];
        require(m.isPoolMatch, "Not a pool match");
        require(m.state == MatchState.Pending, "Match not pending");
        require(m.target == msg.sender, "Not your challenge");
        
        uint256 poolId = m.poolId;
        require(poolBalances[poolId][msg.sender] >= m.betAmount, "Insufficient pool balance");

        m.targetChar = charId;
        m.state = MatchState.Accepted;
        m.lastActionTime = block.timestamp;

        emit ChallengeAccepted(matchId, charId);
    }

    function leavePool(uint256 poolId) external {
        Pool storage p = pools[poolId];
        require(p.playersCount < p.maxPlayers, "Pool has already started");
        
        uint256 bal = poolBalances[poolId][msg.sender];
        require(bal > 0, "No balance in pool");
        
        poolBalances[poolId][msg.sender] = 0;
        pendingWithdrawals[msg.sender] += bal;
        p.playersCount--;
    }

    function claimPoolWinnings(uint256 poolId) external {
        Pool storage p = pools[poolId];
        uint256 expectedTotal = p.entryFee * p.maxPlayers;
        uint256 bal = poolBalances[poolId][msg.sender];
        
        require(bal == expectedTotal, "You have not won the entire pool yet");
        
        poolBalances[poolId][msg.sender] = 0;
        pendingWithdrawals[msg.sender] += bal;
        p.isActive = false; // Mark pool as completely finished on-chain
    }

    // --- SHARED GAME LOGIC ---

    function commitMove(uint256 matchId, bytes32 moveHash) external {
        Match storage m = matches[matchId];
        require(m.state == MatchState.Accepted || m.state == MatchState.Committed, "Invalid state");
        require(msg.sender == m.challenger || msg.sender == m.target, "Not in match");

        if (msg.sender == m.challenger) {
            require(m.challengerCommit == 0, "Already committed");
            m.challengerCommit = moveHash;
        } else {
            require(m.targetCommit == 0, "Already committed");
            m.targetCommit = moveHash;
        }

        if (m.challengerCommit != 0 && m.targetCommit != 0) {
            m.state = MatchState.Committed;
        }

        m.lastActionTime = block.timestamp;
        emit MoveCommitted(matchId, msg.sender);
    }

    function revealMove(uint256 matchId, uint8 move, string calldata salt) external {
        Match storage m = matches[matchId];
        require(m.state == MatchState.Committed || m.state == MatchState.Revealed, "Invalid state");
        require(msg.sender == m.challenger || msg.sender == m.target, "Not in match");

        bytes32 expectedHash = keccak256(abi.encodePacked(move, salt));

        if (msg.sender == m.challenger) {
            require(m.challengerMove == 0, "Already revealed");
            require(m.challengerCommit == expectedHash, "Invalid reveal");
            m.challengerMove = move;
        } else {
            require(m.targetMove == 0, "Already revealed");
            require(m.targetCommit == expectedHash, "Invalid reveal");
            m.targetMove = move;
        }

        m.lastActionTime = block.timestamp;
        emit MoveRevealed(matchId, msg.sender, move);

        if (m.challengerMove != 0 && m.targetMove != 0) {
            _resolveMatch(matchId);
        }
    }

    function claimTimeout(uint256 matchId) external {
        Match storage m = matches[matchId];
        require(m.state != MatchState.Finished && m.state != MatchState.Canceled, "Match already ended");
        require(block.timestamp > m.lastActionTime + timeoutDuration, "Timeout not reached");

        address winner = address(0);

        if (m.state == MatchState.Pending) {
            require(msg.sender == m.challenger, "Only challenger can cancel pending");
            if (!m.isPoolMatch) {
                pendingWithdrawals[m.challenger] += m.betAmount;
            }
            m.state = MatchState.Canceled;
            emit TimeoutClaimed(matchId, m.isPoolMatch ? address(0) : m.challenger);
            return;
        } 
        
        require(msg.sender == m.challenger || msg.sender == m.target, "Not a player");

        if (m.state == MatchState.Accepted) {
            bool challengerCommitted = m.challengerCommit != 0;
            bool targetCommitted = m.targetCommit != 0;
            
            if (challengerCommitted && !targetCommitted) {
                winner = m.challenger;
            } else if (targetCommitted && !challengerCommitted) {
                winner = m.target;
            } else {
                _refundMatch(matchId);
                m.state = MatchState.Canceled;
                emit TimeoutClaimed(matchId, address(0));
                return;
            }
        } else if (m.state == MatchState.Committed || m.state == MatchState.Revealed) {
            bool challengerRevealed = m.challengerMove != 0;
            bool targetRevealed = m.targetMove != 0;

            if (challengerRevealed && !targetRevealed) {
                winner = m.challenger;
            } else if (targetRevealed && !challengerRevealed) {
                winner = m.target;
            } else {
                _refundMatch(matchId);
                m.state = MatchState.Canceled;
                emit TimeoutClaimed(matchId, address(0));
                return;
            }
        }

        m.winner = winner;
        m.state = MatchState.Finished;
        
        if (m.isPoolMatch) {
            if (winner != address(0)) {
                _applyPoolPenalty(m.poolId, m.challenger, m.target, winner);
            }
            emit TimeoutClaimed(matchId, winner);
            emit PoolMatchFinished(m.poolId, matchId, winner);
        } else {
            pendingWithdrawals[winner] += m.betAmount * 2;
            emit TimeoutClaimed(matchId, winner);
        }
    }

    function _refundMatch(uint256 matchId) internal {
        Match storage m = matches[matchId];
        if (!m.isPoolMatch) {
            pendingWithdrawals[m.challenger] += m.betAmount;
            pendingWithdrawals[m.target] += m.betAmount;
        }
    }

    function _resolveMatch(uint256 matchId) internal {
        Match storage m = matches[matchId];
        m.state = MatchState.Finished;

        uint8 cm = m.challengerMove;
        uint8 tm = m.targetMove;

        address winner = address(0);

        if (cm == tm) {
            // Draw
            _refundMatch(matchId);
            emit MatchFinished(matchId, address(0), 0);
            if (m.isPoolMatch) emit PoolMatchFinished(m.poolId, matchId, address(0));
            return;
        } else if ((cm == 1 && tm == 3) || (cm == 2 && tm == 1) || (cm == 3 && tm == 2)) {
            winner = m.challenger;
        } else {
            winner = m.target;
        }

        m.winner = winner;
        
        if (m.isPoolMatch) {
            _applyPoolPenalty(m.poolId, m.challenger, m.target, winner);
            emit MatchFinished(matchId, winner, m.betAmount * 2); // Send betAmount*2 just for event compat
            emit PoolMatchFinished(m.poolId, matchId, winner);
        } else {
            uint256 payout = m.betAmount * 2;
            pendingWithdrawals[winner] += payout;
            emit MatchFinished(matchId, winner, payout);
        }
    }

    function _applyPoolPenalty(uint256 poolId, address p1, address p2, address winner) internal {
        address loser = (winner == p1) ? p2 : p1;
        Pool storage p = pools[poolId];
        
        if (p.penaltyMode == PenaltyMode.OneBaseBet) {
            uint256 penalty = p.entryFee;
            if (poolBalances[poolId][loser] < penalty) {
                penalty = poolBalances[poolId][loser]; 
            }
            poolBalances[poolId][loser] -= penalty;
            poolBalances[poolId][winner] += penalty;
        } else {
            uint256 loserBal = poolBalances[poolId][loser];
            poolBalances[poolId][loser] = 0;
            poolBalances[poolId][winner] += loserBal;
        }
    }

    function claimFunds() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to claim");

        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);

        emit FundsClaimed(msg.sender, amount);
    }
}
