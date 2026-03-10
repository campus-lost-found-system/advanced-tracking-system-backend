const express = require("express");
const { getForSaleItems } = require("../services/sale.service");
const { reserveItem } = require("../services/sale.service");
const authenticate = require("../middlewares/auth.middleware");

const router = express.Router();

// GET /api/sale/items — public list of items for sale (authenticated users)
router.get("/items", authenticate, async (req, res) => {
    try {
        const items = await getForSaleItems();
        return res.status(200).json({ success: true, data: items });
    } catch (error) {
        console.error("Get sale items error:", error.message);
        return res.status(500).json({ message: error.message || "Failed to get sale items" });
    }
});

// POST /api/sale/buy — buyer expresses interest 
router.post("/buy", authenticate, async (req, res) => {
    try {
        const { itemId } = req.body;
        const buyerId = req.user.uid;

        if (!itemId) {
            return res.status(400).json({ message: "itemId is required" });
        }

        await reserveItem(itemId, buyerId);
        res.status(200).json({
            success: true,
            message: "Item reserved! Please visit the admin office to complete payment."
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
