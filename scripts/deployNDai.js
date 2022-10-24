const { ethers } = require("hardhat");
const { utils } = require("ethers");

const { curveCRVETH, ethUsdcPath, uniSwapV2Router } = require("../constants/constants");
const constants = require("../constants/constants");

const {
  usdcContract,
  controllerContract,
  curveExchange,
  uniV2Exchange,
  vaultContract,
} = require("../test/externalContracts");

const address = require("./address.json");
const { deployUpgradeable } = require("./utils");
const vault = address["ENF Vault address"];
const controller = address["Controller address"];
const exchange = address["Exchange address"];
const curve = address["Curve address"];
const uniV2 = address["Uniswap V2"];
const uniV3 = address["Uniswap V3"];
const balancer = address["Balancer Address"];
const balancerBatch = address["Balancer Address"];
const cDai = address["CDAI address"];

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

  // Deploying Exchange
  const exchange = await deployUpgradeable(deployer, "Exchange", [constants.weth, controller]);
  await exchange.listRouter(uniV2);
  await exchange.listRouter(uniV3);
  await exchange.listRouter(balancer);
  await exchange.listRouter(balancerBatch);
  await exchange.listRouter(curve);

  await exchange.setSwapCaller(cDai, true);

  await controllerContract(deployer, controller).setExchange(exchange.address);

  //   // Deploying Notional
  //   const cDai = await deployUpgradeable(deployer, "CDai", [
  //     constants.usdc,
  //     constants.dai,
  //     controller,
  //     constants.notionalProxy,
  //     constants.note,
  //     constants.nDai,
  //     constants.daiCurrencyId,
  //     exchange,
  //   ]);

  //   // Set DepositSlippage on ALUSD
  //   await cDai.setDepositSlippage(100);
  //   console.log("Deposit slippage set");

  //   // Set WithdrawSlippage on ALUSD
  //   await cDai.setWithdrawSlippage(100);
  //   console.log("Withdraw slippage set");

  //   await controllerContract(deployer, controller).registerSubStrategy(cDai.address, 100);

  // Register curve USDC-DAI
  // await curveExchange(deployer, curve).addCurvePool(...constants.curveUSDCDAI);
}

main();
