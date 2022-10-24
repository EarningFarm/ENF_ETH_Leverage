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
  lusdPid,
  lusdLP,
  curveLusd,
  aavePid,
  curveAave,
  aaveLP,
  balancerETHToUSDCSwap,
  balancerNoteToETHSwap,
  balancerNoteToUSDCAssets,
  balancerNoteToUSDCPools,
  compoundPid,
  curveCompound,
  compoundLP,
  triPid,
  curveTri,
  triLP,
  crv,
  uniSwapV2Router,
  uniSwapV3Router,
  balancerV2Vault,
  crvUsdcPath,
  crvEthPath,
  ethUsdcPath,
  notionalProxy,
  note,
  nusdc,
  usdcCurrencyId,
  zeroAddress,
} = require("../constants/constants");

let vault,
  controller,
  alusd,
  lusd,
  aave,
  compound,
  tri,
  cusdc,
  depositApprover,
  exchange,
  uniV2,
  uniV3,
  balancer,
  balancerBatch;

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
  await uniV2RouterContract(caller).swapExactETHForTokens(0, [weth, usdc], caller.address, 100000000000, {
    value: fromEth(1),
  });
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

    // Deploy Lusd
    console.log("Deploying LUSD".green);
    const Lusd = await ethers.getContractFactory("Lusd");
    lusd = await upgrades.deployProxy(Lusd, [curveLusd, lusdLP, controller.address, usdc, convexBooster, lusdPid]);
    console.log(`Lusd deployed at: ${lusd.address}\n`);

    // Deploy Aave
    console.log("Deploying AAVE".green);
    const Aave = await ethers.getContractFactory("Aave");
    aave = await upgrades.deployProxy(Aave, [curveAave, aaveLP, controller.address, usdc, convexBooster, aavePid]);
    console.log(`Aave deployed at: ${aave.address}\n`);

    // Deploy Compound
    console.log("Deploying COMPOUND".green);
    const Compound = await ethers.getContractFactory("CompoundV3");
    compound = await upgrades.deployProxy(Compound, [
      curveCompound,
      compoundLP,
      controller.address,
      usdc,
      convexBooster,
      compoundPid,
    ]);
    console.log(`Compound deployed at: ${compound.address}\n`);

    // Deploy Tri
    console.log("Deploying TRI".green);
    const Tri = await ethers.getContractFactory("Tri");
    tri = await upgrades.deployProxy(Tri, [curveTri, triLP, controller.address, usdc, convexBooster, triPid]);
    console.log(`Tri deployed at: ${tri.address}\n`);

    // Deploy Notional
    console.log("Deploying Notional CUSDC".green);
    const CUSDC = await ethers.getContractFactory("Cusdc");
    cusdc = await upgrades.deployProxy(CUSDC, [usdc, controller.address, notionalProxy, note, nusdc, usdcCurrencyId]);
    console.log("CUSDC deployed: ", cusdc.address);

    // Deploy Exchange
    console.log("Deploying Exchange".green);
    const Exchange = await ethers.getContractFactory("Exchange");
    exchange = await Exchange.deploy(weth, controller.address);

    // Deploy routers
    console.log("\nDeploying Uni V2 Router".green);
    const UniV2 = await ethers.getContractFactory("UniswapV2");
    uniV2 = await UniV2.deploy(weth, exchange.address);
    console.log("Uni V2 is deployed: ", uniV2.address);

    console.log("\nDeploying Uni V3 Router".green);
    const UniV3 = await ethers.getContractFactory("UniswapV3");
    uniV3 = await UniV3.deploy(uniSwapV3Router, exchange.address);
    console.log("Uni V3 is deployed: ", uniV3.address);

    console.log("\nDeploying Balancer".green);
    const Balancer = await ethers.getContractFactory("BalancerV2");
    balancer = await Balancer.deploy(balancerV2Vault, exchange.address, weth);
    console.log("Balancer V2 is Deployed: ", balancer.address);

    console.log("\nDeploying Balancer BatchSwap".green);
    const BalancerBatch = await ethers.getContractFactory("BalancerBatchV2");
    balancerBatch = await BalancerBatch.deploy(balancerV2Vault, exchange.address, weth);
    console.log("Balancer Batch V2 is Deployed: ", balancerBatch.address);

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
    console.log("Alusd Deposit slippage set");

    // Set WithdrawSlippage on ALUSD
    await alusd.setWithdrawSlippage(100);
    console.log("Alusd Withdraw slippage set");

    // Set CRV token for harvest token
    await alusd.addRewardToken(crv);

    // Set DepositSlippage on LUSD
    await lusd.setDepositSlippage(100);
    console.log("Lusd Deposit slippage set");

    // Set WithdrawSlippage on LUSD
    await lusd.setWithdrawSlippage(100);
    console.log("Lusd Withdraw slippage set");

    // Set CRV token for harvest token
    await lusd.addRewardToken(crv);

    // Set DepositSlippage on AAVE
    await aave.setDepositSlippage(100);
    console.log("Aave Deposit slippage set");

    // Set WithdrawSlippage on AAVE
    await aave.setWithdrawSlippage(100);
    console.log("Aave Withdraw slippage set");

    // Set CRV token for harvest token
    await aave.addRewardToken(crv);

    // Set DepositSlippage on COMPOUND
    await compound.setDepositSlippage(100);
    console.log("Compound Deposit slippage set");

    // Set WithdrawSlippage on COMPOUND
    await compound.setWithdrawSlippage(100);
    console.log("Compound Withdraw slippage set");

    // Set CRV token for harvest token
    await compound.addRewardToken(crv);

    // Set DepositSlippage on TRI
    await tri.setDepositSlippage(100);
    console.log("Tri Deposit slippage set");

    // Set WithdrawSlippage on TRI
    await tri.setWithdrawSlippage(100);
    console.log("Tri Withdraw slippage set");

    // Set CRV token for harvest token
    await tri.addRewardToken(crv);

    // Set DepositSlippage on CUSDC
    await cusdc.setDepositSlippage(100);
    console.log("CUSDC Deposit slippage set");

    // Set WithdrawSlippage on CUSDC
    await cusdc.setWithdrawSlippage(100);
    console.log("CUSDC Withdraw slippage set");

    // Set CRV-USDC to exchange
    await uniV2.addPath(uniSwapV2Router, ethUsdcPath);

    // Set CRV-USDC to exchange
    await uniV2.addPath(uniSwapV2Router, crvUsdcPath);

    // Set CRV-USDC to exchange
    await uniV2.addPath(uniSwapV2Router, crvEthPath);

    // Set swaps on Balancer Batch
    await balancerBatch.addPath(balancerNoteToUSDCPools, balancerNoteToUSDCAssets);

    // Set swaps on Balancer
    await balancer.addPath(balancerNoteToETHSwap);
    await balancer.addPath(balancerETHToUSDCSwap);

    // Get CRV-USDC path index
    const index = await uniV2.getPathIndex(uniSwapV2Router, crvUsdcPath);
    console.log(`\tCRV-USDC Path index: ${index}\n`);
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

  it("Register Lusd as 50 alloc point, check total alloc to be 150, ss length to be 2", async () => {
    await controller.connect(deployer).registerSubStrategy(lusd.address, 50);
    const totalAlloc = await controller.totalAllocPoint();
    const ssLength = await controller.subStrategyLength();

    console.log(`\tTotal Alloc: ${totalAlloc.toNumber()}, ssLength: ${ssLength.toNumber()}`);
    expect(totalAlloc).to.equal(150);
    expect(ssLength).to.equal(2);
  });

  // it("Register aave as 50 alloc point, check total alloc to be 200, ss length to be 3", async () => {
  //     await controller.connect(deployer).registerSubStrategy(aave.address, 50)
  //     const totalAlloc = await controller.totalAllocPoint()
  //     const ssLength = await controller.subStrategyLength()

  //     console.log(`\tTotal Alloc: ${totalAlloc.toNumber()}, ssLength: ${ssLength.toNumber()}`)
  //     expect(totalAlloc).to.equal(200)
  //     expect(ssLength).to.equal(3)
  // })

  // it("Register compound as 100 alloc point, check total alloc to be 300, ss length to be 4", async () => {
  //     await controller.connect(deployer).registerSubStrategy(compound.address, 100)
  //     const totalAlloc = await controller.totalAllocPoint()
  //     const ssLength = await controller.subStrategyLength()

  //     console.log(`\tTotal Alloc: ${totalAlloc.toNumber()}, ssLength: ${ssLength.toNumber()}`)
  //     expect(totalAlloc).to.equal(300)
  //     expect(ssLength).to.equal(4)
  // })

  // it("Register Tri as 30 alloc point, check total alloc to be 330, ss length to be 5", async () => {
  //     await controller.connect(deployer).registerSubStrategy(tri.address, 30)
  //     const totalAlloc = await controller.totalAllocPoint()
  //     const ssLength = await controller.subStrategyLength()

  //     console.log(`\tTotal Alloc: ${totalAlloc.toNumber()}, ssLength: ${ssLength.toNumber()}`)
  //     expect(totalAlloc).to.equal(330)
  //     expect(ssLength).to.equal(5)
  // })

  it("Register CUSDC as 70 alloc point, check total alloc to be 400, ss length to be 6", async () => {
    await controller.connect(deployer).registerSubStrategy(cusdc.address, 70);
    const totalAlloc = await controller.totalAllocPoint();
    const ssLength = await controller.subStrategyLength();

    console.log(`\tTotal Alloc: ${totalAlloc.toNumber()}, ssLength: ${ssLength.toNumber()}`);
    // expect(totalAlloc).to.equal(400)
    // expect(ssLength).to.equal(6)
  });

  ///////////////////////////////////////////////////
  //                 DEPOSIT                       //
  ///////////////////////////////////////////////////
  it("Deposit 100 USDC", async () => {
    // Approve to deposit approver
    await usdcContract(alice).approve(depositApprover.address, fromUSDC(100));

    // Deposit
    await depositApprover.connect(alice).deposit(fromUSDC(100));

    // Read Total Assets
    const total = await vault.totalAssets();
    console.log(`\tTotal USDC Balance: ${toUSDC(total)}`);

    // Read ENF token Mint
    const enf = await vault.balanceOf(alice.address);
    console.log(`\tAlice ENF Balance: ${toEth(enf)}`);
  });

  ///////////////////////////////////////////////////
  //                WITHDRAW                       //
  ///////////////////////////////////////////////////
  it("Withdraw 90 USDC", async () => {
    await vault.connect(alice).withdraw(fromUSDC(90), alice.address);
    // Read Total Assets
    const total = await vault.totalAssets();
    console.log(`\tTotal USDC Balance: ${toUSDC(total)}`);

    // Read ENF token Mint
    const enf = await vault.balanceOf(alice.address);
    console.log(`\tAlice ENF Balance: ${toEth(enf)}`);
  });

  it("Withdraw 10 USDC will be reverted", async () => {
    await expect(vault.connect(alice).withdraw(fromUSDC(10), alice.address)).to.revertedWith("EXCEED_TOTAL_DEPOSIT");
  });

  //////////////////////////////////////////////////
  //               DEPOSIT REVERT CHECK           //
  //////////////////////////////////////////////////
  it("Deposit will be reverted since ZERO asset", async () => {
    // Deposit
    await expect(depositApprover.connect(alice).deposit(fromUSDC(0))).to.revertedWith("ZERO_ASSETS");
  });

  it("Deposit will be reverted since Insufficient allowance", async () => {
    // Approve to deposit approver
    await usdcContract(alice).approve(depositApprover.address, fromUSDC(100));

    // Deposit
    await expect(depositApprover.connect(alice).deposit(fromUSDC(1000))).to.revertedWith("INSUFFICIENT_ALLOWANCE");
  });

  it("Deposit will be reverted since Insufficient balance", async () => {
    // Approve to deposit approver
    await usdcContract(alice).approve(depositApprover.address, fromUSDC(100000));

    // Deposit
    await expect(depositApprover.connect(alice).deposit(fromUSDC(100000))).to.revertedWith("INSUFFICIENT_AMOUNT");
  });

  it("Deposit 1000 USDC", async () => {
    // Approve to deposit approver
    await usdcContract(alice).approve(depositApprover.address, fromUSDC(1000));

    // Deposit
    await depositApprover.connect(alice).deposit(fromUSDC(1000));

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

  // it("Pass Time and block number", async () => {
  //     await network.provider.send("evm_increaseTime", [3600 * 24 * 60]);
  //     await network.provider.send("evm_mine");
  //     await network.provider.send("evm_mine");
  //     await network.provider.send("evm_mine");
  // })

  // it("Harvest ALUSD", async () => {
  //     // Get CRV-USDC path index
  //     const index = await uniV2.getPathIndex(uniSwapV2Router, crvUsdcPath)
  //     console.log(`\tCRV-USDC Path index: ${index}\n`)

  //     await controller.harvest([0], [index], [uniV2.address])

  //     // Read Total Assets
  //     const total = await vault.totalAssets()
  //     console.log(`\tTotal USDC Balance: ${toUSDC(total)}\n`)
  // })

  // it("Pass Time and block number", async () => {
  //     await network.provider.send("evm_increaseTime", [3600 * 1 * 60]);
  //     await network.provider.send("evm_mine");
  // })

  // it("Harvest ALUSD", async () => {
  //     // Get CRV-USDC path index
  //     const index = await uniV2.getPathIndex(uniSwapV2Router, crvUsdcPath)
  //     console.log(`\tCRV-USDC Path index: ${index}\n`)

  //     await controller.harvest([0], [index], [uniV2.address])

  //     // Read Total Assets
  //     const total = await vault.totalAssets()
  //     console.log(`\tTotal USDC Balance: ${toUSDC(total)}\n`)
  // })

  // it("Harvest LUSD", async () => {
  //     // Get CRV-USDC path index
  //     const index = await uniV2.getPathIndex(uniSwapV2Router, crvUsdcPath)
  //     console.log(`\tCRV-USDC Path index: ${index}\n`)

  //     await controller.harvest([1], [index], [uniV2.address])

  //     // Read Total Assets
  //     const total = await vault.totalAssets()
  //     console.log(`\tTotal USDC Balance: ${toUSDC(total)}\n`)
  // })

  // it("Pass Time and block number", async () => {
  //     await network.provider.send("evm_increaseTime", [3600 * 1 * 60]);
  //     await network.provider.send("evm_mine");
  // })

  // it("Harvest ALUSD, and LUSD", async () => {
  //     // Get CRV-USDC path index
  //     const index0 = await uniV2.getPathIndex(uniSwapV2Router, crvEthPath)
  //     const index1 = await uniV2.getPathIndex(uniSwapV2Router, ethUsdcPath)
  //     console.log(`\tCRV-ETH Path index: ${index0}\n`)

  //     await controller.harvest([0, 1], [index0, index1], [uniV2.address, uniV2.address])

  //     // Read Total Assets
  //     const total = await vault.totalAssets()
  //     console.log(`\tTotal USDC Balance: ${toUSDC(total)}\n`)
  // })

  // it("Pass Time and block number", async () => {
  //     await network.provider.send("evm_increaseTime", [3600 * 24 * 1]);
  //     await network.provider.send("evm_mine");
  // })

  // it("Harvest CUSDC", async () => {
  //     // Get NOTE-USDC path index
  //     const index = await balancerBatch.getPathIndex(balancerNoteToUSDCAssets)
  //     console.log(`\tNOTE-USDC Path index: ${index}\n`)

  //     await controller.harvest([2], [index], [balancerBatch.address])

  //     // Read Total Assets
  //     const total = await vault.totalAssets()
  //     console.log(`\tTotal USDC Balance: ${toUSDC(total)}\n`)
  // })

  ////////////////////////////////////////////////
  //              EMERGENCY WITHDRAW            //
  ////////////////////////////////////////////////
  it("Emergency Withdraw by non-owner will be reverted", async () => {
    await expect(alusd.connect(alice).emergencyWithdraw()).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Emergency Withdraw", async () => {
    await alusd.emergencyWithdraw();
  });

  // it("Get LP withdrawn", async () => {
  //     const lpBal = await alusdContract(alice).balanceOf(deployer.address)
  //     console.log(`\tAlusd LP Withdrawn: ${toEth(lpBal)}`)
  // })

  /////////////////////////////////////////////////
  //               OWNER DEPOSIT                 //
  /////////////////////////////////////////////////
  it("Owner deposit will be reverted", async () => {
    await expect(alusd.connect(alice).ownerDeposit(fromUSDC(100))).to.revertedWith("Ownable: caller is not the owner");
  });

  it("Owner Deposit", async () => {
    // Approve to deposit approver
    await usdcContract(deployer).approve(alusd.address, fromUSDC(500));
    await usdcContract(deployer).approve(lusd.address, fromUSDC(500));
    await usdcContract(deployer).approve(cusdc.address, fromUSDC(500));

    await alusd.connect(deployer).ownerDeposit(fromUSDC(500));
    await lusd.connect(deployer).ownerDeposit(fromUSDC(500));
    await cusdc.connect(deployer).ownerDeposit(fromUSDC(500));

    // Read Total Assets
    let total = await alusd.totalAssets();
    console.log(`\n\tTotal ALUSD USDC Balance: ${toUSDC(total)}`);
    total = await lusd.totalAssets();
    console.log(`\n\tTotal LUSD USDC Balance: ${toUSDC(total)}`);
    total = await cusdc.totalAssets();
    console.log(`\n\tTotal CUSD USDC Balance: ${toUSDC(total)}`);
  });

  /////////////////////////////////////////////
  //               MOVE FUNDS                //
  /////////////////////////////////////////////
  it("Owner move funds from ALUSD to LUSD", async () => {
    await controller.moveFund(0, 1, fromUSDC(100));

    // Read Total Assets
    let total = await alusd.totalAssets();
    console.log(`\n\tTotal ALUSD USDC Balance: ${toUSDC(total)}`);
    total = await lusd.totalAssets();
    console.log(`\n\tTotal LUSD USDC Balance: ${toUSDC(total)}`);
  });

  it("Owner move All funds from ALUSD to CUSDC", async () => {
    // Read Total Assets
    let total = await cusdc.totalAssets();
    console.log(`\n\tTotal CUSDC USDC Balance: ${toUSDC(total)}`);
    total = await alusd.totalAssets();
    console.log(`\n\tTotal ALUSD USDC Balance: ${toUSDC(total)}`);

    await controller.moveFund(0, 2, total);

    // Read Total Assets
    total = await alusd.totalAssets();
    console.log(`\n\tTotal ALUSD USDC Balance: ${toUSDC(total)}`);
    total = await lusd.totalAssets();
    console.log(`\n\tTotal LUSD USDC Balance: ${toUSDC(total)}`);
    total = await cusdc.totalAssets();
    console.log(`\n\tTotal CUSDC USDC Balance: ${toUSDC(total)}`);
  });

  it("Owner move funds from ALUSD to CUSDC will be reverted", async () => {
    await expect(controller.moveFund(0, 2, fromUSDC(100))).to.revertedWith("NOT_WITHDRAWABLE_AMOUNT_FROM");
  });

  //////////////////////////////////////
  //      SYSTEM PAUSE/RESUME         //
  //////////////////////////////////////

  it("Pause Vault will be reverted since ownership", async () => {
    await expect(vault.connect(alice).pause()).to.revertedWith("Ownable: caller is not the owner");
  });

  it("Pause vault", async () => {
    await vault.pause();
    expect(await vault.paused()).to.equal(true);
  });

  it("Deposit will be reverted since pause", async () => {
    // Approve to deposit approver
    await usdcContract(alice).approve(depositApprover.address, fromUSDC(1000));

    // Deposit
    await expect(depositApprover.connect(alice).deposit(fromUSDC(1000))).to.revertedWith("PAUSED");
  });

  it("Pause vault", async () => {
    await vault.resume();
    expect(await vault.paused()).to.equal(false);
  });

  /////////////////////////////////////
  //       AUXILIARY FUNCITON        //
  /////////////////////////////////////

  it("Set vault on deposit Approver will be reverted with ownership", async () => {
    await expect(depositApprover.connect(alice).setVault(vault.address)).to.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Set vault on deposit Approver will be reverted with zero address", async () => {
    await expect(depositApprover.setVault(zeroAddress)).to.revertedWith("ZERO_ADDRESS");
  });

  it("Vault set MaxDeposit", async () => {
    await vault.setMaxDeposit(fromUSDC(100));

    expect(await vault.maxDeposit()).to.equal(fromUSDC(100));
  });

  it("Deposit 101 Will be reverted since max check", async () => {
    // Approve to deposit approver
    await usdcContract(alice).approve(depositApprover.address, fromUSDC(101));

    // Deposit
    await expect(depositApprover.connect(alice).deposit(fromUSDC(101))).to.revertedWith("EXCEED_ONE_TIME_MAX_DEPOSIT");
  });

  it("Vault set MaxWithdraw", async () => {
    await vault.setMaxWithdraw(fromUSDC(1000));

    expect(await vault.maxWithdraw()).to.equal(fromUSDC(1000));
  });

  it("Withdraw 101 Will be reverted since max check", async () => {
    // withdraw
    await expect(vault.connect(alice).withdraw(fromUSDC(1001), alice.address)).to.revertedWith(
      "EXCEED_ONE_TIME_MAX_WITHDRAW"
    );
  });

  ///////////////////////////////////////
  //    CONTROLLER WITHDRAW CHECK      //
  ///////////////////////////////////////

  it("COntroller set APY Sort will be reverted since length mismatching", async () => {
    await expect(controller.setAPYSort([1, 0])).to.revertedWith("INVALID_APY_SORT");
  });

  it("COntroller set APY Sort ", async () => {
    await controller.setAPYSort([1, 0, 2]);
  });

  it("Withdraw 100 will be withdrawn from LUSD", async () => {
    await vault.connect(alice).withdraw(fromUSDC(100), alice.address);
    // Read Total Assets
    let total = await vault.totalAssets();
    console.log(`\tTotal USDC Balance: ${toUSDC(total)}`);

    // Read ENF token Mint
    const enf = await vault.balanceOf(alice.address);
    console.log(`\tAlice ENF Balance: ${toEth(enf)}`);

    // Read Total Assets
    total = await alusd.totalAssets();
    console.log(`\n\tTotal ALUSD USDC Balance: ${toUSDC(total)}`);
    total = await lusd.totalAssets();
    console.log(`\n\tTotal LUSD USDC Balance: ${toUSDC(total)}`);
    total = await cusdc.totalAssets();
    console.log(`\n\tTotal CUSDC USDC Balance: ${toUSDC(total)}`);
  });

  it("COntroller set APY Sort ", async () => {
    await controller.setAPYSort([0, 1, 2]);
  });

  it("Withdraw 100 will be withdrawn from LUSD, since ALUSD has no deposit", async () => {
    await vault.connect(alice).withdraw(fromUSDC(100), alice.address);
    // Read Total Assets
    let total = await vault.totalAssets();
    console.log(`\tTotal USDC Balance: ${toUSDC(total)}`);

    // Read ENF token Mint
    const enf = await vault.balanceOf(alice.address);
    console.log(`\tAlice ENF Balance: ${toEth(enf)}`);

    // Read Total Assets
    total = await alusd.totalAssets();
    console.log(`\n\tTotal ALUSD USDC Balance: ${toUSDC(total)}`);
    total = await lusd.totalAssets();
    console.log(`\n\tTotal LUSD USDC Balance: ${toUSDC(total)}`);
    total = await cusdc.totalAssets();
    console.log(`\n\tTotal CUSDC USDC Balance: ${toUSDC(total)}`);
  });

  it("Withdraw 1000 will be withdrawn from LUSD and CUSDC, since ALUSD has no deposit", async () => {
    await vault.connect(alice).withdraw(fromUSDC(1000), alice.address);
    // Read Total Assets
    let total = await vault.totalAssets();
    console.log(`\tTotal USDC Balance: ${toUSDC(total)}`);

    // Read ENF token Mint
    const enf = await vault.balanceOf(alice.address);
    console.log(`\tAlice ENF Balance: ${toEth(enf)}`);

    // Read Total Assets
    total = await alusd.totalAssets();
    console.log(`\n\tTotal ALUSD USDC Balance: ${toUSDC(total)}`);
    total = await lusd.totalAssets();
    console.log(`\n\tTotal LUSD USDC Balance: ${toUSDC(total)}`);
    total = await cusdc.totalAssets();
    console.log(`\n\tTotal CUSDC USDC Balance: ${toUSDC(total)}`);
  });

  it("Withdraw 999 will be reverted since exceed total deposit", async () => {
    await expect(vault.connect(alice).withdraw(fromUSDC(999), alice.address)).to.revertedWith("EXCEED_TOTAL_DEPOSIT");
  });
});
