const { ethers } = require("hardhat");
const { utils } = require("ethers");

const {
  wbtcContract,
  usdcContract,
  uniV2RouterContract,
  uniV2FactoryContract,
  alusdContract,
} = require("../test/externalContracts");
const constants = require("../constants/constants");

function toEth(num) {
  return utils.formatEther(num);
}

function toUSDC(num) {
  return utils.formatUnits(num, 6);
}
function toBTC(num) {
  return utils.formatUnits(num, 8);
}

function fromEth(num) {
  return utils.parseEther(num.toString());
}

function fromUSDC(num) {
  return utils.parseUnits(num.toString(), 6);
}

async function swapUSDC(caller) {
  await uniV2RouterContract(caller).swapExactETHForTokens(
    0,
    [constants.weth, constants.usdc],
    caller.address,
    100000000000,
    { value: fromEth(1) }
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();

  let curWBTC = await wbtcContract(deployer).balanceOf(deployer.address);
  console.log(`\tWBTC of Alice: ${toBTC(curWBTC)}`);

  const CurveMulti = await ethers.getContractFactory("CurveMultiTest");
  const curveMulti = await CurveMulti.deploy();

  await curveMulti.swap(fromEth(1), { value: fromEth(1) });

  curWBTC = await wbtcContract(deployer).balanceOf(deployer.address);
  console.log(`\tWBTC of Alice: ${toBTC(curWBTC)}`);

  let curUSDC = await usdcContract(deployer).balanceOf(deployer.address);
  console.log(`\tUSDC of Alice: ${toUSDC(curUSDC)}`);
  await curveMulti.swapUSDC(fromEth(1), { value: fromEth(1) });
  curUSDC = await usdcContract(deployer).balanceOf(deployer.address);
  console.log(`\tUSDC of Alice: ${toUSDC(curUSDC)}`);
}

main();
