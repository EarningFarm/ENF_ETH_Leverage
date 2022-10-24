const { ethers } = require("hardhat");
const fs = require("fs");
const { yellow, cyan } = require("colors");

const { deployContract, deployUpgradeable, verifyContract, verifyUpgradeable } = require("./utils");
const constants = require("../constants/constants");
const { treasury } = require("./config");
const address = require("./address.json");

async function main() {
  const [deployer] = await ethers.getSigners();

  /////////////////////////////////////////
  //             DEPLOYING               //
  /////////////////////////////////////////

  console.log("\nDeploying Contracts\n".yellow);

  const tri = "0x0F97afE1aedFc6B89DE66950296E130cA814B010";

  await verifyUpgradeable(tri);
  // await verifyUpgradeable(lusd.address);
  // await verifyUpgradeable(aave.address);
  // await verifyUpgradeable(compound.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
