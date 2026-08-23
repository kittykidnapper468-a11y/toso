const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");

const router = express.Router();
const { getDb } = require("../config/db");

// ========================================
// JWT SECRET
// ========================================

const JWT_SECRET = process.env.RIDER_JWT_SECRET;

if (!JWT_SECRET) {
    console.warn(
        "⚠️ RIDER_JWT_SECRET is not defined."
    );
}


// ========================================
// AUTH MIDDLEWARE
// ========================================

function authenticateRider(req, res, next) {

    try {

        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        if (!JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message:
                    "Rider authentication is not configured."
            });
        }

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        if (
            !decoded ||
            decoded.role !== "rider" ||
            !decoded.riderId
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid rider authentication."
            });
        }

        req.rider = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message:
                "Invalid or expired rider session."
        });
    }
}


// ========================================
// GET /api/riders
// ADMIN: GET ALL RIDERS
// ========================================

router.get("/", async (req, res) => {

    try {

        const db = getDb();

        const riders = await db
    .collection("riders")
    .find({})
    .sort({
        createdAt: -1
    })
    .project({
        passwordHash: 0
    })
    .toArray();

const onlineRiders =
    req.app.get("onlineRiders");

const ridersWithPresence =
    riders.map(rider => ({
        ...rider,

        isOnline:
            onlineRiders
                ? onlineRiders.has(
                    rider._id.toString()
                )
                : false
    }));

        return res.status(200).json({
            success: true,
            count: riders.length,
            data: ridersWithPresence
        });

    } catch (error) {

        console.error(
            "❌ Error fetching riders:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch riders."
        });
    }
});


// ========================================
// POST /api/riders
// ADMIN: CREATE RIDER
// ========================================

router.post("/", async (req, res) => {

    try {

        const {
            name,
            password,
            image,
            available
        } = req.body;


        // ========================================
        // VALIDATE NAME
        // ========================================

        if (
            !name ||
            typeof name !== "string" ||
            !name.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Rider name is required."
            });
        }

        const normalizedName = name.trim();


        // ========================================
        // VALIDATE PASSWORD
        // ========================================

        if (
            !password ||
            typeof password !== "string" ||
            password.length < 6
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Password must be at least 6 characters."
            });
        }


        // ========================================
        // GET DATABASE
        // ========================================

        const db = getDb();


        // ========================================
        // CHECK DUPLICATE RIDER NAME
        // CASE-INSENSITIVE
        // ========================================

        const existingRider = await db
            .collection("riders")
            .findOne({
                name: {
                    $regex: `^${escapeRegex(normalizedName)}$`,
                    $options: "i"
                }
            });

        if (existingRider) {

            return res.status(409).json({
                success: false,
                message:
                    "A rider with this name already exists."
            });
        }


        // ========================================
        // HASH PASSWORD
        // ========================================

        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );


        // ========================================
        // CREATE RIDER ID
        // ========================================

        const riderId =
            `RID-${Date.now().toString(36).toUpperCase()}`;

        const now = new Date();


        // ========================================
        // PREPARE RIDER DOCUMENT
        // ========================================

        const newRider = {

            riderId,

            name: normalizedName,

            passwordHash,

            image:
                typeof image === "string"
                    ? image.trim()
                    : "",

            available:
                available !== false,

            createdAt: now,

            updatedAt: now
        };


        // ========================================
        // SAVE TO MONGODB
        // ========================================

        const result = await db
            .collection("riders")
            .insertOne(newRider);


        // ========================================
        // SOCKET: RIDERS UPDATED
        // ========================================

        const io = req.app.get("io");

        if (io) {
            io.emit("ridersUpdated", {
                action: "added"
            });
        }


        // ========================================
        // RETURN WITHOUT PASSWORD
        // ========================================

        const createdRider = {

            _id: result.insertedId,

            riderId:
                newRider.riderId,

            name:
                newRider.name,

            image:
                newRider.image,

            available:
                newRider.available,

            createdAt:
                newRider.createdAt,

            updatedAt:
                newRider.updatedAt
        };


        return res.status(201).json({

            success: true,

            message:
                "Rider created successfully.",

            data:
                createdRider
        });


    } catch (error) {

        console.error(
            "❌ Error creating rider:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to create rider."
        });
    }
});


// ========================================
// POST /api/riders/login
// RIDER LOGIN
// ========================================

