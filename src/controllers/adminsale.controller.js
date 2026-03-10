const { approveForSale, markSold, getForSaleItems } = require("../services/sale.service");

/**
 * Admin approves an item for sale
 * Route: POST /api/admin/sale/approve
 */
const approveSale = async (req, res) => {
  try {
    const { itemId, price } = req.body;

    if (!itemId || price === undefined) {
      return res.status(400).json({ message: "itemId and price are required" });
    }

    const adminId = req.user?.uid;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await approveForSale(itemId.trim(), price, adminId);
    return res.status(200).json({ message: "Item approved for sale" });
  } catch (error) {
    console.error("Admin approve error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to approve item" });
  }
};

/**
 * Admin marks an item as sold
 * Route: POST /api/admin/sale/mark-sold
 */
const markSoldController = async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) {
      return res.status(400).json({ message: "itemId is required" });
    }

    const adminId = req.user?.uid;
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await markSold(itemId.trim(), adminId);
    return res.status(200).json({ message: "Item marked as sold" });
  } catch (error) {
    console.error("Mark sold error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to mark item as sold" });
  }
};

/**
 * Get all for-sale items (admin view)
 * Route: GET /api/admin/sale/for-sale
 */
const getForSaleItemsController = async (req, res) => {
  try {
    const items = await getForSaleItems();
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error("Get for-sale items error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to get for-sale items" });
  }
};

module.exports = {
  approveSale,
  markSold: markSoldController,
  getForSaleItems: getForSaleItemsController,
};
