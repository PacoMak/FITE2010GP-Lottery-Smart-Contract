//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract Lottery {
    uint8 constant public MIN_NUMBER = 1;
    uint8 constant public MAX_NUMBER = 15;
    uint8 constant public NUMBERS_LENGTH = 4;
    uint256 constant public TICKET_PRICE = 0.01 ether;
    uint256 constant public COMMIT_DURATION = 12 hours;
    uint256 public constant REVEAL_DURATION = 12 hours;

    
    struct Ticket {
        address player;
        uint8[4] numbers;
        bytes32 seedCommitment;
        uint256 seed; 
        bool revealed;
    }
    struct Draw {
        uint256 drawId;
        uint8[4] winningNumbers;
        uint256 prizePool;
        bool completed;
        bool hasWinner;
        address[] winners;
    }
    address public GM;

    uint256 public drawStartTime;
    uint256 public currentDrawId;
    uint256 public currentPrizePool;
    mapping(uint256 => Draw) public draws;
    mapping(uint256 => Ticket[]) public tickets;
    mapping(address => uint256) public pendingWithdrawals;

    enum DrawState{Commit, Reveal,Completed}
    DrawState public currentState;

    event TicketPurchased(uint256 indexed drawId, address indexed player, uint8[NUMBERS_LENGTH] numbers,bytes32 seedCommitHash);
    event DrawCompleted(uint256 indexed drawId, uint8[NUMBERS_LENGTH] winningNumbers, uint256 prizePool);
    event PrizeDistributed(uint256 indexed drawId, address indexed winner, uint256 amount);
    event SeedRevealed(uint256 indexed drawId, address indexed player, uint256 seed);

    modifier onlyOwner() { 
        require(msg.sender == GM, "Only owner can call this function");
        _; 
    }

    constructor() {
        GM = msg.sender;
        currentDrawId = 0;
        draws[currentDrawId].drawId = currentDrawId;
        drawStartTime = block.timestamp;
        currentState = DrawState.Commit;
        currentPrizePool = 0;

    }

    function buyTicket(uint8[NUMBERS_LENGTH] memory _numbers, bytes32 seedCommitHash) external payable {
        require(currentState == DrawState.Commit, "Not in commit phase");
        require(msg.value == TICKET_PRICE, "Incorrect ticket price");
        require(_numbers.length == NUMBERS_LENGTH, "Must select 4 numbers");

        for (uint256 i = 0; i < NUMBERS_LENGTH; i++) {
            require(_numbers[i] >= MIN_NUMBER && _numbers[i] <= MAX_NUMBER, "Numbers must be between 1 and 15");
            for (uint256 j = i + 1; j < NUMBERS_LENGTH; j++) {
                require(_numbers[i] != _numbers[j], "Duplicate numbers not allowed");
            }
        }

        tickets[currentDrawId].push(
            Ticket({
                player: msg.sender,
                numbers: _numbers,
                seedCommitment: seedCommitHash,
                seed: uint256(0),
                revealed:false
            })
        );
        currentPrizePool += msg.value;

        emit TicketPurchased(currentDrawId, msg.sender, _numbers,seedCommitHash);
    }

    function revealSeed(uint256 _ticketIndex, string memory secret, uint256 _seed) external {
        require(currentState == DrawState.Reveal, "Not in reveal phase");
        require(block.timestamp >= drawStartTime + COMMIT_DURATION, "Reveal phase not started");
        require(block.timestamp < drawStartTime + COMMIT_DURATION + REVEAL_DURATION, "Reveal phase ended");
        require(_ticketIndex < tickets[currentDrawId].length, "Invalid ticket index");
        require(tickets[currentDrawId][_ticketIndex].player == msg.sender, "Not your ticket");
        require(!tickets[currentDrawId][_ticketIndex].revealed, "Already revealed");

        // Verify seed commitment
        bytes32 computedCommitment = calculateCommitHash(secret, _seed);
        require(computedCommitment == tickets[currentDrawId][_ticketIndex].seedCommitment, "Invalid seed reveal");

        tickets[currentDrawId][_ticketIndex].seed = _seed;
        tickets[currentDrawId][_ticketIndex].revealed = true;

        emit SeedRevealed(currentDrawId, msg.sender, _seed);
    }

    function startRevealPhase() external onlyOwner {
        require(currentState == DrawState.Commit, "Already in reveal phase");
        require(block.timestamp >= drawStartTime + COMMIT_DURATION, "Commit phase not ended");
        currentState = DrawState.Reveal;
    }

    function drawNumbers() external onlyOwner {
        require(currentState == DrawState.Reveal, "Not in reveal phase");
        require(block.timestamp >= drawStartTime + COMMIT_DURATION + REVEAL_DURATION, "Reveal phase not ended");
        require(tickets[currentDrawId].length > 0, "No tickets purchased");
        require(!draws[currentDrawId].completed, "Draw already completed");

        uint256 randomness = 0;
        uint256 revealCount = 0;
        for (uint256 i = 0; i < tickets[currentDrawId].length; i++) {
            if (tickets[currentDrawId][i].revealed) {
                randomness = uint256(keccak256(abi.encode(randomness, tickets[currentDrawId][i].seed)));
                revealCount++;
            }
        }

        uint8[NUMBERS_LENGTH] memory winningNumbers;
        for (uint256 i = 0; i < NUMBERS_LENGTH; i++) {
            uint8 num = uint8((randomness % MAX_NUMBER) + 1);
            randomness = uint256(keccak256(abi.encodePacked(randomness)));
            for (uint256 j = 0; j < i; j++) {
                if (winningNumbers[j] == num) {
                    num = (num % MAX_NUMBER) + 1;
                    j = 0; 
                }
            }
            winningNumbers[i] = num;
        }

        draws[currentDrawId].winningNumbers = winningNumbers;
        draws[currentDrawId].completed = true;
        draws[currentDrawId].prizePool = currentPrizePool;

        uint256 winnerCount = 0;
        for (uint256 i = 0; i < tickets[currentDrawId].length; i++) {
            if (!tickets[currentDrawId][i].revealed){
                continue;
            }
            uint256 matches = countMatches(tickets[currentDrawId][i].numbers, winningNumbers);
            if (matches == NUMBERS_LENGTH){
                winnerCount++;
            }
        }

        address[] memory winners = new address[](winnerCount);
        uint256 index = 0;
        for (uint256 i = 0; i < tickets[currentDrawId].length; i++) {
            if (!tickets[currentDrawId][i].revealed){
                continue;
            }
            uint256 matches = countMatches(tickets[currentDrawId][i].numbers, winningNumbers);
            if (matches == NUMBERS_LENGTH){
                winners[index] = tickets[currentDrawId][i].player;
                index++;
            }
        }
        draws[currentDrawId].winners = winners;

        if (winnerCount > 0){
            draws[currentDrawId].hasWinner = true;
            uint256 prizePerWinner = draws[currentDrawId].prizePool / winnerCount;
            for (uint256 i = 0; i < winnerCount; i++) {
                pendingWithdrawals[winners[i]] += prizePerWinner;
                emit PrizeDistributed(currentDrawId, winners[i], prizePerWinner);
            }
            currentPrizePool = 0;
        }
        emit DrawCompleted(currentDrawId, winningNumbers, draws[currentDrawId].prizePool);

        currentDrawId++;
        drawStartTime = block.timestamp;
        draws[currentDrawId].drawId = currentDrawId;
        currentState = DrawState.Commit;
    }

    function withdrawPrize() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No prize to withdraw");

        (bool success, ) = msg.sender.call{value: amount}("");
        if (success){
            pendingWithdrawals[msg.sender] = 0;
        }
        require(success, "Transfer failed");
    }

    function countMatches(uint8[4] memory _ticketNumbers, uint8[NUMBERS_LENGTH] memory _winningNumbers) internal pure returns (uint256) {
        uint256 matches = 0;
        for (uint256 i = 0; i < NUMBERS_LENGTH; i++) {
            for (uint256 j = 0; j < NUMBERS_LENGTH; j++) {
                if (_ticketNumbers[i] == _winningNumbers[j]) {
                    matches++;
                }
            }
        }
        return matches;
    }

    function getTicketDetails(uint256 _drawId, uint256 _ticketIndex)
        external
        view
        returns (
            address player,
            uint8[NUMBERS_LENGTH] memory numbers,
            bytes32 seedCommitment,
            uint256 seed,
            bool revealed
        )
    {
        Ticket storage ticket = tickets[_drawId][_ticketIndex];
        return (ticket.player, ticket.numbers, ticket.seedCommitment, ticket.seed, ticket.revealed);
    }

    function getDrawDetails(uint256 _drawId)
        external
        view
        returns (
            uint8[NUMBERS_LENGTH] memory winningNumbers,
            uint256 prizePool,
            bool completed,
            bool hasWinner,
            address[] memory winners
        )
    {
        Draw storage draw = draws[_drawId];
        return (draw.winningNumbers, draw.prizePool, draw.completed, draw.hasWinner,draw.winners);
    }

    function calculateCommitHash(string memory secret, uint256 randomness) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(secret, randomness));
    }
}