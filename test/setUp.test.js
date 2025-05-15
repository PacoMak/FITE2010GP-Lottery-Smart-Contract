import hre from "hardhat";

export async function setupLotteryTest() {
  const [owner, player1, player2, player3] = await hre.ethers.getSigners();
  const player1Secret = "player1secret";
  const player2Secret = "player2secret";
  const player3Secret = "player3secret";
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  const lottery = await Lottery.deploy();
  await lottery.waitForDeployment();
  const TICKET_PRICE = hre.ethers.parseEther("0.01");
  const COMMIT_DURATION = 12 * 60 * 60;
  const REVEAL_DURATION = 12 * 60 * 60;
  return {
    lottery,
    owner,
    player1,
    player1Secret,
    player2,
    player2Secret,
    player3,
    player3Secret,
    TICKET_PRICE,
    COMMIT_DURATION,
    REVEAL_DURATION,
  };
}
