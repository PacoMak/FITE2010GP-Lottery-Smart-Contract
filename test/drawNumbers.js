import hre from "hardhat";
import { expect } from "chai";
import { Combination } from "js-combinatorics";
import { setupLotteryTest } from "./setUp.test.js";

describe("drawNumbers", function () {
  let lottery, owner, player1, player2, player3, TICKET_PRICE, DRAW_DURATION;

  beforeEach(async function () {
    ({
      lottery,
      owner,
      player1,
      player2,
      player3,
      TICKET_PRICE,
      DRAW_DURATION,
    } = await setupLotteryTest());
  });

  it("should allow owner to draw numbers after duration", async function () {
    const numbers = [1, 2, 3, 4];
    await lottery.connect(player1).buyTicket(numbers, { value: TICKET_PRICE });

    await hre.ethers.provider.send("evm_increaseTime", [DRAW_DURATION]);
    await hre.ethers.provider.send("evm_mine");

    const drawEvent = await lottery.connect(owner).drawNumbers();
    const draw = await lottery.getDrawDetails(0);
    expect(drawEvent)
      .to.emit(lottery, "DrawCompleted")
      .withArgs(1, draw.winningNumbers, draw.prizePool);
    expect(draw.completed).to.be.true;
    expect(draw.winningNumbers.length).to.equal(4);
    expect(draw.hasWinner).to.be.a("boolean");
  });

  it("should revert if called by non-owner", async function () {
    await lottery
      .connect(player1)
      .buyTicket([1, 2, 3, 4], { value: TICKET_PRICE });
    await hre.ethers.provider.send("evm_increaseTime", [DRAW_DURATION]);
    await hre.ethers.provider.send("evm_mine");

    await expect(lottery.connect(player1).drawNumbers()).to.be.revertedWith(
      "Only owner can call this function"
    );
  });

  it("should revert if no tickets purchased", async function () {
    await hre.ethers.provider.send("evm_increaseTime", [DRAW_DURATION]);
    await hre.ethers.provider.send("evm_mine");

    await expect(lottery.connect(owner).drawNumbers()).to.be.revertedWith(
      "No tickets purchased"
    );
  });

  it("should accumulate prize pool if no winner", async function () {
    await lottery
      .connect(player1)
      .buyTicket([1, 2, 3, 4], { value: TICKET_PRICE });
    await hre.ethers.provider.send("evm_increaseTime", [DRAW_DURATION]);
    await hre.ethers.provider.send("evm_mine");

    await lottery.connect(owner).drawNumbers();

    const drawDetails = await lottery.getDrawDetails(0);
    const currentPrizePool = await lottery.currentPrizePool();
    if (!drawDetails.hasWinner) {
      expect(drawDetails.prizePool).to.equal(TICKET_PRICE);
      expect(currentPrizePool).to.equal(TICKET_PRICE);
    } else {
      expect(drawDetails.prizePool).to.equal(TICKET_PRICE);
      expect(currentPrizePool).to.equal(0);
    }
  });

  it("should have winner", async function () {
    const numbersPool = Array.from({ length: 15 }, (_, i) => i + 1);
    const allTickets = new Combination(numbersPool, 4).toArray();
    const players = [player1, player2, player3];
    const playersInitialBalance = await Promise.all(
      players.map((player) => hre.ethers.provider.getBalance(player.address))
    );
    let playerIndex = 0;
    for (const ticket of allTickets) {
      await lottery
        .connect(players[playerIndex])
        .buyTicket(ticket, { value: TICKET_PRICE });
      playerIndex = (playerIndex + 1) % players.length;
    }
    await hre.ethers.provider.send("evm_increaseTime", [DRAW_DURATION]);
    await hre.ethers.provider.send("evm_mine");
    await lottery.connect(owner).drawNumbers();
    const drawDetails = await lottery.getDrawDetails(0);
    const playersFinalBalance = await Promise.all(
      players.map((player) => hre.ethers.provider.getBalance(player.address))
    );
    players.forEach((player, index) => {
      if (drawDetails.winners.includes(player.address)) {
        expect(playersFinalBalance[index]).to.be.gt(
          playersInitialBalance[index]
        );
      } else {
        expect(playersFinalBalance[index]).to.be.lt(
          playersInitialBalance[index]
        );
      }
    });
    expect(drawDetails.hasWinner).to.be.true;
  });
});
