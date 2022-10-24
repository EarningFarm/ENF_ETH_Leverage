const { ethers } = require("hardhat");
const { utils } = require("ethers");

async function main() {
  const [deployer] = await ethers.getSigners();

  const ConvexTest = await ethers.getContractFactory("ConvexTest");
  const convexTest = await ConvexTest.deploy();

  const lpToken = "0x64eda51d3Ad40D56b9dFc5554E06F94e1Dd786Fd";
  const pid = await convexTest.getPid(lpToken);

  console.log("Pool Id: ", Number(pid), pid);
}

main();
