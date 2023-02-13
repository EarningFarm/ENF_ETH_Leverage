const { ethers } = require("hardhat");
const web3 = require("web3");
const { utils } = require("ethers");

const address = require("../scripts/v3_address.json");
const vault = address["ENF Vault address"];
const { abi: vaultAbi } = require("../artifacts/contracts/core/Vault.sol/EFVault.json");
// const proxyAbi = require("../abi/proxy.json");
// const proxyAdminAbi = require("../abi/proxyAdmin.json");
const { deployContract } = require("../scripts/utils");
const { usdc } = require("../constants/constants");

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");

  // const vaultContract = new ethers.Contract(vault, vaultAbi, deployer);
  // let version = await vaultContract.version();
  // console.log("Version: ", version);

  // const newVault = await deployContract(deployer, "EFNewVault", []);

  // Get Vault proxy admin
  let admin = await provider.getStorageAt(vault, "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103");
  // '0x0000000000000000000000009f67949ee6aa9c94c959ba64f03781a11ed130fd'
  // const admin = await vaultContract.admin();
  admin = `0x${admin.slice(26)}`;
  console.log("Proxy Admin: ", admin);

  // const adminContract = new ethers.Contract(admin, proxyAdminAbi, deployer);
  // await adminContract.upgrade(vault, newVault.address);

  // version = await vaultContract.version();
  // console.log("Version: ", version);
}
6;
main();
