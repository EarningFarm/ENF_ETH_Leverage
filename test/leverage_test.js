const { ethers, waffle, network, upgrades } = require("hardhat");
const { expect, util } = require("chai");
const colors = require("colors");
const { utils } = require("ethers");

const { stETHContract } = require("./externalContracts");

const {
  weth,
  astETH,
  stETH,
  aave,
  balancerV2Vault,
  balancerFee,
  zeroAddress,
  curveSTETH,
} = require("../constants/constants");

let vault, controller, leverage;

function toEth(num) {
  return utils.formatEther(num);
}

function fromEth(num) {
  return utils.parseEther(num.toString());
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

    // Deploy Vault
    console.log("Deploying Vault".green);
    const Vault = await ethers.getContractFactory("EFVault");
    vault = await upgrades.deployProxy(Vault, [weth, "ENF LP", "ENF"]);
    console.log(`Vault deployed at: ${vault.address}\n`);

    // Deploy Controller
    console.log("Deploying Controller".green);
    const Controller = await ethers.getContractFactory("Controller");
    controller = await upgrades.deployProxy(Controller, [vault.address, weth, treasury.address, weth]);
    console.log(`Controller deployed at: ${controller.address}\n`);

    // Deploy Leverage SS
    console.log("Deploying Leverage SS".green);
    const Leverage = await ethers.getContractFactory("ETHLeverage");
    leverage = await upgrades.deployProxy(Leverage, [
      weth,
      stETH,
      astETH,
      6750,
      aave,
      controller.address,
      vault.address,
      treasury.address,
    ]);
    console.log(`ETH Leverage deployed at: ${leverage.address}\n`);

    // Deploy Leverage Exchange
    const Exchange = await ethers.getContractFactory("ETHLeverExchange");
    const exchange = await upgrades.deployProxy(Exchange, [weth, leverage.address, curveSTETH, stETH]);
    console.log(`Leverage Exchange deployed at ${exchange.address}`);

    const BalancerLoan = await ethers.getContractFactory("BalancerReceiver");
    const balancerLoan = await upgrades.deployProxy(BalancerLoan, [balancerV2Vault, balancerFee, leverage.address]);
    console.log(`BalancerLoan deployed at ${balancerLoan.address}`);

    // Set Controller to vault
    await vault.setController(controller.address);
    console.log("Controller set Vault");

    await vault.setSubStrategy(leverage.address);

    /**
     * Set configuration
     */

    // Set DepositSlippage on ALUSD
    await leverage.setDepositSlippage(100);
    console.log("Deposit slippage set");

    // Set WithdrawSlippage on ALUSD
    await leverage.setWithdrawSlippage(100);
    console.log("Withdraw slippage set");

    await leverage.setFlashLoanReceiver(balancerLoan.address);
    console.log("Balancer Flash loan set on Leverage");

    await leverage.setExchange(exchange.address);
    console.log("Exchange set on leverage");
  });

  it("Vault Deployed", async () => {
    const name = await vault.name();
    const symbol = await vault.symbol();
    const asset = await vault.asset();
    console.log("\tVault info: ", name, symbol, asset);
  });

  // Register Leverage SS
  it("Register Leverage with non-owner will be reverted", async () => {
    await expect(controller.connect(alice).registerSubStrategy(leverage.address, 100)).to.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Register Alusd as 100 alloc point, check total alloc to be 100, ss length to be 1", async () => {
    await controller.connect(deployer).registerSubStrategy(leverage.address, 100);
    const totalAlloc = await controller.totalAllocPoint();
    const ssLength = await controller.subStrategyLength();

    console.log(`\tTotal Alloc: ${totalAlloc.toNumber()}, ssLength: ${ssLength.toNumber()}`);
    expect(totalAlloc).to.equal(100);
    expect(ssLength).to.equal(1);
  });

  it("Register Alusd will be reverted for duplication", async () => {
    await expect(controller.connect(deployer).registerSubStrategy(leverage.address, 100)).to.revertedWith(
      "ALREADY_REGISTERED"
    );
  });

  it("Deposit 1 ETH", async () => {
    await vault.connect(alice).deposit(fromEth(1), alice.address, { value: fromEth(1) });

    // Read Total Assets
    const total = await vault.totalAssets();
    console.log(`\tTotal ETH Balance: ${toEth(total)}`);

    // Read ENF token Mint
    const enf = await vault.balanceOf(alice.address);
    console.log(`\tAlice ENF Balance: ${toEth(enf)}`);
  });

  it("Withdraw 1 ETH", async () => {
    await vault.connect(alice).withdraw(fromEth(0.5), alice.address);

    // Read Total Assets
    const total = await vault.totalAssets();
    console.log(`\tTotal ETH Balance: ${toEth(total)}`);

    // Read ENF token Mint
    const enf = await vault.balanceOf(alice.address);
    console.log(`\tAlice ENF Balance: ${toEth(enf)}`);
  });

  it("Owner Deposit", async () => {
    // Read Total Assets
    let total = await vault.totalAssets();
    console.log(`\tTotal ETH Balance: ${toEth(total)}`);

    await leverage.ownerDeposit(fromEth(1), { value: fromEth(1) });

    // Read Total Assets
    total = await vault.totalAssets();
    console.log(`\tTotal ETH Balance: ${toEth(total)}`);
  });

  // it("Raise Actual LTV", async () => {
  //   await expect(leverage.raiseLTV(7000)).to.be.revertedWith("NO_NEED_TO_RAISE");
  // });

  // it("Reduce Actual LTV", async () => {
  //   await leverage.reduceLTV();
  // });

  it("Emergency Withdraw", async () => {
    const oldBal = await stETHContract(deployer).balanceOf(deployer.address);
    console.log("\tOld Bal: ", toEth(oldBal));
    await leverage.emergencyWithdraw();
    // Read Total Assets
    const total = await vault.totalAssets();
    console.log(`\tTotal ETH Balance: ${toEth(total)}`);
    const newBal = await stETHContract(deployer).balanceOf(deployer.address);
    console.log("\tNew Bal: ", toEth(newBal));
  });

  // it("Deposit 1 ETH", async () => {
  //   await vault.connect(alice).deposit(fromEth(1), alice.address, { value: fromEth(1) });

  //   // Read Total Assets
  //   const total = await vault.totalAssets();
  //   console.log(`\tTotal ETH Balance: ${toEth(total)}`);

  //   // Read ENF token Mint
  //   const enf = await vault.balanceOf(alice.address);
  //   console.log(`\tAlice ENF Balance: ${toEth(enf)}`);
  // });

  it("Owner Deposit", async () => {
    // Read Total Assets
    let total = await vault.totalAssets();
    console.log(`\tTotal ETH Balance: ${toEth(total)}`);

    await leverage.ownerDeposit(fromEth(1), { value: fromEth(1) });

    // Read Total Assets
    total = await vault.totalAssets();
    console.log(`\tTotal ETH Balance: ${toEth(total)}`);
  });
});
