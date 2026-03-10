const express = require("express");
const { approveSale, markSold, getForSaleItems } = require("../controllers/adminsale.controller");
const authenticate = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/role.middleware");

const router = express.Router();

// POST /api/admin/sale/approve — list an item for sale with a price
router.post("/approve", authenticate, authorize('admin'), approveSale);

// POST /api/admin/sale/mark-sold — mark an item as sold
router.post("/mark-sold", authenticate, authorize('admin'), markSold);

// GET /api/admin/sale/for-sale — get all items listed for sale (admin view)
router.get("/for-sale", authenticate, authorize('admin'), getForSaleItems);

module.exports = router;
