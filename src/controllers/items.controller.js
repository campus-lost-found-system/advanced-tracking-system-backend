const itemService = require('../services/items.service');
const { success, error } = require('../utils/response');

const create = async (req, res) => {
    try {
        const { title, description, type, location, date } = req.body;

        if (!title || !type || !location) {
            return error(res, 'Missing required fields', 400);
        }

        const data = {
            title,
            description: description || '',
            type, // 'lost' or 'found'
            location,
            date: date || new Date().toISOString()
        };

        const result = await itemService.createItem(data, req.user.uid);
        return success(res, result, 'Item reported successfully', 201);
    } catch (err) {
        return error(res, 'Failed to create item', 500, err.message);
    }
};

const uploadImage = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { image } = req.body; // Expecting Base64 string

        if (!image) {
            return error(res, 'Image data is required', 400);
        }

        const result = await itemService.uploadImage(itemId, req.user.uid, image);
        return success(res, result, 'Image uploaded successfully');
    } catch (err) {
        console.error('Error in uploadImage:', err);
        if (err.message === 'Unauthorized') return error(res, 'Unauthorized', 403);
        if (err.message === 'Item not found') return error(res, 'Item not found', 404);
        return error(res, 'Failed to upload image', 500, err.message);
    }
};

const getMyItems = async (req, res) => {
    try {
        const items = await itemService.getMyItems(req.user.uid);
        return success(res, items, 'Retrieved your items');
    } catch (err) {
        return error(res, 'Failed to retrieve items', 500, err.message);
    }
};

const getAll = async (req, res) => {
    try {
        const filters = req.query;
        const items = await itemService.searchItems(filters);
        return success(res, items, 'Retrieved all items');
    } catch (err) {
        return error(res, 'Failed to search items', 500, err.message);
    }
};

const update = async (req, res) => {
    try {
        const { itemId } = req.params;
        const updates = req.body;

        const result = await itemService.updateItem(itemId, req.user.uid, updates);
        return success(res, result, 'Item updated successfully');
    } catch (err) {
        if (err.message === 'Unauthorized') return error(res, 'Unauthorized', 403);
        if (err.message === 'Item not found') return error(res, 'Item not found', 404);
        return error(res, 'Failed to update item', 500, err.message);
    }
};

const remove = async (req, res) => {
    try {
        const { itemId } = req.params;

        const result = await itemService.deleteItem(itemId, req.user.uid);
        return success(res, null, result.message);
    } catch (err) {
        if (err.message === 'Unauthorized') return error(res, 'Unauthorized', 403);
        if (err.message === 'Item not found') return error(res, 'Item not found', 404);
        return error(res, 'Failed to delete item', 500, err.message);
    }
};

module.exports = {
    create,
    uploadImage,
    getMyItems,
    getAll,
    update,
    remove
};
