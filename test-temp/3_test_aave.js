const { ethers, waffle, network, upgrades } = require("hardhat");
const { expect, util } = require("chai");
const colors = require("colors")
const { utils } = require("ethers");

const { usdcContract, uniV2RouterContract, uniV2FactoryContract, aaveContract, } = require("./externalContracts")

const { usdc, weth, convexBooster, aavePid, curveAave, aaveLP, compoundLP, triLP, crv, stkAAVE, lqty, alcx, uniSwapV2Router, crvUsdcPath, curveCRVETH } = require("../constants/constants")

let vault, controller, aave, depositApprover, exchange, curve

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
        vault = await upgrades.deployProxy(Vault, [usdc, "ENF LP", "ENF"])
        console.log(`Vault deployed at: ${vault.address}\n`)

        // Deploy Controller
        console.log("Deploying Controller".green)
        const Controller = await ethers.getContractFactory("Controller")
        controller = await upgrades.deployProxy(Controller, [vault.address, usdc, treasury.address, weth])
        console.log(`Controller deployed at: ${controller.address}\n`)

        // Deploy Aave
        console.log("Deploying AAVE".green)
        const Aave = await ethers.getContractFactory("Aave")
        aave = await upgrades.deployProxy(Aave, [curveAave, aaveLP, controller.address, usdc, convexBooster, aavePid])
        console.log(`Aave deployed at: ${aave.address}\n`)

        // Deploy Exchange
        console.log("Deploying Exchange".green)
        const Exchange = await ethers.getContractFactory("Exchange")
        exchange = await Exchange.deploy(weth, controller.address)

        // Deploy routers
        console.log("\nDeploying Curve".green)
        const Curve = await ethers.getContractFactory("Curve")
        curve = await Curve.deploy(weth, exchange.address)
        console.log("Curve is deployed: ", curve.address)

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

        // Set DepositSlippage on AAVE
        await aave.setDepositSlippage(100)
        console.log("Aave Deposit slippage set")

        // Set WithdrawSlippage on AAVE
        await aave.setWithdrawSlippage(100)
        console.log("Aave Withdraw slippage set")

        // Set CRV token for harvest token
        await aave.addRewardToken(crv)

        // Set CRV-USDC to CURVE
        await curve.addCurvePool(...curveCRVETH)

        // Get CRV-USDC path index
        const index = await curve.getPathIndex(...curveCRVETH)
        console.log(`\tCRV-USDC Uni v3 Path index: ${index}\n`)
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

    // Register Aave SS
    it("Register Aave with non-owner will be reverted", async () => {
        await expect(controller.connect(alice).registerSubStrategy(aave.address, 100)).to.revertedWith("Ownable: caller is not the owner")
    })

    it("Register Aave as 100 alloc point, check total alloc to be 100, ss length to be 1", async () => {
        await controller.connect(deployer).registerSubStrategy(aave.address, 100)
        const totalAlloc = await controller.totalAllocPoint()
        const ssLength = await controller.subStrategyLength()

        console.log(`\tTotal Alloc: ${totalAlloc.toNumber()}, ssLength: ${ssLength.toNumber()}`)
        expect(totalAlloc).to.equal(100)
        expect(ssLength).to.equal(1)
    })

    it("Register Aave will be reverted for duplication", async () => {
        await expect(controller.connect(deployer).registerSubStrategy(aave.address, 100)).to.revertedWith("ALREADY_REGISTERED")
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
        await expect(vault.connect(alice).withdraw(fromUSDC(10), alice.address)).to.revertedWith("EXCEED_TOTAL_DEPOSIT")
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
    //     const triPID = await aave.getPID(triLP)
    //     console.log(`\tTriPool Pid: ${triPID}`)
    // })

    ////////////////////////////////////////////////
    //                  HARVEST                   //
    ////////////////////////////////////////////////
    it("Pass Time and block number", async () => {
        await network.provider.send("evm_increaseTime", [3600 * 24 * 60]);
        await network.provider.send("evm_mine");
    })

    it("Harvest AAVE", async () => {
        // Get CRV-USDC path index
        const index = await curve.getPathIndex(...curveCRVETH)
        console.log(`\tCRV-USDC Path index: ${index}\n`)

        await controller.harvest([0], [index], [curve.address])

        // Read Total Assets
        const total = await vault.totalAssets()
        console.log(`\tTotal USDC Balance: ${toUSDC(total)}\n`)
    })

    ////////////////////////////////////////////////
    //              EMERGENCY WITHDRAW            //
    ////////////////////////////////////////////////
    it("Emergency Withdraw by non-owner will be reverted", async () => {
        await expect(aave.connect(alice).emergencyWithdraw()).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("Emergency Withdraw", async () => {
        await aave.emergencyWithdraw()
    })

    // it("Get LP withdrawn", async () => {
    //     const lpBal = await aaveContract(alice).balanceOf(deployer.address)
    //     console.log(`\tAave LP Withdrawn: ${toEth(lpBal)}`)
    // })

    /////////////////////////////////////////////////
    //               OWNER DEPOSIT                 //
    /////////////////////////////////////////////////
    it("Owner deposit will be reverted", async () => {
        await expect(aave.connect(alice).ownerDeposit(fromUSDC(100))).to.revertedWith("Ownable: caller is not the owner")
    })

    it("Owner Deposit", async () => {
        // Approve to deposit approver
        await usdcContract(deployer).approve(aave.address, fromUSDC(1000))

        await aave.connect(deployer).ownerDeposit(fromUSDC(1000))

        // Read Total Assets
        const total = await aave.totalAssets()
        console.log(`\n\tTotal USDC Balance: ${toUSDC(total)}`)
    })
})