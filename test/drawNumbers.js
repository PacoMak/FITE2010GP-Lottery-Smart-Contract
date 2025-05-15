import hre from "hardhat";
import { expect } from "chai";
import { Combination } from "js-combinatorics";
import { setupLotteryTest } from "./setUp.test.js";

describe("drawNumbers", function () {
  let lottery,
    owner,
    player1,
    player1Secret,
    player2,
    player2Secret,
    TICKET_PRICE,
    COMMIT_DURATION,
    REVEAL_DURATION;

  beforeEach(async function () {
    ({
      lottery,
      owner,
      player1,
      player1Secret,
      player2,
      player2Secret,
      TICKET_PRICE,
      COMMIT_DURATION,
      REVEAL_DURATION,
    } = await setupLotteryTest());
  });

  it("should revert if called by non-owner", async function () {
    const numbers = [1, 2, 3, 4];
    const seed = Math.floor(Math.random() * 100);
    const seedCommitment = await lottery.calculateCommitHash(
      player1Secret,
      seed
    );
    await lottery
      .connect(player1)
      .buyTicket(numbers, seedCommitment, { value: TICKET_PRICE });
    await hre.ethers.provider.send("evm_increaseTime", [
      COMMIT_DURATION + REVEAL_DURATION,
    ]);
    await hre.ethers.provider.send("evm_mine");

    await expect(lottery.connect(player1).drawNumbers()).to.be.revertedWith(
      "Only owner can call this function"
    );
  });

  it("should revert if phase incorrect", async function () {
    const numbers = [1, 2, 3, 4];
    const seed = Math.floor(Math.random() * 100);
    const seedCommitment = await lottery.calculateCommitHash(
      player1Secret,
      seed
    );
    await lottery
      .connect(player1)
      .buyTicket(numbers, seedCommitment, { value: TICKET_PRICE });

    await expect(lottery.connect(owner).drawNumbers()).to.be.revertedWith(
      "Not in reveal phase"
    );

    await hre.ethers.provider.send("evm_increaseTime", [COMMIT_DURATION]);
    await hre.ethers.provider.send("evm_mine");
    await lottery.connect(owner).startRevealPhase();
    await expect(lottery.connect(owner).drawNumbers()).to.be.revertedWith(
      "Reveal phase not ended"
    );
  });
  it("should allow owner to draw numbers after duration", async function () {
    const numbers = [1, 2, 3, 4];
    const seed = Math.floor(Math.random() * 100);
    const seedCommitment = await lottery.calculateCommitHash(
      player1Secret,
      seed
    );
    await lottery
      .connect(player1)
      .buyTicket(numbers, seedCommitment, { value: TICKET_PRICE });

    await hre.ethers.provider.send("evm_increaseTime", [COMMIT_DURATION]);
    await hre.ethers.provider.send("evm_mine");
    await lottery.connect(owner).startRevealPhase();
    await lottery.connect(player1).revealSeed(0, player1Secret, seed);
    await hre.ethers.provider.send("evm_increaseTime", [REVEAL_DURATION]);
    await hre.ethers.provider.send("evm_mine");

    const drawEvent = await lottery.connect(owner).drawNumbers();
    const draw = await lottery.getDrawDetails(0);
    expect(drawEvent)
      .to.emit(lottery, "DrawCompleted")
      .withArgs(0, draw.winningNumbers, draw.prizePool);
    expect(draw.completed).to.be.true;
    expect(draw.winningNumbers.length).to.equal(4);
    expect(draw.hasWinner).to.be.a("boolean");
  });

  it("should accumulate prize pool if no winner else reset", async function () {
    const numbers = [1, 2, 3, 4];
    const seed = Math.floor(Math.random() * 100);
    const seedCommitment = await lottery.calculateCommitHash(
      player1Secret,
      seed
    );
    await lottery
      .connect(player1)
      .buyTicket(numbers, seedCommitment, { value: TICKET_PRICE });
    await hre.ethers.provider.send("evm_increaseTime", [COMMIT_DURATION]);
    await hre.ethers.provider.send("evm_mine");
    await lottery.connect(owner).startRevealPhase();
    await lottery.connect(player1).revealSeed(0, player1Secret, seed);
    await hre.ethers.provider.send("evm_increaseTime", [REVEAL_DURATION]);
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

  it("should distribute prize to winners and allow withdraw", async function () {
    const numbersPool = Array.from({ length: 15 }, (_, i) => i + 1);
    const allTickets = new Combination(numbersPool, 4).toArray();
    const players = [player1, player2];
    const playersSecret = [player1Secret, player2Secret];
    const playersSeed = [
      Math.floor(Math.random() * 100),
      Math.floor(Math.random() * 100),
    ];

    let playerIndex = 0;
    for (const ticket of allTickets) {
      const seedCommitment = await lottery.calculateCommitHash(
        playersSecret[playerIndex],
        playersSeed[playerIndex]
      );
      await lottery
        .connect(players[playerIndex])
        .buyTicket(ticket, seedCommitment, { value: TICKET_PRICE });
      playerIndex = (playerIndex + 1) % players.length;
    }
    await hre.ethers.provider.send("evm_increaseTime", [COMMIT_DURATION]);
    await hre.ethers.provider.send("evm_mine");
    await lottery.connect(owner).startRevealPhase();
    playerIndex = 0;
    let count = 0;
    for (const ticket of allTickets) {
      await lottery
        .connect(players[playerIndex])
        .revealSeed(
          count,
          playersSecret[playerIndex],
          playersSeed[playerIndex]
        );
      playerIndex = (playerIndex + 1) % players.length;
      count++;
    }
    await hre.ethers.provider.send("evm_increaseTime", [REVEAL_DURATION]);
    await hre.ethers.provider.send("evm_mine");

    await lottery.connect(owner).drawNumbers();
    const drawDetails = await lottery.getDrawDetails(0);

    expect(drawDetails.hasWinner).to.be.true;
    expect(await lottery.currentPrizePool()).to.equal(0);

    const winnersAddress = drawDetails.winners;

    winnersAddress.forEach(async (winnerAddress) => {
      expect(await lottery.pendingWithdrawals(winnerAddress)).to.be.greaterThan(
        0
      );
    });

    for (const player of players) {
      const amount = await lottery.pendingWithdrawals(player.address);
      if (amount <= 0) {
        await expect(
          lottery.connect(player).withdrawPrize()
        ).to.be.revertedWith("No prize to withdraw");
        continue;
      }
      const initBlance = await ethers.provider.getBalance(player.address);
      await lottery.connect(player).withdrawPrize();
      const finalBlance = await ethers.provider.getBalance(player.address);
      expect(finalBlance).to.be.greaterThan(initBlance);
    }
  });
});
