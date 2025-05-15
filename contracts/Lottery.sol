//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract Lottery {
    uint8 constant public minNumber = 1;
    uint8 constant public maxNumber = 15;
    uint8 constant public numbersLength = 4;
    uint256 constant public ticketPrice = 0.01 ether;
    uint256 constant public drawDuration = 1 days;

    struct Ticket {
        address player;
        uint8[4] numbers;
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

    event TicketPurchased(uint256 indexed drawId, address indexed player, uint8[numbersLength] numbers);
    event DrawCompleted(uint256 indexed drawId, uint8[numbersLength] winningNumbers, uint256 prizePool);

    modifier onlyOwner() {
        require(msg.sender == GM, "Only owner can call this function");
        _;
    }

    modifier activeDraw() {
        require(block.timestamp < drawStartTime + drawDuration, "Draw has ended");
        _;
    }

    constructor() {
        GM = msg.sender;
        currentDrawId = 0;
        drawStartTime = block.timestamp;
        currentPrizePool = 0;
    }

    function buyTicket(uint8[numbersLength] memory _numbers) external payable activeDraw {
        require(msg.value == ticketPrice, "Incorrect ticket price");
        require(_numbers.length == numbersLength, "Must select 4 numbers");

        for (uint256 i = 0; i < numbersLength; i++) {
            require(_numbers[i] >= minNumber && _numbers[i] <= maxNumber, "Numbers must be between 1 and 15");
            for (uint256 j = i + 1; j < numbersLength; j++) {
                require(_numbers[i] != _numbers[j], "Duplicate numbers not allowed");
            }
        }

        Ticket memory newTicket = Ticket({
            player: msg.sender,
            numbers: _numbers
        });

        tickets[currentDrawId].push(newTicket);
        currentPrizePool += msg.value;

        emit TicketPurchased(currentDrawId, msg.sender, _numbers);
    }

    function drawNumbers() external onlyOwner {
        require(block.timestamp >= drawStartTime + drawDuration, "Draw not yet completed");
        require(tickets[currentDrawId].length > 0, "No tickets purchased");
        require(!draws[currentDrawId].completed, "Draw already completed");

        uint8[4] memory winningNumbers;
        uint256 randomness = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender)));

        // Generate winning numbers
        for (uint256 i = 0; i < numbersLength; i++) {
            uint8 num = uint8((randomness % maxNumber) + 1);
            randomness = uint256(keccak256(abi.encodePacked(randomness)));
            for (uint256 j = 0; j < i; j++) {
                if (winningNumbers[j] == num) {
                    num = (num % maxNumber) + 1;
                    j = 0; // Restart check
                }
            }
            winningNumbers[i] = num;
        }

        // Update draw state
        draws[currentDrawId].winningNumbers = winningNumbers;
        draws[currentDrawId].completed = true;
        draws[currentDrawId].prizePool = currentPrizePool;

        // Distribute prizes
        uint256 winnerCount = 0;
        for (uint256 i = 0; i < tickets[currentDrawId].length; i++) {
            uint256 matches = countMatches(tickets[currentDrawId][i].numbers, winningNumbers);
            if (matches == numbersLength){
                winnerCount++;
            }
        }

        address[] memory winners = new address[](winnerCount);
        uint256 index = 0;
        for (uint256 i = 0; i < tickets[currentDrawId].length; i++) {
            uint256 matches = countMatches(tickets[currentDrawId][i].numbers, winningNumbers);
            if (matches == numbersLength){
                winners[index] = tickets[currentDrawId][i].player;
                index++;
            }
        }
        draws[currentDrawId].winners = winners;
        if (winnerCount > 0){
            draws[currentDrawId].hasWinner = true;
            uint256 prizePerWinner = draws[currentDrawId].prizePool / winnerCount;
            for (uint256 i = 0; i < winnerCount; i++) {
                 (bool success, ) = winners[i].call{value: prizePerWinner}("");
                 if (success) {
                    currentPrizePool -= prizePerWinner;
                }
            }
            currentPrizePool = 0;
        }
        emit DrawCompleted(currentDrawId, winningNumbers, draws[currentDrawId].prizePool);

        currentDrawId++;
        drawStartTime = block.timestamp;
        draws[currentDrawId].drawId = currentDrawId;
    }

    function countMatches(uint8[4] memory _ticketNumbers, uint8[numbersLength] memory _winningNumbers) internal pure returns (uint256) {
        uint256 matches = 0;
        for (uint256 i = 0; i < numbersLength; i++) {
            for (uint256 j = 0; j < numbersLength; j++) {
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
            uint8[numbersLength] memory numbers
        )
    {
        Ticket storage ticket = tickets[_drawId][_ticketIndex];
        return (ticket.player, ticket.numbers);
    }

    function getDrawDetails(uint256 _drawId)
        external
        view
        returns (
            uint8[numbersLength] memory winningNumbers,
            uint256 prizePool,
            bool completed,
            bool hasWinner,
            address[] memory winners
        )
    {
        Draw storage draw = draws[_drawId];
        return (draw.winningNumbers, draw.prizePool, draw.completed, draw.hasWinner,draw.winners);
    }

}