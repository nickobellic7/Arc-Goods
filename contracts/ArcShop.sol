// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ArcShop
/// @notice A non-custodial store accepting a configured USDC token.
/// @dev Prices and totals are raw USDC units (6 decimals). On Arc Testnet,
///      USDC is 0x3600000000000000000000000000000000000000.
contract ArcShop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Product {
        uint128 price;
        bool active;
    }

    struct Order {
        address buyer;
        uint256 timestamp;
        uint256 total;
        uint256[] ids;
        uint256[] qtys;
    }

    error ZeroAddress();
    error InvalidInitialProductCount(uint256 count);
    error InvalidPrice(uint256 price);
    error UnknownProduct(uint256 id);
    error InactiveProduct(uint256 id);
    error InvalidCart();
    error InvalidQuantity(uint256 quantity);
    error TotalExceedsMaximum(uint256 total, uint256 maximum);
    error UnknownOrder(uint256 id);

    event ProductSet(uint256 indexed id, uint128 price, bool active);
    event MerchantSet(address indexed merchant);
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed buyer,
        uint256 total,
        uint256[] ids,
        uint256[] qtys
    );

    IERC20 public immutable usdc;
    address public merchant;
    mapping(uint256 => Product) public products;
    uint256 public productCount;

    uint256 private _orderCount;
    mapping(uint256 => Order) private _orders;
    mapping(address => uint256[]) private _buyerOrderIds;

    /// @notice Configure the token, payment recipient, owner, and 1–50 active products.
    /// @param usdc_ USDC token address; must use 6-decimal raw units.
    /// @param merchant_ Recipient of checkout payments.
    /// @param initialOwner Account authorized to manage products and the merchant.
    /// @param initialPrices Nonzero prices fitting in uint128, assigned IDs starting at 1.
    constructor(
        address usdc_,
        address merchant_,
        address initialOwner,
        uint256[] memory initialPrices
    ) Ownable(initialOwner) {
        if (usdc_ == address(0) || merchant_ == address(0)) revert ZeroAddress();
        uint256 count = initialPrices.length;
        if (count == 0 || count > 50) revert InvalidInitialProductCount(count);
        usdc = IERC20(usdc_);
        merchant = merchant_;
        emit MerchantSet(merchant_);
        for (uint256 i; i < count; ++i) {
            _setProduct(i + 1, initialPrices[i], true);
        }
    }

    /// @notice Update an existing product or append the next sequential product.
    /// @param id An existing ID or productCount + 1.
    /// @param price Nonzero raw USDC price fitting in uint128.
    /// @param active Whether the product may be purchased.
    function setProduct(uint256 id, uint256 price, bool active) external onlyOwner {
        if (id == 0 || id > productCount + 1) revert UnknownProduct(id);
        _setProduct(id, price, active);
    }

    /// @notice Change the recipient of future checkout payments.
    function setMerchant(address merchant_) external onlyOwner {
        if (merchant_ == address(0)) revert ZeroAddress();
        merchant = merchant_;
        emit MerchantSet(merchant_);
    }

    /// @notice Purchase 1–20 lines using an existing USDC allowance to this contract.
    /// @dev Duplicate IDs are permitted; quantity limits apply per line. State is
    ///      recorded before transfer; a failed transfer reverts the entire order.
    /// @param ids Active product IDs, in purchase order.
    /// @param qtys Quantities of 1–100 for each corresponding ID.
    /// @param maxTotal Maximum total the buyer authorizes in raw USDC units.
    /// @return orderId Sequential order identifier starting at 1.
    function checkout(
        uint256[] calldata ids,
        uint256[] calldata qtys,
        uint256 maxTotal
    ) external nonReentrant returns (uint256 orderId) {
        uint256 lines = ids.length;
        if (lines == 0 || lines > 20 || lines != qtys.length) revert InvalidCart();
        uint256 total;
        for (uint256 i; i < lines; ++i) {
            uint256 id = ids[i];
            if (id == 0 || id > productCount) revert UnknownProduct(id);
            Product memory product = products[id];
            if (!product.active) revert InactiveProduct(id);
            uint256 quantity = qtys[i];
            if (quantity == 0 || quantity > 100) revert InvalidQuantity(quantity);
            total += uint256(product.price) * quantity;
        }
        if (total > maxTotal) revert TotalExceedsMaximum(total, maxTotal);

        address recipient = merchant;
        orderId = ++_orderCount;
        Order storage order = _orders[orderId];
        order.buyer = msg.sender;
        order.timestamp = block.timestamp;
        order.total = total;
        order.ids = ids;
        order.qtys = qtys;
        _buyerOrderIds[msg.sender].push(orderId);

        usdc.safeTransferFrom(msg.sender, recipient, total);
        emit OrderPlaced(orderId, msg.sender, total, ids, qtys);
    }

    /// @notice Return the number of successfully placed orders.
    function orderCount() external view returns (uint256) {
        return _orderCount;
    }

    /// @notice Return a stored order, reverting if its ID does not exist.
    function getOrder(uint256 orderId) external view returns (
        address buyer,
        uint256 timestamp,
        uint256 total,
        uint256[] memory ids,
        uint256[] memory qtys
    ) {
        if (orderId == 0 || orderId > _orderCount) revert UnknownOrder(orderId);
        Order storage order = _orders[orderId];
        return (order.buyer, order.timestamp, order.total, order.ids, order.qtys);
    }

    /// @notice Return all order IDs placed by a buyer, oldest first.
    function getBuyerOrderIds(address buyer) external view returns (uint256[] memory) {
        return _buyerOrderIds[buyer];
    }

    /// @notice Return the full product catalog in ascending ID order.
    function getProducts() external view returns (
        uint256[] memory ids,
        uint256[] memory prices,
        bool[] memory actives
    ) {
        uint256 count = productCount;
        ids = new uint256[](count);
        prices = new uint256[](count);
        actives = new bool[](count);
        for (uint256 i; i < count; ++i) {
            uint256 id = i + 1;
            Product memory product = products[id];
            ids[i] = id;
            prices[i] = product.price;
            actives[i] = product.active;
        }
    }

    function _setProduct(uint256 id, uint256 price, bool active) private {
        if (price == 0 || price > type(uint128).max) revert InvalidPrice(price);
        products[id] = Product(uint128(price), active);
        if (id > productCount) productCount = id;
        emit ProductSet(id, uint128(price), active);
    }
}
