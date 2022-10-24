const { ethers, waffle, network, upgrades } = require("hardhat");
const { expect, util } = require("chai");
const colors = require("colors");
const { utils } = require("ethers");

const { usdcContract, uniV2RouterContract, uniV2FactoryContract, alusdContract } = require("./externalContracts");

const {
  usdc,
  weth,
  convexBooster,
  alusdPid,
  alusdLP,
  curveAlusd,
  crv,
  uniSwapV2Router,
  uniSwapV3Router,
  curveCRVETH,
  balancerV2Vault,
  balancerETHToUSDCSwap,
  balancerNoteToETHSwap,
  balancerNoteToUSDCAssets,
  balancerNoteToUSDCPools,
  crvUsdcPath,
  crvEthPath,
  ethUsdcPath,
  univ3ETHUSDC,
  univ3CRVETH,
  univ3CRVUSDC,
  curve3ETHUSDC,
} = require("../constants/constants");

let vault, controller, alusd, depositApprover, exchange, uniV2, curve, uniV3, balancerBatch, curve3Pool;

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
  await uniV2RouterContract(caller).swapExactETHForTokensSupportingFeeOnTransferTokens(
    0,
    [weth, usdc],
    caller.address,
    10000000000000,
    { value: fromEth(100) }
  );
}

