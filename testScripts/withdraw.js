const { ethers } = require("hardhat");
const { utils } = require("ethers");

const { usdcContract, vaultContract } = require("../test/externalContracts");
const vault = "0x0F527785e39B22911946feDf580d87a4E00465f0";

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

  let curUSDC = await usdcContract(deployer).balanceOf(deployer.address);
  console.log(`\tUSDC of Alice: ${toUSDC(curUSDC)}`);

  // withdraw
  await vaultContract(deployer, vault).withdraw(fromUSDC(1), deployer.address);

  curUSDC = await usdcContract(deployer).balanceOf(deployer.address);
  console.log(`\tUSDC of Alice: ${toUSDC(curUSDC)}`);
}

main();
