import { expect } from "chai";
import hre from "hardhat";
import { setupLotteryTest } from "./setUp.test.js";

describe("revealSeed", function () {
  let lottery,
    owner,
    player1,
    player1Secret,
    player2,
    TICKET_PRICE,
    COMMIT_DURATION;

  beforeEach(async function () {
    ({
      lottery,
      owner,
      player1,
      player1Secret,
      player2,
      TICKET_PRICE,
      COMMIT_DURATION,
    } = await setupLotteryTest());
  });

  it("should revert if commit phase not ended", async function () {
    const numbers = [1, 2, 3, 4];
    const seed = Math.floor(Math.random() * 100);
    const seedCommitment = await lottery.calculateCommitHash(
      player1Secret,
      seed
    );

    await lottery
      .connect(player1)
      .buyTicket(numbers, seedCommitment, { value: TICKET_PRICE });

    await expect(
      lottery.connect(player1).revealSeed(0, player1Secret, seed)
    ).to.be.revertedWith("Not in reveal phase");

    await expect(lottery.connect(owner).startRevealPhase()).to.be.revertedWith(
      "Commit phase not ended"
    );
  });

  it("should revert if already in reveal phase", async function () {
    const numbers = [1, 2, 3, 4];
    const seed = Math.floor(Math.random() * 100);
    const seedCommitment = await lottery.calculateCommitHash(
      player1Secret,
      seed
    );

    await lottery
      .connect(player1)
      .buyTicket(numbers, seedCommitment, { value: TICKET_PRICE });

    await ethers.provider.send("evm_increaseTime", [COMMIT_DURATION]);
    await ethers.provider.send("evm_mine");
    await lottery.connect(owner).startRevealPhase();

    await expect(lottery.connect(owner).startRevealPhase()).to.be.revertedWith(
      "Already in reveal phase"
    );
  });

  it("should allow reveal seed", async function () {
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
    const ticket = await lottery.getTicketDetails(0, 0);
    expect(ticket.revealed === true);
  });
  it("should revert if already revealed", async function () {
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
    await expect(
      lottery.connect(player1).revealSeed(0, player1Secret, seed)
    ).to.be.revertedWith("Already revealed");
  });
  it("should revert if others reveal", async function () {
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
    await expect(
      lottery.connect(player2).revealSeed(0, player1Secret, seed)
    ).to.be.revertedWith("Not your ticket");
  });
});