router.post("/login", async (req, res) => {

    try {

        const {
            name,
            password
        } = req.body;


        // ========================================
        // VALIDATION
        // ========================================

        if (
            !name ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Name and password are required."
            });
        }


        const normalizedName = name.trim();

        const db = getDb();




const rider = await db
    .collection("riders")
    .findOne({
        name: normalizedName
    });


        // ========================================
        // RIDER NOT FOUND
        // ========================================

        if (!rider) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid name or password."
            });
        }


        // ========================================
        // CHECK AVAILABILITY
        // ========================================

        if (
            rider.available === false
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "This rider is currently unavailable."
            });
        }


        // ========================================
        // CHECK PASSWORD
        // ========================================

        const passwordMatches =
            await bcrypt.compare(
                password,
                rider.passwordHash
            );

        if (!passwordMatches) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid name or password."
            });
        }


        // ========================================
        // JWT CONFIGURATION CHECK
        // ========================================

        if (!JWT_SECRET) {

            return res.status(500).json({
                success: false,
                message:
                    "Rider authentication is not configured."
            });
        }


        // ========================================
        // CREATE JWT
        // ========================================

        const token =
            jwt.sign(

                {
                    riderId:
                        rider._id.toString(),

                    riderCode:
                        rider.riderId,

                    role:
                        "rider"
                },

                JWT_SECRET,

                {
                    expiresIn: "7d"
                }
            );


        // ========================================
        // RETURN RIDER
        // ========================================

        return res.status(200).json({

            success: true,

            message:
                "Rider login successful.",

            token,

            rider: {

                id:
                    rider._id,

                riderId:
                    rider.riderId,

                name:
                    rider.name,

                image:
                    rider.image || "",

                available:
                    rider.available !== false
            }
        });


    } catch (error) {

        console.error(
            "❌ Rider login error:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to login rider."
        });
    }
});


// ========================================
// GET /api/riders/me
// GET LOGGED-IN RIDER
// ========================================

router.get(
    "/me",
    authenticateRider,
    async (req, res) => {

        try {

            const db = getDb();

            const rider =
                await db
                    .collection("riders")
                    .findOne(

                        {
                            _id:
                                new ObjectId(
                                    req.rider.riderId
                                )
                        },

                        {
                            projection: {
                                passwordHash: 0
                            }
                        }
                    );


            // ========================================
            // RIDER NOT FOUND
            // ========================================

            if (!rider) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Rider account not found."
                });
            }


            // ========================================
            // RIDER AVAILABLE CHECK
            // ========================================

            if (
                rider.available === false
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "This rider account is unavailable."
                });
            }


            return res.status(200).json({

                success: true,

                data: rider
            });


        } catch (error) {

            console.error(
                "❌ Error fetching rider profile:"
            );

            console.error(error);

            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch rider profile."
            });
        }
    }
);


// ========================================
// GET /api/riders/my-orders
// RIDER: GET ONLY MY ASSIGNED ORDERS
// ========================================

router.get(
    "/my-orders",
    authenticateRider,
    async (req, res) => {

        try {

            const db = getDb();

            const riderId =
                new ObjectId(
                    req.rider.riderId
                );

            const orders = await db
                .collection("orders")
                .find({
                    riderId: riderId,

                    state: {
                        $ne: "cancelled"
                    },

                    status: {
                        $ne: "completed"
                    }
                })
                .sort({
                    assignedAt: -1
                })
                .toArray();

            return res.status(200).json({
                success: true,
                count: orders.length,
                data: orders
            });

        } catch (error) {

            console.error(
                "❌ Error fetching rider orders:"
            );

            console.error(error);

            return res.status(500).json({
                success: false,
                message:
                    "Failed to fetch rider orders."
            });
        }
    }
);

// ========================================
// PATCH /api/riders/:id
// ADMIN: UPDATE RIDER
// ========================================

