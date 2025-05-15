import { expect } from "chai";
import hre from "hardhat";
import { setupLotteryTest } from "./setUp.test.js";

describe("buyTicket", function () {
  let lottery, owner, player1, player1Secret, TICKET_PRICE, COMMIT_DURATION;

  beforeEach(async function () {
    ({ lottery, owner, player1, player1Secret, TICKET_PRICE, COMMIT_DURATION } =
      await setupLotteryTest());
  });

  it("should revert with incorrect ticket price", async function () {
    const numbers = [1, 2, 3, 4];
    const seed = Math.floor(Math.random() * 100);
    const seedCommitment = await lottery.calculateCommitHash(
      player1Secret,
      seed
    );
    await expect(
      lottery.connect(player1).buyTicket(numbers, seedCommitment, {
        value: hre.ethers.parseEther("0.02"),
      })
    ).to.be.revertedWith("Incorrect ticket price");

    await expect(
      lottery.connect(player1).buyTicket(numbers, seedCommitment, {
        value: hre.ethers.parseEther("0"),
      })
    ).to.be.revertedWith("Incorrect ticket price");
  });

  it("should revert with invalid numbers", async function () {
    const seed = Math.floor(Math.random() * 100);
    const seedCommitment = await lottery.calculateCommitHash(
      player1Secret,
      seed
    );

    await expect(
      lottery
        .connect(player1)
        .buyTicket([1, 2, 3, 20], seedCommitment, { value: TICKET_PRICE })
    ).to.be.revertedWith("Numbers must be between 1 and 15");

    await expect(
      lottery
        .connect(player1)
        .buyTicket([0, 2, 3, 4], seedCommitment, { value: TICKET_PRICE })
    ).to.be.revertedWith("Numbers must be between 1 and 15");

    await expect(
      lottery
        .connect(player1)
        .buyTicket([1, 2, 3, 3], seedCommitment, { value: TICKET_PRICE })
    ).to.be.revertedWith("Duplicate numbers not allowed");
  });

  it("should revert if not in commit phase", async function () {
    await hre.ethers.provider.send("evm_increaseTime", [COMMIT_DURATION]);
    await hre.ethers.provider.send("evm_mine");
    await lottery.connect(owner).startRevealPhase();

    const numbers = [1, 2, 3, 4];
    const seed = Math.floor(Math.random() * 100);
    const seedCommitment = await lottery.calculateCommitHash(
      player1Secret,
      seed
    );

    await expect(
      lottery
        .connect(player1)
        .buyTicket(numbers, seedCommitment, { value: TICKET_PRICE })
    ).to.be.revertedWith("Not in commit phase");
  });

  it("should allow buying a valid ticket with numbers and seed commitment", async function () {
    const numbers = [1, 2, 3, 4];

    const seed = Math.floor(Math.random() * 100);
    const seedCommitment = await lottery.calculateCommitHash(
      player1Secret,
      seed
    );

    await expect(
      lottery
        .connect(player1)
        .buyTicket(numbers, seedCommitment, { value: TICKET_PRICE })
    )
      .to.emit(lottery, "TicketPurchased")
      .withArgs(0, player1.address, numbers, seedCommitment);

    const ticketDetails = await lottery.getTicketDetails(0, 0);
    const currentPrizePool = await lottery.currentPrizePool();

    expect(ticketDetails.player).to.equal(player1.address);
    expect(ticketDetails.numbers).to.deep.equal(numbers);
    expect(ticketDetails.seedCommitment).to.equal(seedCommitment);
    expect(ticketDetails.revealed).to.be.false;
    expect(currentPrizePool).to.equal(TICKET_PRICE);
  });
});
