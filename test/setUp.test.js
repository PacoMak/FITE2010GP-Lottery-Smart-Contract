import hre from "hardhat";

export async function setupLotteryTest() {
  const [owner, player1, player2, player3] = await hre.ethers.getSigners();
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  const lottery = await Lottery.deploy();
  await lottery.waitForDeployment();
  const TICKET_PRICE = hre.ethers.parseEther("0.01");
  const DRAW_DURATION = 24 * 60 * 60;
  return {
    lottery,
    owner,
    player1,
    player2,
    player3,
    TICKET_PRICE,
    DRAW_DURATION,
  };
}
