import hre from "hardhat";
import { expect } from "chai";
import { setupLotteryTest } from "./setUp.test.js";

describe("buyTicket", function () {
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

  it("should allow buying a valid ticket", async function () {
    const numbers = [1, 2, 3, 4];
    await expect(
      lottery.connect(player1).buyTicket(numbers, { value: TICKET_PRICE })
    )
      .to.emit(lottery, "TicketPurchased")
      .withArgs(0, player1.address, numbers);

    const ticketDetails = await lottery.getTicketDetails(0, 0);
    const currentPrizePool = await lottery.currentPrizePool();

    expect(ticketDetails.player).to.equal(player1.address);
    expect(ticketDetails.numbers).to.deep.equal(numbers);
    expect(currentPrizePool).to.equal(TICKET_PRICE);
  });

  it("should revert with incorrect ticket price", async function () {
    const numbers = [1, 2, 3, 4];
    await expect(
      lottery
        .connect(player1)
        .buyTicket(numbers, { value: hre.ethers.parseEther("0.02") })
    ).to.be.revertedWith("Incorrect ticket price");
    await expect(
      lottery
        .connect(player1)
        .buyTicket(numbers, { value: hre.ethers.parseEther("0") })
    ).to.be.revertedWith("Incorrect ticket price");
  });

  it("should revert with invalid numbers", async function () {
    await expect(
      lottery.connect(player1).buyTicket([1, 2, 3, 20], { value: TICKET_PRICE })
    ).to.be.revertedWith("Numbers must be between 1 and 15");

    await expect(
      lottery.connect(player1).buyTicket([0, 2, 3, 4], { value: TICKET_PRICE })
    ).to.be.revertedWith("Numbers must be between 1 and 15");

    await expect(
      lottery.connect(player1).buyTicket([1, 2, 3, 3], { value: TICKET_PRICE })
    ).to.be.revertedWith("Duplicate numbers not allowed");
  });

  it("should revert after draw period ends", async function () {
    await hre.ethers.provider.send("evm_increaseTime", [DRAW_DURATION]);
    await hre.ethers.provider.send("evm_mine");
    const numbers = [1, 2, 3, 4];
    await expect(
      lottery.connect(player1).buyTicket(numbers, { value: TICKET_PRICE })
    ).to.be.revertedWith("Draw has ended");
  });
});