router.patch("/:id", async (req, res) => {

    try {

        const {
            id
        } = req.params;


        // ========================================
        // VALIDATE OBJECT ID
        // ========================================

        if (
            !ObjectId.isValid(id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid rider ID."
            });
        }


        const {
            name,
            password,
            image,
            available
        } = req.body;


        const db = getDb();

        const objectId =
            new ObjectId(id);


        // ========================================
        // FIND EXISTING RIDER
        // ========================================

        const existingRider =
            await db
                .collection("riders")
                .findOne({
                    _id: objectId
                });


        if (!existingRider) {

            return res.status(404).json({

                success: false,

                message:
                    "Rider not found."
            });
        }


        const updateFields = {};


        // ========================================
        // NAME
        // ========================================

        if (
            name !== undefined
        ) {

            if (
                typeof name !== "string" ||
                !name.trim()
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Rider name cannot be empty."
                });
            }


            const normalizedName =
                name.trim();


            // ========================================
            // DUPLICATE NAME CHECK
            // CASE-INSENSITIVE
            // ========================================

            const duplicate =
                await db
                    .collection("riders")
                    .findOne({

                        name: {
                            $regex:
                                `^${escapeRegex(normalizedName)}$`,
                            $options: "i"
                        },

                        _id: {
                            $ne: objectId
                        }
                    });


            if (duplicate) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Another rider with this name already exists."
                });
            }


            updateFields.name =
                normalizedName;
        }


        // ========================================
        // PASSWORD
        // ========================================

        if (
            password !== undefined
        ) {

            if (
                typeof password !== "string" ||
                password.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must be at least 6 characters."
                });
            }


            updateFields.passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );
        }


        // ========================================
        // IMAGE
        // ========================================

        if (
            image !== undefined
        ) {

            updateFields.image =
                typeof image === "string"
                    ? image.trim()
                    : "";
        }


        // ========================================
        // AVAILABILITY
        // ========================================

        if (
            available !== undefined
        ) {

            updateFields.available =
                Boolean(available);
        }


        // ========================================
        // UPDATED TIME
        // ========================================

        updateFields.updatedAt =
            new Date();


        // ========================================
        // UPDATE DATABASE
        // ========================================

        const result =
            await db
                .collection("riders")
                .updateOne(

                    {
                        _id: objectId
                    },

                    {
                        $set:
                            updateFields
                    }
                );


        // ========================================
        // CHECK UPDATE
        // ========================================

        if (
            result.matchedCount !== 1
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Rider not found."
            });
        }


        // ========================================
        // SOCKET
        // ========================================

        const io =
            req.app.get("io");

        if (io) {

            io.emit(
                "ridersUpdated",
                {
                    action:
                        "updated"
                }
            );
        }


        // ========================================
        // GET UPDATED RIDER
        // ========================================

        const updatedRider =
            await db
                .collection("riders")
                .findOne(

                    {
                        _id:
                            objectId
                    },

                    {
                        projection: {
                            passwordHash: 0
                        }
                    }
                );


        return res.status(200).json({

            success: true,

            message:
                "Rider updated successfully.",

            data:
                updatedRider
        });


    } catch (error) {

        console.error(
            "❌ Error updating rider:"
        );

        console.error(error);

        return res.status(500).json({

            success: false,

            message:
                "Failed to update rider."
        });
    }
});


// ========================================
// DELETE /api/riders/:id
// ADMIN: DELETE RIDER
// ========================================

router.delete("/:id", async (req, res) => {

    try {

        const {
            id
        } = req.params;


        // ========================================
        // VALIDATE OBJECT ID
        // ========================================

        if (
            !ObjectId.isValid(id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid rider ID."
            });
        }


        const db = getDb();


        // ========================================
        // DELETE RIDER
        // ========================================

        const result =
            await db
                .collection("riders")
                .deleteOne({

                    _id:
                        new ObjectId(id)
                });


        // ========================================
        // CHECK RESULT
        // ========================================

        if (
            result.deletedCount !== 1
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Rider not found."
            });
        }


        // ========================================
        // SOCKET
        // ========================================

        const io =
            req.app.get("io");

        if (io) {

            io.emit(
                "ridersUpdated",
                {
                    action:
                        "deleted"
                }
            );
        }


        return res.status(200).json({

            success: true,

            message:
                "Rider deleted successfully."
        });


    } catch (error) {

        console.error(
            "❌ Error deleting rider:"
        );

        console.error(error);

        return res.status(500).json({

            success: false,

            message:
                "Failed to delete rider."
        });
    }
});


// ========================================
// HELPER
// ESCAPE REGEX SPECIAL CHARACTERS
// ========================================

function escapeRegex(value) {

    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


// ========================================
// EXPORT
// ========================================

module.exports = {
    router,
    authenticateRider
};