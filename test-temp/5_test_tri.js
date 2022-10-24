const { ethers, waffle, network, upgrades } = require("hardhat");
const { expect, util } = require("chai");
const colors = require("colors")
const { utils } = require("ethers");

const { usdcContract, uniV2RouterContract, uniV2FactoryContract, triContract, } = require("./externalContracts")

const { usdc, weth, convexBooster, triPid, curveTri, triLP, crv, stkTRI, lqty, alcx, uniSwapV2Router, crvUsdcPath } = require("../constants/constants")

let vault, controller, tri, depositApprover, exchange

function toEth(num) {
    return utils.formatEther(num)
}

function toUSDC(num) {
    return utils.formatUnits(num, 6)
}

function fromEth(num) {
    return utils.parseEther(num.toString())
}

function fromUSDC(num) {
    return utils.parseUnits(num.toString(), 6)
}

async function swapUSDC(caller) {

    await uniV2RouterContract(caller).swapExactETHForTokens(
        0,
        [
            weth, usdc
        ],
        caller.address,
        100000000000,
        { value: fromEth(1) }
    )
}

describe("ENF Vault test", async () => {
    before(async () => {
        [deployer, alice, bob, carol, david, evan, fiona, treasury] = await ethers.getSigners();

        // Deploy DepositApprover
        console.log("Deploying DepositApprover".green)
        const DepositApprover = await ethers.getContractFactory("DepositApprover")
        depositApprover = await DepositApprover.deploy(usdc)
        console.log(`DepositApprover deployed at: ${depositApprover.address}\n`)

        // Deploy Vault
        console.log("Deploying Vault".green)
        const Vault = await ethers.getContractFactory("EFVault")
        vault = await Vault.deploy(usdc, "ENF LP", "ENF")
        console.log(`Vault deployed at: ${vault.address}\n`)

        // Deploy Controller
        console.log("Deploying Controller".green)
        const Controller = await ethers.getContractFactory("Controller")
        controller = await Controller.deploy(vault.address, usdc, treasury.address)
        console.log(`Controller deployed at: ${controller.address}\n`)

        // Deploy Tri
        console.log("Deploying TRI".green)
        const Tri = await ethers.getContractFactory("Tri")
        tri = await Tri.deploy(curveTri, triLP, controller.address, usdc, convexBooster, triPid)
        console.log(`Tri deployed at: ${tri.address}\n`)

        // Deploy Exchange
        console.log("Deploying Exchange".green)
        const Exchange = await ethers.getContractFactory("Exchange")
        exchange = await Exchange.deploy(weth, controller.address)

        /**
         * Wiring Contracts with each other 
         */

        // Set Vault on deposit approver
        await depositApprover.setVault(vault.address)
        console.log("Deposit Approver set Vault")

        // Set deposit approver to vault
        await vault.setDepositApprover(depositApprover.address)
        console.log("Vault set deposit approver")

        // Set Controller to vault
        await vault.setController(controller.address)
        console.log("Controller set Vault")

        // Set Exchange to Controller
        await controller.setExchange(exchange.address)

        /**
         * Set configuration
         */

        // Set DepositSlippage on TRI
        await tri.setDepositSlippage(100)
        console.log("Deposit slippage set")

        // Set WithdrawSlippage on TRI
        await tri.setWithdrawSlippage(100)
        console.log("Withdraw slippage set")

        // Set CRV token for harvest token
        await tri.addRewardToken(crv)

        // Set CRV-USDC to exchange
        await exchange.addPath(
            2,
            uniSwapV2Router,
            [crv, weth, usdc]
        )

        // Get CRV-USDC path index
        const index = await exchange.getPathIndex(uniSwapV2Router, [crv, weth, usdc])
        console.log(`\tCRV-USDC Path index: ${index}\n`)
    })

    it("Vault Deployed", async () => {
        const name = await vault.name()
        const symbol = await vault.symbol()
        const asset = await vault.asset()
        console.log("\tVault info: ", name, symbol, asset)
    })

    // Prepare USDC before
    it("Swap Ether to usdc in uniswap V2", async () => {
        // USDC current amt
        const curUSDC = await usdcContract(deployer).balanceOf(alice.address)
        console.log(`\tUSDC of Alice: ${toUSDC(curUSDC)}`)

        const pair = await uniV2FactoryContract(deployer).getPair(usdc, weth)
        console.log(`\tUSDC-ETH pair address: ${pair}`)

        await swapUSDC(alice)
        await swapUSDC(deployer)

        const newUSDC = await usdcContract(deployer).balanceOf(alice.address)
        console.log(`\tUSDC of Alice: ${toUSDC(newUSDC)}`)
    })

    // Register Tri SS
    it("Register Tri with non-owner will be reverted", async () => {
        await expect(controller.connect(alice).registerSubStrategy(tri.address, 100)).to.revertedWith("Ownable: caller is not the owner")
    })

    it("Register Tri as 100 alloc point, check total alloc to be 100, ss length to be 1", async () => {
        await controller.connect(deployer).registerSubStrategy(tri.address, 100)
        const totalAlloc = await controller.totalAllocPoint()
        const ssLength = await controller.subStrategyLength()

        console.log(`\tTotal Alloc: ${totalAlloc.toNumber()}, ssLength: ${ssLength.toNumber()}`)
        expect(totalAlloc).to.equal(100)
        expect(ssLength).to.equal(1)
    })

    it("Register Tri will be reverted for duplication", async () => {
        await expect(controller.connect(deployer).registerSubStrategy(tri.address, 100)).to.revertedWith("ALREADY_REGISTERED")
    })

    ///////////////////////////////////////////////////
    //                 DEPOSIT                       //
    ///////////////////////////////////////////////////
    it("Deposit 100 USDC", async () => {
        // Approve to deposit approver
        await usdcContract(alice).approve(depositApprover.address, fromUSDC(100))

        // Deposit
        await depositApprover.connect(alice).deposit(fromUSDC(100))

        // Read Total Assets
        const total = await vault.totalAssets()
        console.log(`\tTotal USDC Balance: ${toUSDC(total)}`)

        // Read ENF token Mint
        const enf = await vault.balanceOf(alice.address)
        console.log(`\tAlice ENF Balance: ${toEth(enf)}`)
    })

    ///////////////////////////////////////////////////
    //                WITHDRAW                       //
    ///////////////////////////////////////////////////
    it("Withdraw 90 USDC", async () => {
        await vault.connect(alice).withdraw(fromUSDC(90), alice.address);
        // Read Total Assets
        const total = await vault.totalAssets()
        console.log(`\tTotal USDC Balance: ${toUSDC(total)}`)

        // Read ENF token Mint
        const enf = await vault.balanceOf(alice.address)
        console.log(`\tAlice ENF Balance: ${toEth(enf)}`)
    })

    it("Withdraw 10 USDC will be reverted", async () => {
        await expect(vault.connect(alice).withdraw(fromUSDC(10), alice.address)).to.revertedWith("INVALID_WITHDRAWN_SHARES")
    })

    it("Deposit 1000 USDC", async () => {
        // Approve to deposit approver
        await usdcContract(alice).approve(depositApprover.address, fromUSDC(1000))

        // Deposit
        await depositApprover.connect(alice).deposit(fromUSDC(1000))

        // Read Total Assets
        const total = await vault.totalAssets()
        console.log(`\tTotal USDC Balance: ${toUSDC(total)}`)

        // Read ENF token Mint
        const enf = await vault.balanceOf(alice.address)
        console.log(`\tAlice ENF Balance: ${toEth(enf)}`)
    })

    // it("Get Pid", async () => {
    //     const triPID = await tri.getPID(triLP)
    //     console.log(`\tTriPool Pid: ${triPID}`)
    // })

    ////////////////////////////////////////////////
    //                  HARVEST                   //
    ////////////////////////////////////////////////

    // it("Pass Time and block number", async () => {
    //     await network.provider.send("evm_increaseTime", [3600 * 24 * 60]);
    //     await network.provider.send("evm_mine");
    //     await network.provider.send("evm_mine");
    //     await network.provider.send("evm_mine");
    // })

    it("Harvest TRI", async () => {
        // Get CRV-USDC path index
        const index = await exchange.getPathIndex(uniSwapV2Router, [crv, weth, usdc])
        console.log(`\tCRV-USDC Path index: ${index}\n`)

        await controller.harvest([0], [index])

        // Read Total Assets
        const total = await vault.totalAssets()
        console.log(`\tTotal USDC Balance: ${toUSDC(total)}\n`)
    })

    ////////////////////////////////////////////////
    //              EMERGENCY WITHDRAW            //
    ////////////////////////////////////////////////
    it("Emergency Withdraw by non-owner will be reverted", async () => {
        await expect(tri.connect(alice).emergencyWithdraw()).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("Emergency Withdraw", async () => {
        await tri.emergencyWithdraw()
    })

    // it("Get LP withdrawn", async () => {
    //     const lpBal = await triContract(alice).balanceOf(deployer.address)
    //     console.log(`\tTri LP Withdrawn: ${toEth(lpBal)}`)
    // })

    /////////////////////////////////////////////////
    //               OWNER DEPOSIT                 //
    /////////////////////////////////////////////////
    it("Owner deposit will be reverted", async () => {
        await expect(tri.connect(alice).ownerDeposit(fromUSDC(100))).to.revertedWith("Ownable: caller is not the owner")
    })

    it("Owner Deposit", async () => {
        // Approve to deposit approver
        await usdcContract(deployer).approve(tri.address, fromUSDC(1000))

        await tri.connect(deployer).ownerDeposit(fromUSDC(1000))

        // Read Total Assets
        const total = await tri.totalAssets()
        console.log(`\n\tTotal USDC Balance: ${toUSDC(total)}`)
    })
})