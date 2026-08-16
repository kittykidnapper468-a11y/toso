const express = require("express");

const router = express.Router();

const { getDb } = require("../config/db");

// ========================================
// GET /api/inquiries
// GET ALL CUSTOMER INQUIRIES
// ========================================

router.get("/", async (req, res) => {
    try {

        const db = getDb();

        const inquiries = await db
            .collection("inquiries")
            .find({})
            .sort({
                createdAt: -1
            })
            .toArray();

        return res.status(200).json({
            success: true,
            count: inquiries.length,
            data: inquiries
        });

    } catch (error) {

        console.error(
            "❌ Error fetching inquiries:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch inquiries."
        });
    }
});


// ========================================
// POST /api/inquiries
// CREATE NEW CUSTOMER INQUIRY
// ========================================

router.post("/", async (req, res) => {
    try {

        const {
    name,
    phone,
    email,
    subject,
    message
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
                message: "Name is required."
            });
        }


        // ========================================
        // 2. VALIDATE EMAIL
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


         // ========================================
// VALIDATE PHONE
// ========================================

if (
    !phone ||
    typeof phone !== "string" ||
    !phone.trim()
) {
    return res.status(400).json({
        success: false,
        message: "Phone number is required."
    });
}

        // ========================================
        // 3. VALIDATE MESSAGE
        // ========================================

        if (
            !message ||
            typeof message !== "string" ||
            !message.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Message is required."
            });
        }


        // ========================================
        // 4. PREPARE DOCUMENT
        // ========================================

        const now = new Date();

        const newInquiry = {

    name: name.trim(),

    phone: phone.trim(),

    email: email.trim(),

    subject:
        typeof subject === "string"
            ? subject.trim()
            : "",

    message: message.trim(),

    createdAt: now,

    updatedAt: now
};


        // ========================================
        // 5. SAVE TO MONGODB
        // ========================================

        const db = getDb();

        const result = await db
            .collection("inquiries")
            .insertOne(newInquiry);


// ========================================
// SOCKET: NEW INQUIRY
// ========================================

const io = req.app.get("io");

io.emit("inquiryUpdated", {
    action: "added"
});

        // ========================================
        // 6. RETURN SUCCESS
        // ========================================

        return res.status(201).json({

            success: true,

            message: "Inquiry submitted successfully.",

            data: {
                ...newInquiry,
                _id: result.insertedId
            }

        });

    } catch (error) {

        console.error(
            "❌ Error creating inquiry:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to submit inquiry."
        });
    }
});


// ========================================
// DELETE /api/inquiries/:id
// DELETE INQUIRY FROM DASHBOARD
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
                message: "Invalid inquiry ID."
            });
        }


        // ========================================
        // 2. DELETE INQUIRY
        // ========================================

        const db = getDb();

        const result = await db
            .collection("inquiries")
            .deleteOne({
                _id: new ObjectId(id)
            });


        // ========================================
        // 3. CHECK RESULT
        // ========================================

        if (result.deletedCount !== 1) {

            return res.status(404).json({
                success: false,
                message: "Inquiry not found."
            });
        }


        return res.status(200).json({

            success: true,

            message: "Inquiry deleted successfully."

        });

    } catch (error) {

        console.error(
            "❌ Error deleting inquiry:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete inquiry."
        });
    }
});


module.exports = router;