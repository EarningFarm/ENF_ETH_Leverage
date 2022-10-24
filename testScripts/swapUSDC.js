const { ethers } = require("hardhat");
const { utils } = require("ethers");

const { usdcContract, uniV2RouterContract, uniV2FactoryContract, alusdContract, } = require("../test/externalContracts")
const constants = require("../constants/constants")

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
            constants.weth, constants.usdc
        ],
        caller.address,
        100000000000,
        { value: fromEth(1) }
    )
}

async function main() {
    const [deployer] = await ethers.getSigners();


    const curUSDC = await usdcContract(deployer).balanceOf(deployer.address)
    console.log(`\tUSDC of Alice: ${toUSDC(curUSDC)}`)


    await swapUSDC(deployer)
}

main()