// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CombatGame {
    enum MatchState { Pending, Accepted, Committed, Revealed, Finished, Canceled }

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
    }

    address public owner;
    uint256 public feePercent = 25; // 2.5% = 25 / 1000
    uint256 public timeoutDuration = 25 seconds;

    mapping(uint256 => Match) public matches;
    uint256 public matchCounter;
    mapping(address => uint256) public pendingWithdrawals;

    event ChallengeCreated(uint256 indexed matchId, address indexed challenger, address indexed target, uint256 betAmount, uint8 challengerChar);
    event ChallengeAccepted(uint256 indexed matchId, uint8 targetChar);
    event MoveCommitted(uint256 indexed matchId, address indexed player);
    event MoveRevealed(uint256 indexed matchId, address indexed player, uint8 move);
    event MatchFinished(uint256 indexed matchId, address indexed winner, uint256 payout);
    event TimeoutClaimed(uint256 indexed matchId, address indexed winner);
    event FundsClaimed(address indexed user, uint256 amount);
    event SettingsUpdated(uint256 newFee, uint256 newTimeout);

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
            lastActionTime: block.timestamp
        });

        emit ChallengeCreated(matchCounter, msg.sender, target, bet, charId);
    }

    function acceptChallenge(uint256 matchId, uint8 charId, uint256 bet) external payable {
        Match storage m = matches[matchId];
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
            // Target never accepted, challenger gets refund
            require(msg.sender == m.challenger, "Only challenger can cancel pending");
            pendingWithdrawals[m.challenger] += m.betAmount;
            m.state = MatchState.Canceled;
            emit TimeoutClaimed(matchId, m.challenger);
            return;
        } 
        
        require(msg.sender == m.challenger || msg.sender == m.target, "Not a player");
        address opponent = msg.sender == m.challenger ? m.target : m.challenger;

        if (m.state == MatchState.Accepted) {
            // Both must commit. If one committed and the other didn't, the one who committed wins.
            bool challengerCommitted = m.challengerCommit != 0;
            bool targetCommitted = m.targetCommit != 0;
            
            if (challengerCommitted && !targetCommitted) {
                winner = m.challenger;
            } else if (targetCommitted && !challengerCommitted) {
                winner = m.target;
            } else {
                // Neither committed. Refund both.
                pendingWithdrawals[m.challenger] += m.betAmount;
                pendingWithdrawals[m.target] += m.betAmount;
                m.state = MatchState.Canceled;
                emit TimeoutClaimed(matchId, address(0));
                return;
            }
        } else if (m.state == MatchState.Committed || m.state == MatchState.Revealed) {
            // Both committed. If one revealed and the other didn't, the one who revealed wins.
            bool challengerRevealed = m.challengerMove != 0;
            bool targetRevealed = m.targetMove != 0;

            if (challengerRevealed && !targetRevealed) {
                winner = m.challenger;
            } else if (targetRevealed && !challengerRevealed) {
                winner = m.target;
            } else {
                // Neither revealed. Refund both.
                pendingWithdrawals[m.challenger] += m.betAmount;
                pendingWithdrawals[m.target] += m.betAmount;
                m.state = MatchState.Canceled;
                emit TimeoutClaimed(matchId, address(0));
                return;
            }
        }

        m.winner = winner;
        m.state = MatchState.Finished;
        pendingWithdrawals[winner] += m.betAmount * 2;
        emit TimeoutClaimed(matchId, winner);
    }

    function _resolveMatch(uint256 matchId) internal {
        Match storage m = matches[matchId];
        m.state = MatchState.Finished;

        uint8 cm = m.challengerMove;
        uint8 tm = m.targetMove;

        address winner = address(0);
        uint256 payout = m.betAmount * 2;

        if (cm == tm) {
            // Draw
            pendingWithdrawals[m.challenger] += m.betAmount;
            pendingWithdrawals[m.target] += m.betAmount;
            emit MatchFinished(matchId, address(0), 0);
            return;
        } else if ((cm == 1 && tm == 3) || (cm == 2 && tm == 1) || (cm == 3 && tm == 2)) {
            winner = m.challenger;
        } else {
            winner = m.target;
        }

        m.winner = winner;
        pendingWithdrawals[winner] += payout;
        emit MatchFinished(matchId, winner, payout);
    }

    function claimFunds() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to claim");

        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);

        emit FundsClaimed(msg.sender, amount);
    }
}
