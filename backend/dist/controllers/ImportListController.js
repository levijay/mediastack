"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportListController = void 0;
const ImportList_1 = require("../models/ImportList");
const importListService_1 = require("../services/importListService");
const logger_1 = __importDefault(require("../config/logger"));
exports.ImportListController = {
    // Get all import lists
    async getAll(req, res) {
        try {
            const lists = ImportList_1.ImportListModel.getAll();
            res.json(lists);
        }
        catch (error) {
            logger_1.default.error(`Error getting import lists: ${error.message}`);
            res.status(500).json({ error: 'Failed to get import lists' });
        }
    },
    // Get import list by ID
    async getById(req, res) {
        try {
            const { id } = req.params;
            const list = ImportList_1.ImportListModel.getById(id);
            if (!list) {
                return res.status(404).json({ error: 'Import list not found' });
            }
            res.json(list);
        }
        catch (error) {
            logger_1.default.error(`Error getting import list: ${error.message}`);
            res.status(500).json({ error: 'Failed to get import list' });
        }
    },
    // Create new import list
    async create(req, res) {
        try {
            const list = ImportList_1.ImportListModel.create(req.body);
            logger_1.default.info(`Created import list: ${list.name}`);
            res.status(201).json(list);
        }
        catch (error) {
            logger_1.default.error(`Error creating import list: ${error.message}`);
            res.status(500).json({ error: 'Failed to create import list' });
        }
    },
    // Update import list
    async update(req, res) {
        try {
            const { id } = req.params;
            const list = ImportList_1.ImportListModel.update(id, req.body);
            if (!list) {
                return res.status(404).json({ error: 'Import list not found' });
            }
            logger_1.default.info(`Updated import list: ${list.name}`);
            res.json(list);
        }
        catch (error) {
            logger_1.default.error(`Error updating import list: ${error.message}`);
            res.status(500).json({ error: 'Failed to update import list' });
        }
    },
    // Delete import list
    async delete(req, res) {
        try {
            const { id } = req.params;
            const success = ImportList_1.ImportListModel.delete(id);
            if (!success) {
                return res.status(404).json({ error: 'Import list not found' });
            }
            logger_1.default.info(`Deleted import list: ${id}`);
            res.json({ message: 'Import list deleted successfully' });
        }
        catch (error) {
            logger_1.default.error(`Error deleting import list: ${error.message}`);
            res.status(500).json({ error: 'Failed to delete import list' });
        }
    },
    // Get available list types and presets
    async getListTypes(req, res) {
        try {
            const types = ImportList_1.ImportListModel.getListTypes();
            res.json(types);
        }
        catch (error) {
            logger_1.default.error(`Error getting list types: ${error.message}`);
            res.status(500).json({ error: 'Failed to get list types' });
        }
    },
    // Sync a specific list
    async syncList(req, res) {
        try {
            const { id } = req.params;
            const list = ImportList_1.ImportListModel.getById(id);
            if (!list) {
                return res.status(404).json({ error: 'Import list not found' });
            }
            const results = await importListService_1.importListService.syncList(list);
            res.json({
                message: `Sync complete for ${list.name}`,
                ...results
            });
        }
        catch (error) {
            logger_1.default.error(`Error syncing import list: ${error.message}`);
            res.status(500).json({ error: 'Failed to sync import list' });
        }
    },
    // Preview what a list would import
    async previewList(req, res) {
        try {
            const { id } = req.params;
            const list = ImportList_1.ImportListModel.getById(id);
            if (!list) {
                return res.status(404).json({ error: 'Import list not found' });
            }
            const preview = await importListService_1.importListService.previewList(list);
            res.json(preview);
        }
        catch (error) {
            logger_1.default.error(`Error previewing import list: ${error.message}`);
            res.status(500).json({ error: 'Failed to preview import list' });
        }
    },
    // Sync all due lists
    async syncAll(req, res) {
        try {
            await importListService_1.importListService.syncDueLists();
            res.json({ message: 'All due lists synced' });
        }
        catch (error) {
            logger_1.default.error(`Error syncing all lists: ${error.message}`);
            res.status(500).json({ error: 'Failed to sync all lists' });
        }
    }
};
//# sourceMappingURL=ImportListController.js.map