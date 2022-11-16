const { ethers } = require("hardhat");
const fs = require("fs");
const { yellow, cyan } = require("colors");

const { deployContract, deployUpgradeable, verifyContract, verifyUpgradeable } = require("./utils");
const constants = require("../constants/constants");
const { treasury } = require("./config");

async function main() {
  const [deployer] = await ethers.getSigners();

  /////////////////////////////////////////
  //             DEPLOYING               //
  /////////////////////////////////////////

  console.log("\nDeploying Contracts\n".yellow);

  // Deploy Vault
  const vault = await deployUpgradeable(deployer, "EFVault", [constants.weth, "ENF ETH Leverage LP", "ENF_ETHLEV"]);
  // await verifyUpgradeable(vault.address);

  // Deploying Controller
  const controller = await deployUpgradeable(deployer, "Controller", [
    vault.address,
    constants.weth,
    treasury,
    constants.weth,
  ]);

  // const vault = { address: "0x5655c442227371267c165101048E4838a762675d" };
  // const controller = { address: "0xE8688D014194fd5d7acC3c17477fD6db62aDdeE9" };

  // Deploying SS
  const leverage = await deployUpgradeable(deployer, "ETHLeverage", [
    constants.weth,
    constants.stETH,
    constants.astETH,
    6750,
    constants.aave,
    controller.address,
    vault.address,
    treasury,
  ]);

  // Deploy Exchange
  const exchange = await deployUpgradeable(deployer, "ETHLeverExchange", [
    constants.weth,
    leverage.address,
    constants.curveSTETH,
    constants.stETH,
  ]);

  // Deploy Balance Loan
  const balancerLoan = await deployUpgradeable(deployer, "BalancerReceiver", [
    constants.balancerV2Vault,
    constants.balancerFee,
    leverage.address,
  ]);

  ///////////////////////////////////////////
  //           SET CONFIGURATION           //
  ///////////////////////////////////////////

  // Set controller to vault
  await vault.setController(controller.address);
  console.log("Controller set vault");

  await vault.setSubStrategy(leverage.address);
  console.log("vault set substrategy");

  /**
   * Substrategies configuration
   */
  await leverage.setDepositSlippage(100);
  await leverage.setWithdrawSlippage(100);
  console.log("Leverage configuration set");

  await leverage.setFlashLoanReceiver(balancerLoan.address);
  console.log("Balancer Flash loan set on Leverage");

  await leverage.setExchange(exchange.address);
  console.log("Exchange set on leverage");

  await controller.connect(deployer).registerSubStrategy(leverage.address, 100);
  totalAlloc = await controller.totalAllocPoint();
  ssLength = await controller.subStrategyLength();
  console.log(`\tTotal Alloc: ${totalAlloc.toNumber()}, ssLength: ${ssLength.toNumber()}`);

  // Output deployed address result
  const deployLog = [
    {
      Label: "ENF Vault address",
      Info: vault.address,
    },
    {
      Label: "Controller address",
      Info: controller.address,
    },
    {
      Label: "Leverage Exchange address",
      Info: exchange.address,
    },
    {
      Label: "Leverage address",
      Info: leverage.address,
    },
    {
      Label: "Balancer Loan address",
      Info: balancerLoan.address,
    },
  ];

  console.table(deployLog);

  // Save data to json
  const data = {};
  for (let i = 0; i < deployLog.length; i++) {
    data[deployLog[i].Label] = deployLog[i].Info;
  }
  fs.writeFileSync("./scripts/address.json", JSON.stringify(data));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
