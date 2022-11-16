const { ethers, upgrades } = require("hardhat");
const { upgardeContract } = require("./utils");

async function main() {
  const [deployer] = await ethers.getSigners();

  const leverage = "0x12Df0C95D2c549bbBC96cf8FbA02cA4Bc541aFD9";

  await upgardeContract(deployer, leverage, "ETHLeverage");
}

main();
