const ethers = require("ethers");
const { utils } = require("ethers");
const fs = require("fs");
const address = require("../scripts/v3_address.json");
const leverageAddress = address["Leverage address"];
const aStETHAddress = "0x1982b2f5814301d4e9a8b0201555376e62f82428";
const { abi: leverageAbi } = require("../artifacts/contracts/subStrategies/ETH_Leverage.sol/ETHLeverage.json");
const aStETHAbi = require("../abi/aStEth.json");

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

let data = require("./data.json");

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(
    "https://small-attentive-lake.discover.quiknode.pro/08ab6c0be9950f0101632faa3a2af15a4a42221c/"
  );

  const leverage = new ethers.Contract(leverageAddress, leverageAbi, provider);

  // Read Total Assets
  const total = await leverage.totalAssets();
  console.log(`Total ETH Balance: ${toEth(total)}`);

  const collateral = await leverage.getCollateral();
  console.log(`Total Collateral: ${toEth(collateral)}`);
  const debt = await leverage.getDebt();
  console.log(`Total Debt: ${toEth(debt)}`);

  const aStETH = new ethers.Contract(aStETHAddress, aStETHAbi, provider);
  const aTokenBal = await aStETH.balanceOf(leverageAddress);

  console.log(`Total aStETH: ${toEth(aTokenBal)}`);

  const price = toEth(collateral) / toEth(aTokenBal);
  console.log("Price: ", price);

  data.push({
    total: toEth(total),
    collateral: toEth(collateral),
    debt: toEth(debt),
    aToken: toEth(aTokenBal),
    price,
    time: new Date(),
  });

  fs.writeFileSync("./testScripts/data.json", JSON.stringify(data));
}

main();
