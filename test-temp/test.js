const { ethers, waffle, network, upgrades } = require("hardhat");
const { expect, util } = require("chai");
const colors = require("colors")
const { utils } = require("ethers");
const providers = require('ethers').providers;

const provider = new providers.JsonRpcProvider('http://localhost:8545');

const { crvContract, uniV2RouterContract, uniV2FactoryContract, alusdContract, crvETHContract } = require("./externalContracts")

const { usdc, weth, convexBooster, alusdPid, alusdLP, curveAlusd, crv, uniSwapV2Router, uniSwapV3Router, curveCRVETH, balancerV2Vault, balancerETHToUSDCSwap, balancerNoteToETHSwap, balancerNoteToUSDCAssets, balancerNoteToUSDCPools, crvUsdcPath, crvEthPath, ethUsdcPath } = require("../constants/constants")

let uniV3Test

function toEth(num) {
    return utils.formatEther(num)
}

function fromEth(num) {
    return utils.parseEther(num.toString())
}

async function swapCRV(caller) {

    await uniV2RouterContract(caller).swapExactETHForTokens(
        0,
        [
            weth, crv
        ],
        caller.address,
        100000000000,
        { value: fromEth(1) }
    )
}

describe("ENF Vault test", async () => {
    before(async () => {
        [deployer, alice, bob, carol, david, evan, fiona, treasury] = await ethers.getSigners();

        // Deploy uniV3Test
        const UniV3Test = await ethers.getContractFactory("UniV3Test")
        uniV3Test = await UniV3Test.deploy()
        console.log("Uni Tst deployed: ", uniV3Test.address)
    })

    // Prepare USDC before
    it("Swap Ether to usdc in uniswap V2", async () => {
        // USDC current amt
        const curCRV = await crvContract(deployer).balanceOf(alice.address)
        console.log(`\tCRV of Alice: ${toEth(curCRV)}`)

        const pair = await uniV2FactoryContract(deployer).getPair(crv, weth)
        console.log(`\tCRV-ETH pair address: ${pair}`)

        await swapCRV(alice)
        await swapCRV(deployer)

        const newUSDC = await crvContract(deployer).balanceOf(alice.address)
        console.log(`\tCRV of Alice: ${toEth(newUSDC)}`)
    })

    it("Swap via curve test", async () => {
        let bal = await provider.getBalance(alice.address)
        console.log("Alice ETh: ", toEth(bal))
        curCRV = await crvContract(deployer).balanceOf(alice.address)
        console.log(`\tCRV of Alice: ${toEth(curCRV)}`)

        await crvContract(alice).approve(uniV3Test.address, fromEth(1400))
        await uniV3Test.connect(alice).swap(fromEth(1400))

        bal = await provider.getBalance(alice.address)
        console.log("Alice ETh: ", toEth(bal))
        curCRV = await crvContract(deployer).balanceOf(alice.address)
        console.log(`\tCRV of Alice: ${toEth(curCRV)}`)
    })

    // it("Swap Directly via curve", async () => {
    //     let curCRV = await crvContract(deployer).balanceOf(alice.address)
    //     console.log(`\tCRV of Alice: ${toEth(curCRV)}`)

    //     await crvContract(alice).approve(crvETHContract(alice).address, fromEth(0))
    //     await crvContract(alice).approve(crvETHContract(alice).address, fromEth(100000000000000000))

    //     await crvETHContract(deployer).exchange(1, 0, fromEth(100), 0)

    //     curCRV = await crvContract(deployer).balanceOf(alice.address)
    //     console.log(`\tCRV of Alice: ${toEth(curCRV)}`)
    // })
})
