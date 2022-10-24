const { ethers, waffle, network, upgrades } = require("hardhat");

main = async () => {
  setInterval(async () => {
    await network.provider.send("evm_mine");
    const block = (await ethers.provider.getBlock("latest")).number;
    console.log(block);
  }, 3000);
};

main();
