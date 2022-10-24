const {
  usdc,
  crv,
  wbtc,
  crvETHCurvePool,
  uniSwapV2Router,
  uniSwapV2Factory,
  alusdLP,
  notionBatch,
  v3Quoter,
  uniSwapV3Router,
} = require("../constants/constants");

const usdcAbi = require("../abi/usdc.json");
const wbtcAbi = require("../abi/wbtc.json");
const crvAbi = require("../abi/crv.json");
const crvETHAbi = require("../abi/crvETHPool.json");
const alusdAbi = require("../abi/alusd.json");
const notionAbi = require("../abi/notionBatch.json");
const uniswapV2RouterAbi = require("../abi/uniswapV2Router.json");
const uniswapV3RouterAbi = require("../abi/uniswapV3Router.json");
const uniswapV2FactoryAbi = require("../abi/uniswapV2Factory.json");
const v3QuoterAbi = require("../abi/v3Quoter.json");
const { abi: depositApproverAbi } = require("../artifacts/contracts/core/DepositApprover.sol/DepositApprover.json");
const { abi: vaultAbi } = require("../artifacts/contracts/core/Vault.sol/EFVault.json");
const { abi: controllerAbi } = require("../artifacts/contracts/core/Controller.sol/Controller.json");
const { abi: curveAbi } = require("../artifacts/contracts/exchanges/Curve.sol/Curve.json");
const { abi: uniV2Abi } = require("../artifacts/contracts/exchanges/UniswapV2.sol/UniswapV2.json");
const { ethers } = require("hardhat");
const web3 = require("web3");

const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");

exports.usdcContract = (deployer) => {
  return new ethers.Contract(usdc, usdcAbi, deployer);
};

exports.wbtcContract = (deployer) => {
  return new ethers.Contract(wbtc, wbtcAbi, deployer);
};

exports.crvContract = (deployer) => {
  return new ethers.Contract(crv, crvAbi, deployer);
};

exports.crvETHContract = (deployer) => {
  return new ethers.Contract(crvETHCurvePool, crvETHAbi, deployer);
};

exports.alusdContract = (deployer) => {
  return new ethers.Contract(alusdLP, alusdAbi, deployer);
};

exports.uniV2RouterContract = (deployer) => {
  return new ethers.Contract(uniSwapV2Router, uniswapV2RouterAbi, deployer);
};

exports.uniV2FactoryContract = (deployer) => {
  return new ethers.Contract(uniSwapV2Factory, uniswapV2FactoryAbi, deployer);
};

exports.notionBatchContract = (deployer) => {
  return new ethers.Contract(notionBatch, notionAbi, deployer);
};

exports.depositApproverContract = (deployer, address) => {
  return new ethers.Contract(address, depositApproverAbi, deployer);
};

exports.controllerContract = (deployer, address) => {
  return new ethers.Contract(address, controllerAbi, deployer);
};

exports.vaultContract = (deployer, address) => {
  return new ethers.Contract(address, vaultAbi, deployer);
};

exports.curveExchange = (deployer, address) => {
  return new ethers.Contract(address, curveAbi, deployer);
};

exports.uniV2Exchange = (deployer, address) => {
  return new ethers.Contract(address, uniV2Abi, deployer);
};

exports.uniV3Contract = (deployer) => {
  return new ethers.Contract(uniSwapV3Router, uniswapV3RouterAbi, deployer);
};
exports.v3QuoterContract = () => {
  return new ethers.Contract(v3Quoter, v3QuoterAbi, provider);
};
