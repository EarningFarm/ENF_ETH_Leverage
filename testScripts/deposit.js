const { ethers } = require("hardhat");
const { utils } = require("ethers");

const { usdcContract, depositApproverContract } = require("../test/externalContracts");
const address = require("../scripts/address.json");
const depositApprover = address["DepositApprover address"];

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

  const curUSDC = await usdcContract(deployer).balanceOf(deployer.address);
  console.log(`\tUSDC of Alice: ${toUSDC(curUSDC)}`);

  // Approve to deposit approver
  await usdcContract(deployer).approve(depositApprover, fromUSDC(1000));

  // Deposit
  await depositApproverContract(deployer, depositApprover).deposit(fromUSDC(1000));
}

main();
