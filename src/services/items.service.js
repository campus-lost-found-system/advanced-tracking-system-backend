const { admin, db } = require('../config/firebase');
const storage = admin.storage();
const fs = require('fs');
const path = require('path');

class ItemsService {
    constructor() {
        this.collection = db.collection('items');
    }

    /**
     * Create a new item
     * @param {Object} data 
     * @param {string} userId 
     */
    async createItem(data, userId) {
        try {
            const newItem = {
                ...data,
                userId,
                status: 'pending', // Default status
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                isDeleted: false
            };

            const docRef = await this.collection.add(newItem);

            // Return serializable object
            return {
                id: docRef.id,
                ...newItem,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Upload Image to Firebase Storage
     * @param {string} itemId 
     * @param {string} userId 
     * @param {string} imageBase64 
     */
    async uploadImage(itemId, userId, imageBase64) {
        try {
            const itemDoc = await this.collection.doc(itemId).get();
            if (!itemDoc.exists) throw new Error('Item not found');

            const itemData = itemDoc.data();
            if (itemData.userId !== userId) throw new Error('Unauthorized');

            // Parse Base64
            // Expect format: "data:image/jpeg;base64,/9j/4AAQSw..."
            const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

            if (!matches || matches.length !== 3) {
                throw new Error('Invalid base64 string');
            }

            const type = matches[1]; // e.g., image/jpeg
            const buffer = Buffer.from(matches[2], 'base64');
            const extension = type.split('/')[1];

            const fileName = `${itemId}_${Date.now()}.${extension}`;
            const filePath = path.join(__dirname, '../../public/uploads', fileName);

            // Write the buffer to the file system
            fs.writeFileSync(filePath, buffer);

            // Construct the local static URL using the server's HTTP endpoint
            const publicUrl = `http://localhost:5000/public/uploads/${fileName}`;

            await this.collection.doc(itemId).update({
                imageUrl: publicUrl,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { imageUrl: publicUrl };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get items for the logged-in user
     * @param {string} userId 
     */
    async getMyItems(userId) {
        try {
            const result = [];
            const snapshot = await this.collection
                .where('userId', '==', userId)
                .where('isDeleted', '==', false)
                .orderBy('createdAt', 'desc')
                .get();

            snapshot.forEach(doc => {
                result.push({ id: doc.id, ...doc.data() });
            });
            return result;
        } catch (error) {
            // Index query error might happen if composite index missing
            // Fallback to client side sort? No, usually 'userId' filter is enough.
            // If orderBy fails without index, try removing orderBy.
            console.error(error);
            throw error;
        }
    }

    /**
     * Search and discover items
     * @param {Object} query 
     */
    async searchItems(query) {
        try {
            let ref = this.collection.where('isDeleted', '==', false);

            // Simple filtering
            if (query.type) {
                ref = ref.where('type', '==', query.type);
            }

            // Should probably only show 'approved' or 'pending'?
            // Assuming 'status' is existing.
            // ref = ref.where('status', '==', 'approved'); 
            // But requirements say "create ... status=pending". 
            // Usually discovery only shows open/approved items. 
            // I'll leave status filter optional or default to not showing deleted.

            const snapshot = await ref.get();
            const result = [];
            snapshot.forEach(doc => {
                result.push({ id: doc.id, ...doc.data() });
            });

            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update item details
     * @param {string} itemId 
     * @param {string} userId 
     * @param {Object} updates 
     */
    async updateItem(itemId, userId, updates) {
        try {
            const docRef = this.collection.doc(itemId);
            const doc = await docRef.get();

            if (!doc.exists) throw new Error('Item not found');
            if (doc.data().userId !== userId) throw new Error('Unauthorized');

            // Protect status field (no status change allowed via this API)
            delete updates.status;
            delete updates.userId;
            delete updates.createAt;

            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await docRef.update(updates);
            return { id: itemId, ...updates };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Soft delete item
     * @param {string} itemId 
     * @param {string} userId 
     */
    async deleteItem(itemId, userId) {
        try {
            const docRef = this.collection.doc(itemId);
            const doc = await docRef.get();

            if (!doc.exists) throw new Error('Item not found');
            if (doc.data().userId !== userId) throw new Error('Unauthorized');

            await docRef.update({
                isDeleted: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { message: 'Item deleted successfully' };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new ItemsService();
