const express = require("express");

const router = express.Router();

const { getDb } = require("../config/db");

// ========================================
// GET /api/chefs-special
// GET ALL CHEF'S SPECIAL ITEMS
// ========================================

router.get("/", async (req, res) => {
    try {

        const db = getDb();

        const chefsSpecials = await db
            .collection("chefsSpecial")
            .find({})
            .sort({
                createdAt: -1
            })
            .toArray();

        return res.status(200).json({
            success: true,
            count: chefsSpecials.length,
            data: chefsSpecials
        });

    } catch (error) {

        console.error(
            "❌ Error fetching Chef's Special items:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch Chef's Special items."
        });
    }
});


// ========================================
// POST /api/chefs-special
// CREATE NEW CHEF'S SPECIAL ITEM
// ========================================

router.post("/", async (req, res) => {
    try {

        const {
            name,
            category,
            price,
            description,
            image,
            available
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
                message: "Chef's Special name is required."
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
                message: "Chef's Special category is required."
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
                message:
                    "Chef's Special price must be greater than 0."
            });
        }


        // ========================================
        // 4. NORMALIZE OTHER FIELDS
        // ========================================

        const normalizedDescription =
            typeof description === "string"
                ? description.trim()
                : "";

        const normalizedImage =
            typeof image === "string"
                ? image.trim()
                : "";

        const normalizedAvailable =
            available !== false;


        // ========================================
        // 5. CREATE DOCUMENT
        // ========================================

        const now = new Date();

        const newChefSpecial = {

            name: name.trim(),

            category:
                category.trim().toLowerCase(),

            price: normalizedPrice,

            description: normalizedDescription,

            image: normalizedImage,

            available: normalizedAvailable,

            createdAt: now,

            updatedAt: now
        };


        // ========================================
        // 6. SAVE TO MONGODB
        // ========================================

        const db = getDb();

        const result = await db
            .collection("chefsSpecial")
            .insertOne(newChefSpecial);



            const io = req.app.get("io");

io.emit("chefSpecialUpdated", {
    action: "added"
});
        // ========================================
        // 7. RETURN CREATED ITEM
        // ========================================

        return res.status(201).json({

            success: true,

            message:
                "Chef's Special created successfully.",

            data: {
                ...newChefSpecial,
                _id: result.insertedId
            }

        });

    } catch (error) {

        console.error(
            "❌ Error creating Chef's Special:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to create Chef's Special."
        });
    }
});


// ========================================
// PATCH /api/chefs-special/:id
// UPDATE CHEF'S SPECIAL ITEM
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

        const { ObjectId } = require("mongodb");


        // ========================================
        // 1. VALIDATE OBJECT ID
        // ========================================

        if (!ObjectId.isValid(id)) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid Chef's Special ID."
            });
        }


        const objectId = new ObjectId(id);


        // ========================================
        // 2. CHECK ITEM EXISTS
        // ========================================

        const db = getDb();

        const existingItem = await db
            .collection("chefsSpecial")
            .findOne({
                _id: objectId
            });


        if (!existingItem) {

            return res.status(404).json({
                success: false,
                message:
                    "Chef's Special item not found."
            });
        }


        // ========================================
        // 3. BUILD UPDATE
        // ========================================

        const updateFields = {};


        // NAME
        if (name !== undefined) {

            if (
                typeof name !== "string" ||
                !name.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Chef's Special name cannot be empty."
                });
            }

            updateFields.name = name.trim();
        }


        // CATEGORY
        if (category !== undefined) {

            if (
                typeof category !== "string" ||
                !category.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Chef's Special category cannot be empty."
                });
            }

            updateFields.category =
                category.trim().toLowerCase();
        }


        // PRICE
        if (price !== undefined) {

            const normalizedPrice =
                Number(price);

            if (
                !Number.isFinite(normalizedPrice) ||
                normalizedPrice <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Chef's Special price must be greater than 0."
                });
            }

            updateFields.price =
                normalizedPrice;
        }


        // DESCRIPTION
        if (description !== undefined) {

            updateFields.description =
                typeof description === "string"
                    ? description.trim()
                    : "";
        }


        // IMAGE
        if (image !== undefined) {

            updateFields.image =
                typeof image === "string"
                    ? image.trim()
                    : "";
        }


        // AVAILABLE
        if (available !== undefined) {

            updateFields.available =
                Boolean(available);
        }


        // ========================================
        // 4. UPDATED TIMESTAMP
        // ========================================

        updateFields.updatedAt =
            new Date();


        // ========================================
        // 5. UPDATE DATABASE
        // ========================================

        const result = await db
            .collection("chefsSpecial")
            .updateOne(
                {
                    _id: objectId
                },
                {
                    $set: updateFields
                }
            );


        // ========================================
        // 6. CHECK UPDATE
        // ========================================

        if (result.matchedCount === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Chef's Special item not found."
            });
        }


        // ========================================
        // 7. GET UPDATED ITEM
        // ========================================

        const updatedItem = await db
            .collection("chefsSpecial")
            .findOne({
                _id: objectId
            });


const io = req.app.get("io");

io.emit("chefSpecialUpdated", {
    action: "updated"
});

        // ========================================
        // 8. RETURN UPDATED ITEM
        // ========================================

        return res.status(200).json({

            success: true,

            message:
                "Chef's Special updated successfully.",

            data: updatedItem

        });

    } catch (error) {

        console.error(
            "❌ Error updating Chef's Special:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to update Chef's Special."
        });
    }
});


// ========================================
// DELETE /api/chefs-special/:id
// DELETE CHEF'S SPECIAL ITEM
// ========================================

router.delete("/:id", async (req, res) => {
    try {

        const { id } = req.params;

        const { ObjectId } = require("mongodb");


        // ========================================
        // 1. VALIDATE OBJECT ID
        // ========================================

        if (!ObjectId.isValid(id)) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid Chef's Special ID."
            });
        }


        // ========================================
        // 2. DELETE ITEM
        // ========================================

        const db = getDb();

        const result = await db
            .collection("chefsSpecial")
            .deleteOne({
                _id: new ObjectId(id)
            });


        // ========================================
        // 3. CHECK RESULT
        // ========================================

        if (result.deletedCount !== 1) {

            return res.status(404).json({
                success: false,
                message:
                    "Chef's Special item not found."
            });
        }


        const io = req.app.get("io");

io.emit("chefSpecialUpdated", {
    action: "deleted"
});

        // ========================================
        // 4. RETURN SUCCESS
        // ========================================



        return res.status(200).json({

            success: true,

            message:
                "Chef's Special deleted successfully."

        });

    } catch (error) {

        console.error(
            "❌ Error deleting Chef's Special:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to delete Chef's Special."
        });
    }
});


module.exports = router;