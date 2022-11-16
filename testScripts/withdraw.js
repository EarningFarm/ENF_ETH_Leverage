const { ethers } = require("hardhat");
const { utils } = require("ethers");

const { usdcContract, vaultContract } = require("../test/externalContracts");
const address = require("../scripts/address.json");
const vaultAddress = address["ENF Vault address"];

function toEth(num) {
  return utils.formatEther(num);
}

function toUSDC(num) {
  return utils.formatUnits(num, 6);
}

function fromEth(num) {
  return utils.parseEther(num.toString());
}

function fromUSDC(num) {
  return utils.parseUnits(num.toString(), 6);
}

async function main() {
  const [deployer] = await ethers.getSigners();

  // withdraw
  await vaultContract(deployer, vaultAddress).withdraw(fromEth(0.5), deployer.address);

  // Read Total Assets
  const total = await vault.totalAssets();
  console.log(`\tTotal ETH Balance: ${toEth(total)}`);
}

main();
