// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/ICurve.sol";
import "../interfaces/IStETH.sol";
import "../interfaces/IExchange.sol";
import "../../utils/TransferHelper.sol";

contract ETHLeverExchange is OwnableUpgradeable, IExchange {
    address public leverSS;

    address public weth;

    address public curvePool;

    address public stETH;

    function initialize(
        address _weth,
        address _leverSS,
        address _curvePool,
        address _stETH
    ) public initializer {
        __Ownable_init();

        weth = _weth;
        stETH = _stETH;
        leverSS = _leverSS;
        curvePool = _curvePool;
    }

    modifier onlyLeverSS() {
        require(_msgSender() == leverSS, "ONLY_LEVER_VAULT_CALL");
        _;
    }

    function swapStETH(uint256 amount) external onlyLeverSS {
        require(address(this).balance >= amount, "INSUFFICIENT_ETH");

        uint256 curveOut = ICurve(curvePool).get_dy(0, 1, amount);

        if (curveOut < amount) {
            IStETH(stETH).submit{value: address(this).balance}(address(this));
        } else {
            ICurve(curvePool).exchange{value: address(this).balance}(0, 1, amount, 0);
        }
        uint256 stETHBal = IERC20(stETH).balanceOf(address(this));

        // Transfer STETH to LeveraSS
        TransferHelper.safeTransfer(stETH, leverSS, stETHBal);
    }

    function swapETH(uint256 amount) external onlyLeverSS {
        require(IERC20(stETH).balanceOf(address(this)) >= amount, "INSUFFICIENT_STETH");

        // Approve STETH to curve
        IERC20(stETH).approve(curvePool, 0);
        IERC20(stETH).approve(curvePool, amount);
        ICurve(curvePool).exchange(1, 0, amount, 0);

        uint256 ethBal = address(this).balance;

        // Transfer STETH to LeveraSS
        TransferHelper.safeTransferETH(leverSS, ethBal);
    }
}
