const express = require("express");

const router = express.Router();

const { getDb } = require("../config/db");

// ========================================
// GET /api/menu
// GET ALL MENU ITEMS
// ========================================

router.get("/", async (req, res) => {
    try {
        const db = getDb();

        const menuItems = await db
            .collection("menu")
            .find({})
            .sort({
                createdAt: -1
            })
            .toArray();

        return res.status(200).json({
            success: true,
            count: menuItems.length,
            data: menuItems
        });

    } catch (error) {

        console.error(
            "❌ Error fetching menu items:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch menu items."
        });
    }
});


// ========================================
// POST /api/menu
// CREATE NEW MENU ITEM
// ========================================

router.post("/", async (req, res) => {
    try {

        const {
            name,
            category,
            price,
            description,
            image
        } = req.body;


        // ========================================
        // 1. VALIDATE NAME
        // ========================================

        if (
            !name ||
            typeof name !== "string" ||
            !name.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Menu item name is required."
            });
        }


        // ========================================
        // 2. VALIDATE CATEGORY
        // ========================================

        if (
            !category ||
            typeof category !== "string" ||
            !category.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Menu item category is required."
            });
        }


        // ========================================
        // 3. VALIDATE PRICE
        // ========================================

        const normalizedPrice = Number(price);

        if (
            !Number.isFinite(normalizedPrice) ||
            normalizedPrice <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Menu item price must be greater than 0."
            });
        }


        // ========================================
        // 4. PREPARE DOCUMENT
        // ========================================

        const now = new Date();

        const newMenuItem = {

            name: name.trim(),

            category: category.trim().toLowerCase(),

            price: normalizedPrice,

            description:
                typeof description === "string"
                    ? description.trim()
                    : "",

            image:
                typeof image === "string"
                    ? image.trim()
                    : "",

            // Future-ready field
            available: true,

            createdAt: now,

            updatedAt: now
        };


        // ========================================
        // 5. SAVE TO MONGODB
        // ========================================

        const db = getDb();

        const result = await db
            .collection("menu")
            .insertOne(newMenuItem);


            // ========================================
// SOCKET: MENU ITEM ADDED
// ========================================

const io = req.app.get("io");

io.emit("menuUpdated", {
    action: "added"
});


        // ========================================
        // 6. RETURN CREATED ITEM
        // ========================================

        return res.status(201).json({

            success: true,

            message: "Menu item created successfully.",

            data: {
                ...newMenuItem,
                _id: result.insertedId
            }

        });

    } catch (error) {

        console.error(
            "❌ Error creating menu item:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create menu item."
        });
    }
});


// ========================================
// PATCH /api/menu/:id
// UPDATE MENU ITEM
// ========================================

router.patch("/:id", async (req, res) => {
    try {

        const { id } = req.params;

        const {
            name,
            category,
            price,
            description,
            image,
            available
        } = req.body;


        // ========================================
        // VALIDATE ID
        // ========================================

        const { ObjectId } = require("mongodb");

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID."
            });
        }


        // ========================================
        // BUILD UPDATE
        // ========================================

        const updateFields = {};


        if (
            name !== undefined
        ) {

            if (
                typeof name !== "string" ||
                !name.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Menu item name cannot be empty."
                });
            }

            updateFields.name = name.trim();
        }


        if (
            category !== undefined
        ) {

            if (
                typeof category !== "string" ||
                !category.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Menu item category cannot be empty."
                });
            }

            updateFields.category =
                category.trim().toLowerCase();
        }


        if (
            price !== undefined
        ) {

            const normalizedPrice = Number(price);

            if (
                !Number.isFinite(normalizedPrice) ||
                normalizedPrice <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Menu item price must be greater than 0."
                });
            }

            updateFields.price = normalizedPrice;
        }


        if (
            description !== undefined
        ) {

            updateFields.description =
                typeof description === "string"
                    ? description.trim()
                    : "";
        }


        if (
            image !== undefined
        ) {

            updateFields.image =
                typeof image === "string"
                    ? image.trim()
                    : "";
        }


        if (
            available !== undefined
        ) {

            updateFields.available =
                Boolean(available);
        }


        // ========================================
        // UPDATED TIMESTAMP
        // ========================================

        updateFields.updatedAt = new Date();


        // ========================================
        // UPDATE DATABASE
        // ========================================

        const db = getDb();

        const result = await db
            .collection("menu")
            .updateOne(
                {
                    _id: new ObjectId(id)
                },
                {
                    $set: updateFields
                }
            );


        // ========================================
        // CHECK ITEM
        // ========================================

        if (result.matchedCount === 0) {

            return res.status(404).json({
                success: false,
                message: "Menu item not found."
            });
        }


        // ========================================
        // GET UPDATED ITEM
        // ========================================

        const updatedItem = await db
            .collection("menu")
            .findOne({
                _id: new ObjectId(id)
            });

            // ========================================
// SOCKET: MENU ITEM UPDATED
// ========================================

const io = req.app.get("io");

io.emit("menuUpdated", {
    action: "updated"
});

        return res.status(200).json({

            success: true,

            message: "Menu item updated successfully.",

            data: updatedItem

        });

    } catch (error) {

        console.error(
            "❌ Error updating menu item:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update menu item."
        });
    }
});


// ========================================
// DELETE /api/menu/:id
// DELETE MENU ITEM
// ========================================

router.delete("/:id", async (req, res) => {
    try {

        const { id } = req.params;

        const { ObjectId } = require("mongodb");


        // ========================================
        // VALIDATE ID
        // ========================================

        if (!ObjectId.isValid(id)) {

            return res.status(400).json({
                success: false,
                message: "Invalid menu item ID."
            });
        }


        // ========================================
        // DELETE ITEM
        // ========================================

        const db = getDb();

        const result = await db
            .collection("menu")
            .deleteOne({
                _id: new ObjectId(id)
            });


        // ========================================
        // CHECK RESULT
        // ========================================

        if (result.deletedCount !== 1) {

            return res.status(404).json({
                success: false,
                message: "Menu item not found."
            });
        }

        // ========================================
// SOCKET: MENU ITEM DELETED
// ========================================

const io = req.app.get("io");

io.emit("menuUpdated", {
    action: "deleted"
});

        return res.status(200).json({

            success: true,

            message: "Menu item deleted successfully."

        });

    } catch (error) {

        console.error(
            "❌ Error deleting menu item:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete menu item."
        });
    }
});


module.exports = router;