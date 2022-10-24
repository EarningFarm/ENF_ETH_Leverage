const { ethers } = require("hardhat");
const { utils } = require("ethers");

const { curveCRVETH, ethUsdcPath, uniSwapV2Router } = require("../constants/constants");

const {
  usdcContract,
  controllerContract,
  curveExchange,
  uniV2Exchange,
  vaultContract,
} = require("../test/externalContracts");

const address = require("../scripts/address.json");
const vault = address["ENF Vault address"];
const controller = address["Controller address"];
const curve = address["Curve address"];
const uniV2 = address["Uniswap V2"];

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

  let curUSDC = await vaultContract(deployer, vault).totalAssets();
  console.log(`\tTotal USDC: ${toUSDC(curUSDC)}`);

  // harvest
  const index0 = await curveExchange(deployer, curve).getPathIndex(...curveCRVETH);
  console.log(`\tCRV-ETH Path index: ${index0}\n`);
  const index1 = await uniV2Exchange(deployer, uniV2).getPathIndex(uniSwapV2Router, ethUsdcPath);
  console.log(`\tETH-USDC Path index: ${index1}\n`);

  try {
    await controllerContract(deployer, controller).harvest([0], [index0, index1], [curve, uniV2], {
      gasLimit: 4000000,
    });
  } catch (err) {
    console.error(err);
  }

  curUSDC = await vaultContract(deployer, vault).totalAssets();
  console.log(`\tTotal USDC: ${toUSDC(curUSDC)}`);
}

main();
