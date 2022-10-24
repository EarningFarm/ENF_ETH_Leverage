const { ethers } = require("hardhat");
const { utils } = require("ethers");

const {
  usdcContract,
  uniV2RouterContract,
  uniV2FactoryContract,
  alusdContract,
  uniV3Contract,
  crvContract,
  v3QuoterContract,
} = require("../test/externalContracts");
const constants = require("../constants/constants");

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

async function swapUSDC(caller) {
  await uniV3Contract(caller).exactInputSingle(
    [constants.weth, constants.crv, 3000, caller.address, fromEth(1), 0, 0],
    { value: fromEth(1) }
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();

  let curUSDC = await crvContract(deployer).balanceOf(deployer.address);
  console.log(`\tCRV of Alice: ${toEth(curUSDC)}`);

  // await swapUSDC(deployer);

  const UniV3Test = await ethers.getContractFactory("UniV3Test");
  const uniV3 = await UniV3Test.deploy();

  // await crvContract(deployer).approve(uniV3.address, fromEth(10000));

  await uniV3.swap(fromEth(1), { value: fromEth(1) });

  curUSDC = await crvContract(deployer).balanceOf(deployer.address);
  console.log(`\tCRV of Alice: ${toEth(curUSDC)}`);

  // let encoded = {
  //   tokenIn: constants.crv,
  //   tokenOut: constants.usdc,
  //   fee: 3000,
  //   amountIn: fromEth(1),
  //   sqrtPriceLimitX96: "0",
  // };
  // let myQuote = await v3QuoterContract().callStatic.quoteExactInputSingle([
  //   constants.weth,
  //   constants.usdc,
  //   fromEth(1),
  //   3000,
  //   0,
  // ]);

  // console.log("My quote: ", myQuote);
  // const decoder = new ethers.utils.AbiCoder();
  // const decodeParams = [];
  // let event = await myQuote.wait();
  // console.log("Quote: ", myQuote);
}

main();