describe("ENF Vault test", async () => {
  before(async () => {
    [deployer, alice, bob, carol, david, evan, fiona, treasury] = await ethers.getSigners();

    // Deploy DepositApprover
    console.log("Deploying DepositApprover".green);
    const DepositApprover = await ethers.getContractFactory("DepositApprover");
    depositApprover = await DepositApprover.deploy(usdc);
    console.log(`DepositApprover deployed at: ${depositApprover.address}\n`);

    // Deploy Vault
    console.log("Deploying Vault".green);
    const Vault = await ethers.getContractFactory("EFVault");
    vault = await upgrades.deployProxy(Vault, [usdc, "ENF LP", "ENF"]);
    console.log(`Vault deployed at: ${vault.address}\n`);

    // Deploy Controller
    console.log("Deploying Controller".green);
    const Controller = await ethers.getContractFactory("Controller");
    controller = await upgrades.deployProxy(Controller, [vault.address, usdc, treasury.address, weth]);
    console.log(`Controller deployed at: ${controller.address}\n`);

    // Deploy Alusd
    console.log("Deploying ALUSD".green);
    const Alusd = await ethers.getContractFactory("Alusd");
    alusd = await upgrades.deployProxy(Alusd, [curveAlusd, alusdLP, controller.address, usdc, convexBooster, alusdPid]);
    console.log(`Alusd deployed at: ${alusd.address}\n`);

    // Deploy Exchange
    console.log("Deploying Exchange".green);
    const Exchange = await ethers.getContractFactory("Exchange");
    exchange = await upgrades.deployProxy(Exchange, [weth, controller.address]);

    // Deploy routers
    console.log("\nDeploying Uni V2 Router".green);
    const UniV2 = await ethers.getContractFactory("UniswapV2");
    uniV2 = await UniV2.deploy(weth, exchange.address);
    console.log("Uni V2 is deployed: ", uniV2.address);

    console.log("\nDeploying Uni V3 Router".green);
    const UniV3 = await ethers.getContractFactory("UniswapV3");
    uniV3 = await UniV3.deploy(uniSwapV3Router, exchange.address, weth);
    console.log("Uni V3 is deployed: ", uniV3.address);

    console.log("\nDeploying Balancer".green);
    const Balancer = await ethers.getContractFactory("BalancerV2");
    balancer = await Balancer.deploy(balancerV2Vault, exchange.address, weth);
    console.log("Balancer V2 is Deployed: ", balancer.address);

    console.log("\nDeploying Curve".green);
    const Curve = await ethers.getContractFactory("Curve");
    curve = await Curve.deploy(weth, exchange.address);
    console.log("Curve is deployed: ", curve.address);
    /**
     * Wiring Contracts with each other
     */

    // Set Vault on deposit approver
    await depositApprover.setVault(vault.address);
    console.log("Deposit Approver set Vault");

    // Set deposit approver to vault
    await vault.setDepositApprover(depositApprover.address);
    console.log("Vault set deposit approver");

    // Set Controller to vault
    await vault.setController(controller.address);
    console.log("Controller set Vault");

    // Set Exchange to Controller
    await controller.setExchange(exchange.address);

    /**
     * Set configuration
     */

    // Set DepositSlippage on ALUSD
    await alusd.setDepositSlippage(100);
    console.log("Deposit slippage set");

    // Set WithdrawSlippage on ALUSD
    await alusd.setWithdrawSlippage(100);
    console.log("Withdraw slippage set");

    // Set CRV token for harvest token
    await alusd.addRewardToken(crv);

    // Set CRV-USDC to exchange
    await uniV2.addPath(uniSwapV2Router, crvUsdcPath);

    // Set CRV-USDC to exchange
    await uniV2.addPath(uniSwapV2Router, crvEthPath);

    // Set CRV-USDC to exchange
    await uniV2.addPath(uniSwapV2Router, ethUsdcPath);

    // Set CRV-USDC to CURVE
    await curve.addCurvePool(...curveCRVETH);

    console.log("\nDeploying Balancer BatchSwap".green);
    const BalancerBatch = await ethers.getContractFactory("BalancerBatchV2");
    balancerBatch = await BalancerBatch.deploy(balancerV2Vault, exchange.address, weth);
    console.log("Balancer Batch V2 is Deployed: ", balancerBatch.address);

    // Set swaps on Balancer Batch
    await balancerBatch.addPath(balancerNoteToUSDCPools, balancerNoteToUSDCAssets);
    // Get CRV-USDC path index
    const index = await uniV2.getPathIndex(uniSwapV2Router, crvUsdcPath);
    console.log(`\tCRV-USDC Path index: ${index}\n`);

    console.log("\nDeploying Curve3Pool".green);
    const Curve3Pool = await ethers.getContractFactory("Curve3Pool");
    curve3Pool = await Curve3Pool.deploy(weth, exchange.address);
    console.log("Curve3Pool deployed: ", curve3Pool.address);

    await curve3Pool.addCurvePool(...curve3ETHUSDC);

    // Set CRV-USDC to exchange
    await uniV3.addPath(univ3CRVUSDC);
    await uniV3.addPath(univ3CRVETH);
    await uniV3.addPath(univ3ETHUSDC);

    // Set Routers to exchange
    await exchange.listRouter(uniV2.address);
    await exchange.listRouter(curve.address);
    await exchange.listRouter(balancerBatch.address);
    await exchange.listRouter(uniV3.address);
    await exchange.listRouter(curve3Pool.address);
  });

  it("Vault Deployed", async () => {
    const name = await vault.name();
    const symbol = await vault.symbol();
    const asset = await vault.asset();
    console.log("\tVault info: ", name, symbol, asset);
  });

  // Prepare USDC before
  it("Swap Ether to usdc in uniswap V2", async () => {
    // USDC current amt
    const curUSDC = await usdcContract(deployer).balanceOf(alice.address);
    console.log(`\tUSDC of Alice: ${toUSDC(curUSDC)}`);

    const pair = await uniV2FactoryContract(deployer).getPair(usdc, weth);
    console.log(`\tUSDC-ETH pair address: ${pair}`);

    await swapUSDC(alice);
    await swapUSDC(deployer);

    const newUSDC = await usdcContract(deployer).balanceOf(alice.address);
    console.log(`\tUSDC of Alice: ${toUSDC(newUSDC)}`);
  });

  // Register Alusd SS
  it("Register Alusd with non-owner will be reverted", async () => {
    await expect(controller.connect(alice).registerSubStrategy(alusd.address, 100)).to.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Register Alusd as 100 alloc point, check total alloc to be 100, ss length to be 1", async () => {
    await controller.connect(deployer).registerSubStrategy(alusd.address, 100);
    const totalAlloc = await controller.totalAllocPoint();
    const ssLength = await controller.subStrategyLength();

    console.log(`\tTotal Alloc: ${totalAlloc.toNumber()}, ssLength: ${ssLength.toNumber()}`);
    expect(totalAlloc).to.equal(100);
    expect(ssLength).to.equal(1);
  });

  it("Register Alusd will be reverted for duplication", async () => {
    await expect(controller.connect(deployer).registerSubStrategy(alusd.address, 100)).to.revertedWith(
      "ALREADY_REGISTERED"
    );
  });

  it("Deposit 1000 USDC", async () => {
    // Approve to deposit approver
    await usdcContract(alice).approve(depositApprover.address, fromUSDC(100000));

    // Deposit
    await depositApprover.connect(alice).deposit(fromUSDC(100000));

    // Read Total Assets
    const total = await vault.totalAssets();
    console.log(`\tTotal USDC Balance: ${toUSDC(total)}`);

    // Read ENF token Mint
    const enf = await vault.balanceOf(alice.address);
    console.log(`\tAlice ENF Balance: ${toEth(enf)}`);
  });

  ////////////////////////////////////////////////
  //                  HARVEST                   //
  ////////////////////////////////////////////////

  it("Harvest ALUSD with multi-router", async () => {
    // Get CRV-USDC path index
    const index0 = await curve.getPathIndex(...curveCRVETH);
    // const index0 = await uniV3.getPathIndex(univ3CRVUSDC);
    const index1 = await curve3Pool.getPathIndex(...curve3ETHUSDC);
    // const index1 = await uniV3.getPathIndex(univ3ETHUSDC);
    console.log(`\tCRV-ETH Path index: ${index0}\n`);
    console.log(`\tETH-USDC Path index: ${index1}\n`);

    await controller.harvest([0], [index0, index1], [curve.address, curve3Pool.address]);

    // Read Total Assets
    const total = await vault.totalAssets();
    console.log(`\tTotal USDC Balance: ${toUSDC(total)}\n`);
  });
});
