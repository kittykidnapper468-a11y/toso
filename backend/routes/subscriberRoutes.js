const express = require("express");

const router = express.Router();

const { getDb } = require("../config/db");


// ========================================
// GET /api/subscribers
// GET ALL SUBSCRIBERS
// ========================================

router.get("/", async (req, res) => {
    try {

        const db = getDb();

        const subscribers = await db
            .collection("subscribers")
            .find({})
            .sort({
                createdAt: -1
            })
            .toArray();

        return res.status(200).json({
            success: true,
            count: subscribers.length,
            data: subscribers
        });

    } catch (error) {

        console.error(
            "❌ Error fetching subscribers:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch subscribers."
        });
    }
});


// ========================================
// POST /api/subscribers
// CREATE NEW SUBSCRIBER
// ========================================

router.post("/", async (req, res) => {
    try {

        const { email } = req.body;


        // ========================================
        // 1. VALIDATE EMAIL
        // ========================================

        if (
            !email ||
            typeof email !== "string" ||
            !email.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }


        const normalizedEmail =
            email.trim().toLowerCase();


        // ========================================
        // 2. BASIC EMAIL VALIDATION
        // ========================================

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }


        const db = getDb();


        // ========================================
        // 3. CHECK DUPLICATE EMAIL
        // ========================================

        const existingSubscriber = await db
            .collection("subscribers")
            .findOne({
                email: normalizedEmail
            });


        if (existingSubscriber) {
            return res.status(409).json({
                success: false,
                message: "This email is already subscribed."
            });
        }


        // ========================================
        // 4. CREATE SUBSCRIBER
        // ========================================

        const now = new Date();

        const newSubscriber = {
            email: normalizedEmail,
            createdAt: now,
            updatedAt: now
        };


        // ========================================
        // 5. SAVE TO MONGODB
        // ========================================

        const result = await db
            .collection("subscribers")
            .insertOne(newSubscriber);

        // ========================================
// SOCKET: NEW SUBSCRIBER
// ========================================

const io = req.app.get("io");

io.emit("subscriberUpdated", {
    action: "added"
});


        // ========================================
        // 6. RETURN SUCCESS
        // ========================================

        return res.status(201).json({
            success: true,
            message: "Subscribed successfully.",
            data: {
                ...newSubscriber,
                _id: result.insertedId
            }
        });

    } catch (error) {

        console.error(
            "❌ Error creating subscriber:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to subscribe."
        });
    }
});


// ========================================
// DELETE /api/subscribers/:id
// DELETE SUBSCRIBER
// ========================================

router.delete("/:id", async (req, res) => {
    try {

        const { id } = req.params;

        const { ObjectId } = require("mongodb");


        // ========================================
        // 1. VALIDATE ID
        // ========================================

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid subscriber ID."
            });
        }


        const db = getDb();


        // ========================================
        // 2. DELETE SUBSCRIBER
        // ========================================

        const result = await db
            .collection("subscribers")
            .deleteOne({
                _id: new ObjectId(id)
            });


        if (result.deletedCount !== 1) {
            return res.status(404).json({
                success: false,
                message: "Subscriber not found."
            });
        }


        return res.status(200).json({
            success: true,
            message: "Subscriber deleted successfully."
        });

    } catch (error) {

        console.error(
            "❌ Error deleting subscriber:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete subscriber."
        });
    }
});


module.exports = router;