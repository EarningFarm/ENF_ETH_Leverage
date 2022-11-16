const { ethers } = require("hardhat");
const { utils } = require("ethers");

const { usdcContract, depositApproverContract, vaultContract } = require("../test/externalContracts");
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

  const vault = vaultContract(deployer, vaultAddress);
  await vault.deposit(fromEth(1), deployer.address, { value: fromEth(1) });

  // Read Total Assets
  const total = await vault.totalAssets();
  console.log(`\tTotal ETH Balance: ${toEth(total)}`);
}

main();
