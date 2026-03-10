const { db } = require('../config/firebase');

/**
 * Admin lists an item for sale with a price.
 * Sets status to 'for_sale' so it disappears from the regular items feed.
 */
const approveForSale = async (itemId, price, adminId) => {
  const ref = db.collection("items").doc(itemId);
  const doc = await ref.get();

  if (!doc.exists) throw new Error("Item not found");

  if (typeof price !== "number" || price <= 0) {
    throw new Error("Invalid price");
  }

  await ref.update({
    price,
    status: 'for_sale',
    saleApproved: true,
    saleStatus: 'listed',
    approvedAt: Date.now(),
    approvedBy: adminId || null,
  });
};

/**
 * Get all items currently listed for sale
 */
const getForSaleItems = async () => {
  const snapshot = await db.collection("items")
    .where("status", "==", "for_sale")
    .where("isDeleted", "==", false)
    .get();

  const items = [];
  snapshot.forEach(doc => {
    items.push({ id: doc.id, ...doc.data() });
  });
  return items;
};

/**
 * Buyer expresses interest — records the buyer and tells them to pay admin in person.
 */
const reserveItem = async (itemId, buyerId) => {
  const ref = db.collection("items").doc(itemId);

  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    if (!doc.exists) throw new Error("Item not found");

    const item = doc.data();
    if (item.status !== "for_sale") throw new Error("Item not available for sale");

    t.update(ref, {
      saleStatus: "reserved",
      reservedBy: buyerId,
      reservedAt: Date.now(),
    });
  });
};

/**
 * Admin marks an item as sold — disappears from for-sale page.
 */
const markSold = async (itemId, adminId) => {
  const ref = db.collection("items").doc(itemId);
  const doc = await ref.get();

  if (!doc.exists) throw new Error("Item not found");

  await ref.update({
    status: 'sold',
    saleStatus: 'sold',
    soldAt: Date.now(),
    soldBy: adminId || null,
  });
};

module.exports = {
  approveForSale,
  getForSaleItems,
  reserveItem,
  markSold,
};
