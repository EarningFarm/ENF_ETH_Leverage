const { ethers, run, upgrades } = require("hardhat");
const colors = require("colors");

exports.deployContract = async function (deployer, contractName, params) {
  console.log(`Deploying ${contractName}`.green);
  const Contract = await ethers.getContractFactory(contractName, {
    signer: deployer,
  });
  const contract = await Contract.deploy(...params);
  console.log(`${contractName} deployed at: ${contract.address}\n`);

  await contract.deployed();

  return contract;
};

exports.deployUpgradeable = async function (deployer, contractName, params) {
  console.log(`Deploying ${contractName}`.green);
  const Contract = await ethers.getContractFactory(contractName, {
    signer: deployer,
  });
  const contract = await upgrades.deployProxy(Contract, params);
  console.log(`${contractName} deployed at: ${contract.address}\n`);

  return contract;
};

exports.upgardeContract = async function (deployer, address, contractName) {
  const Contract = await ethers.getContractFactory(contractName, {
    signer: deployer,
  });

  console.log(`Upgrading ${contractName}...`.yellow);

  await upgrades.upgradeProxy(address, Contract);
  console.log(`${contractName} upgraded`.green);
};

exports.verifyContract = async function (contract, params) {
  try {
    // Verify
    console.log("Verifying: ", contract);
    await run("verify:verify", {
      address: contract,
      constructorArguments: params,
    });
  } catch (error) {
    if (error && error.message.includes("Reason: Already Verified")) {
      console.log("Already verified, skipping...");
    } else {
      console.error(error);
    }
  }
};

exports.verifyUpgradeable = async function (address) {
  try {
    // Verify
    const contract = await upgrades.erc1967.getImplementationAddress(address);
    // console.log("Verifying: ", contract);
    await run("verify:verify", {
      address: contract,
    });
  } catch (error) {
    if (error && error.message.includes("Reason: Already Verified")) {
      console.log("Already verified, skipping...");
    } else {
      console.error(error);
    }
  }
};
