const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const { getDb } = require("../config/db");

// ========================================
// POST /api/orders
// CREATE NEW ORDER
// ========================================

router.post("/", async (req, res) => {
try {
const {
customerId,
customer,
orderType,
items,
address,
notes
} = req.body;

    // ========================================
    // 1. CUSTOMER ID
    // ========================================

    // Temporary:
    // The frontend will send the real customerId
    // after we connect the My Orders system.
    //
    // For now, if it is not provided, we store null.

    const normalizedCustomerId =
        typeof customerId === "string" &&
        customerId.trim()
            ? customerId.trim()
            : null;

    // ========================================
    // 2. VALIDATE CUSTOMER
    // ========================================

    if (!customer) {
        return res.status(400).json({
            success: false,
            message: "Customer information is required."
        });
    }

    if (
        !customer.name ||
        typeof customer.name !== "string" ||
        !customer.name.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Customer name is required."
        });
    }

    if (
        !customer.phone ||
        typeof customer.phone !== "string" ||
        !customer.phone.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Customer phone number is required."
        });
    }

    // ========================================
    // 3. VALIDATE ORDER TYPE
    // ========================================

    const normalizedOrderType =
        typeof orderType === "string"
            ? orderType.toLowerCase().trim()
            : "";

    const allowedOrderTypes = [
        "delivery",
        "dine_in",
        "takeaway"
    ];

    if (!allowedOrderTypes.includes(normalizedOrderType)) {
        return res.status(400).json({
            success: false,
            message:
                "Valid orderType is required: delivery, dine_in, or takeaway."
        });
    }

    // ========================================
    // 4. VALIDATE ITEMS
    // ========================================

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Order must contain at least one item."
        });
    }

    // ========================================
    // 5. VALIDATE DELIVERY ADDRESS
    // ========================================

    if (normalizedOrderType === "delivery") {
        if (
            !address ||
            typeof address.text !== "string" ||
            !address.text.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Delivery address is required for delivery orders."
            });
        }
    }

    // ========================================
    // 6. PROCESS ORDER ITEMS
    // ========================================

    let subtotal = 0;

    const validatedItems = [];

    for (const item of items) {
        if (!item || typeof item !== "object") {
            return res.status(400).json({
                success: false,
                message: "Invalid order item."
            });
        }

        if (
            !item.name ||
            typeof item.name !== "string" ||
            !item.name.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Every order item must have a name."
            });
        }

        const price = Number(item.price);
        const quantity = Number(item.quantity);

        if (!Number.isFinite(price) || price < 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid price for item: ${item.name}`
            });
        }

        if (
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            return res.status(400).json({
                success: false,
                message: `Invalid quantity for item: ${item.name}`
            });
        }

        const itemTotal = price * quantity;

        subtotal += itemTotal;

        validatedItems.push({
            productId: item.productId || null,
            name: item.name.trim(),
            price,
            quantity,
            itemTotal
        });
    }

    // ========================================
    // 7. CALCULATE DELIVERY FEE
    // ========================================

    const deliveryFee =
        normalizedOrderType === "delivery"
            ? 150
            : 0;

    const total = subtotal + deliveryFee;

    // ========================================
    // 8. GENERATE ORDER NUMBER
    // ========================================

    const randomPart = crypto
        .randomInt(100000, 1000000)
        .toString();

    const orderNumber = `TOSO-${randomPart}`;

    const createdAt = new Date();

    // ========================================
    // 9. PREPARE ADDRESS
    // ========================================

    let formattedAddress = null;

    if (normalizedOrderType === "delivery") {
        formattedAddress = {
            text: address.text.trim(),

            latitude:
                address.latitude !== undefined &&
                address.latitude !== null
                    ? Number(address.latitude)
                    : null,

            longitude:
                address.longitude !== undefined &&
                address.longitude !== null
                    ? Number(address.longitude)
                    : null
        };
    }

    // ========================================
    // 10. CREATE ORDER DOCUMENT
    // ========================================

    const newOrder = {
        orderNumber,

        // Anonymous customer identifier.
        // Currently null until frontend sends it.
        customerId: normalizedCustomerId,

        customer: {
            name: customer.name.trim(),

            phone: customer.phone.trim(),

            email:
                customer.email &&
                typeof customer.email === "string"
                    ? customer.email.trim()
                    : null
        },

        orderType: normalizedOrderType,

        items: validatedItems,

        pricing: {
            subtotal,
            deliveryFee,
            total
        },

        address: formattedAddress,

        notes:
            typeof notes === "string"
                ? notes.trim()
                : "",

        // ====================================
        // RESTAURANT CONTROLLED
        // ====================================

        status: "pending",

        // ====================================
        // CUSTOMER / ORDER LIFECYCLE
        // ====================================

        state: "active",

        createdAt,

        updatedAt: createdAt
    };

    // ========================================
    // 11. SAVE ORDER TO MONGODB
    // ========================================

    const db = getDb();

    const result = await db
        .collection("orders")
        .insertOne(newOrder);


        // ========================================
// SOCKET: NEW ORDER
// ========================================

const io = req.app.get("io");

io.emit("newOrder", {
    orderNumber: newOrder.orderNumber,
    customerId: newOrder.customerId,
    customer: newOrder.customer,
    orderType: newOrder.orderType,
    total: newOrder.pricing.total
});
    // ========================================
    // 12. SEND RESPONSE
    // ========================================

    return res.status(201).json({
        success: true,

        message: "Order placed successfully.",

        data: {
            id: result.insertedId,

            orderNumber: newOrder.orderNumber,

            status: newOrder.status,

            state: newOrder.state,

            pricing: newOrder.pricing,

            createdAt: newOrder.createdAt
        }
    });

} catch (error) {
    console.error(
        "❌ Error saving order to MongoDB:"
    );

    console.error(error);

    return res.status(500).json({
        success: false,
        message: "Failed to process and save order."
    });
}


});

// ========================================
// GET /api/orders
// GET ALL ORDERS FOR RESTAURANT DASHBOARD
// ========================================

router.get("/", async (req, res) => {
try {
const db = getDb();

    // Fetch all orders from MongoDB
    const orders = await db
        .collection("orders")
        .find({})
        .sort({
            createdAt: -1
        })
        .toArray();

    return res.status(200).json({
        success: true,
        count: orders.length,
        data: orders
    });

} catch (error) {
    console.error(
        "❌ Error fetching all orders:"
    );

    console.error(error);

    return res.status(500).json({
        success: false,
        message: "Failed to fetch orders."
    });
}


});

// ========================================
// GET /api/orders/customer/:customerId
// GET ALL ORDERS FOR A CUSTOMER
// ========================================

router.get("/customer/:customerId", async (req, res) => {
try {
const { customerId } = req.params;

    // Validate customer ID
    if (
        !customerId ||
        typeof customerId !== "string" ||
        !customerId.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Customer ID is required."
        });
    }

    const db = getDb();

    // Find all orders belonging to this customer
    const orders = await db
        .collection("orders")
        .find({
            customerId: customerId.trim()
        })
        .sort({
            createdAt: -1
        })
        .toArray();

    return res.status(200).json({
        success: true,
        count: orders.length,
        data: orders
    });

} catch (error) {
    console.error(
        "❌ Error fetching customer orders:"
    );

    console.error(error);

    return res.status(500).json({
        success: false,
        message: "Failed to fetch customer orders."
    });
}


});

// ========================================
// PATCH /api/orders/:orderNumber/status
// UPDATE RESTAURANT ORDER STATUS
// ========================================

router.patch("/:orderNumber/status", async (req, res) => {
try {
const { orderNumber } = req.params;
const { status } = req.body;

    // ========================================
    // 1. VALIDATE ORDER NUMBER
    // ========================================

    if (
        !orderNumber ||
        typeof orderNumber !== "string" ||
        !orderNumber.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Order number is required."
        });
    }

    // ========================================
    // 2. VALIDATE STATUS
    // ========================================

    const allowedStatuses = [
"pending",
"confirmed",
"preparing",
"ready",
"out_for_delivery",
"completed",
"cancelled"


];

    const normalizedStatus =
        typeof status === "string"
            ? status.toLowerCase().trim()
            : "";

    if (!allowedStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
            success: false,
            message:
                "Invalid status. Allowed statuses are: pending, confirmed, preparing, ready, out_for_delivery, completed."
        });
    }

    // ========================================
    // 3. GET DATABASE
    // ========================================

    const db = getDb();

    // ========================================
    // 4. FIND ORDER
    // ========================================

    const order = await db
        .collection("orders")
        .findOne({
            orderNumber: orderNumber.trim()
        });

    if (!order) {
        return res.status(404).json({
            success: false,
            message: "Order not found."
        });
    }


// ========================================
// DON'T UPDATE RESTAURANT-CANCELLED ORDERS
// ========================================

// ========================================
// 5. DON'T UPDATE LOCKED ORDERS
// ========================================

// ========================================
// 5. DON'T UPDATE LOCKED ORDERS
// ========================================

if (
    order.status === "cancelled" ||
    order.status === "completed"
) {
    return res.status(409).json({
        success: false,
        message:
            order.status === "completed"
                ? "Completed orders cannot have their status changed."
                : "Cancelled orders cannot have their status changed."
    });
}

// ========================================
// 6. UPDATE STATUS
// ========================================

const updatedAt = new Date();

const result = await db
    .collection("orders")
    .updateOne(
        {
            _id: order._id,
            status: {
                $nin: ["cancelled", "completed"]
            }
        },
        {
            $set: {
                status: normalizedStatus,
                updatedAt
            }
        }
    );

    // ========================================
// SOCKET: ORDER STATUS UPDATED
// ========================================

const io = req.app.get("io");

if (io) {

    // ========================================
    // CUSTOMER STATUS UPDATE
    // ========================================

    if (order.customerId) {

        io.to(`customer:${order.customerId}`).emit(
            "orderStatusUpdated",
            {
                orderNumber:
                    order.orderNumber,

                status:
                    normalizedStatus
            }
        );
    }

    // ========================================
    // DASHBOARD STATUS UPDATE
    // ========================================

    io.emit(
        "dashboardOrderStatusUpdated",
        {
            orderNumber:
                order.orderNumber,

            status:
                normalizedStatus,

            customerId:
                order.customerId
        }
    );
}

    // ========================================
    // 7. CHECK UPDATE
    // ========================================

    if (result.modifiedCount !== 1) {
        return res.status(409).json({
            success: false,
            message:
                "Order status could not be updated."
        });
    }

      // ========================================
// RIDER COMPLETED ORDER
// ========================================

if (
    normalizedStatus === "completed" &&
    order.riderId
) {

    const io = req.app.get("io");

    if (io) {

        io.emit("riderOrderCompleted", {
            orderNumber: order.orderNumber,

            riderId:
                order.riderId.toString
                    ? order.riderId.toString()
                    : order.riderId,

            riderName:
                order.riderName || "Unknown Rider"
        });

    }
}

    // ========================================
    // 8. RETURN UPDATED ORDER
    // ========================================

    return res.status(200).json({
        success: true,
        message: "Order status updated successfully.",
        data: {
            orderNumber: order.orderNumber,
            status: normalizedStatus,
            state: order.state,
            updatedAt
        }
    });

} catch (error) {
    console.error(
        "❌ Error updating order status:"
    );

    console.error(error);

    return res.status(500).json({
        success: false,
        message:
            "Failed to update order status."
    });
}


});


// ========================================
// PATCH /api/orders/:orderNumber/cancel
// CUSTOMER CANCELS ORDER
//
// IMPORTANT:
// - Changes ONLY state
// - NEVER changes status
// - NO cancellation rules
// ========================================

router.patch("/:orderNumber/cancel", async (req, res) => {
    try {
        const { orderNumber } = req.params;

        // ========================================
        // 1. VALIDATE ORDER NUMBER
        // ========================================

        if (
            !orderNumber ||
            typeof orderNumber !== "string" ||
            !orderNumber.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Order number is required."
            });
        }

        const db = getDb();

        // ========================================
        // 2. FIND ORDER
        // ========================================

        const order = await db
            .collection("orders")
            .findOne({
                orderNumber: orderNumber.trim()
            });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        // ========================================
        // 3. UPDATE ONLY STATE
        //
        // IMPORTANT:
        // STATUS IS NEVER TOUCHED.
        // ========================================

        const updatedAt = new Date();

        const result = await db
            .collection("orders")
            .updateOne(
                {
                    _id: order._id
                },
                {
                    $set: {
                        state: "cancelled",
                        updatedAt
                    }
                }
            );

            // ========================================
// SOCKET: CUSTOMER CANCELLED ORDER
// ========================================

const io = req.app.get("io");

io.emit("orderCancelled", {
    orderNumber: order.orderNumber,
    customerId: order.customerId
});

        // ========================================
        // 4. CHECK UPDATE
        // ========================================

        if (result.modifiedCount !== 1) {
            return res.status(409).json({
                success: false,
                message:
                    "Order state could not be updated."
            });
        }

        // ========================================
        // 5. RETURN SUCCESS
        // ========================================

        return res.status(200).json({
            success: true,
            message: "Order cancelled by customer.",
            data: {
                orderNumber: order.orderNumber,

                // STATUS REMAINS EXACTLY AS IT WAS
                status: order.status,

                // CUSTOMER CHANGES STATE
                state: "cancelled",

                updatedAt
            }
        });

    } catch (error) {

        console.error(
            "❌ Error cancelling order from customer:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to cancel the order."
        });
    }
});

// ========================================
// PATCH /api/orders/:orderNumber/restaurant-cancel
// CANCEL ORDER FROM RESTAURANT DASHBOARD
// ========================================

router.patch("/:orderNumber/restaurant-cancel", async (req, res) => {
try {
const { orderNumber } = req.params;

    // ========================================
    // 1. VALIDATE ORDER NUMBER
    // ========================================

    if (
        !orderNumber ||
        typeof orderNumber !== "string" ||
        !orderNumber.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Order number is required."
        });
    }

    const db = getDb();

    // ========================================
    // 2. FIND ORDER
    // ========================================

    const order = await db
        .collection("orders")
        .findOne({
            orderNumber: orderNumber.trim()
        });

    if (!order) {
        return res.status(404).json({
            success: false,
            message: "Order not found."
        });
    }

    // ========================================
    // 3. CHECK IF ALREADY CANCELLED
    // ========================================

    if (order.status === "cancelled") {
        return res.status(400).json({
            success: false,
            message: "This order has already been cancelled."
        });
    }

    // ========================================
    // 4. RESTAURANT CANCELS THE ORDER
    //
    // IMPORTANT:
    // ONLY STATUS CHANGES.
    //
    // STATE IS NOT TOUCHED.
    // ========================================

    const updatedAt = new Date();

    const result = await db
        .collection("orders")
        .updateOne(
            {
                _id: order._id,
                status: {
                    $ne: "cancelled"
                }
            },
            {
                $set: {
                    status: "cancelled",
                    updatedAt
                }
            }
        );

    // ========================================
    // 5. CHECK UPDATE
    // ========================================

    if (result.modifiedCount !== 1) {
        return res.status(409).json({
            success: false,
            message:
                "Order could not be cancelled. Please try again."
        });
    }

    // ========================================
// SOCKET: RESTAURANT CANCELLED ORDER
// ========================================

const io = req.app.get("io");

io.to(`customer:${order.customerId}`).emit(
    "orderStatusUpdated",
    {
        orderNumber: order.orderNumber,
        status: "cancelled"
    }
);

    // ========================================
    // 6. RETURN SUCCESS
    // ========================================

    return res.status(200).json({
        success: true,
        message: "Order cancelled by restaurant successfully.",
        data: {
            orderNumber: order.orderNumber,

            // Restaurant cancellation changes STATUS
            status: "cancelled",

            // Customer state remains untouched
            state: order.state,

            updatedAt
        }
    });

} catch (error) {

    console.error(
        "❌ Error cancelling order from restaurant dashboard:"
    );

    console.error(error);

    return res.status(500).json({
        success: false,
        message:
            "Failed to cancel the order from restaurant dashboard."
    });
}


});

// ========================================
// PATCH /api/orders/:orderNumber/assign-rider
// ADMIN: ASSIGN ORDER TO RIDER
// ========================================

router.patch("/:orderNumber/assign-rider", async (req, res) => {

    try {

        const { orderNumber } = req.params;
        const { riderId } = req.body;

        // ========================================
        // VALIDATE RIDER ID
        // ========================================

        if (!riderId) {

            return res.status(400).json({
                success: false,
                message: "Rider ID is required."
            });

        }

        const { ObjectId } = require("mongodb");

        if (!ObjectId.isValid(riderId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid rider ID."
            });

        }

        const db = getDb();

        // ========================================
        // FIND ORDER
        // ========================================

        const order = await db
            .collection("orders")
            .findOne({
                orderNumber
            });

        if (!order) {

            return res.status(404).json({
                success: false,
                message: "Order not found."
            });

        }

        // ========================================
        // DON'T ASSIGN COMPLETED ORDERS
        // ========================================

        if (
            order.status === "completed" ||
            order.state === "cancelled" ||
            order.status === "cancelled"
        ) {

            return res.status(409).json({
                success: false,
                message:
                    "Completed or cancelled orders cannot be assigned."
            });

        }

        // ========================================
        // FIND RIDER
        // ========================================

        const rider = await db
            .collection("riders")
            .findOne({
                _id: new ObjectId(riderId)
            });

        if (!rider) {

            return res.status(404).json({
                success: false,
                message: "Rider not found."
            });

        }

        // ========================================
        // CHECK ADMIN AVAILABILITY
        // ========================================

        if (rider.available === false) {

            return res.status(409).json({
                success: false,
                message:
                    "This rider is currently unavailable."
            });

        }

        // ========================================
        // CHECK LIVE ONLINE PRESENCE
        // ========================================

        const onlineRiders =
            req.app.get("onlineRiders");

        const riderIsOnline =
            onlineRiders &&
            onlineRiders.has(
                rider._id.toString()
            );

        if (!riderIsOnline) {

            return res.status(409).json({
                success: false,
                message:
                    "This rider is currently offline."
            });

        }

        // ========================================
        // ASSIGN RIDER
        // ========================================

        const assignedAt = new Date();

        const result = await db
            .collection("orders")
            .updateOne(
                {
                    _id: order._id
                },
                {
                    $set: {
                        riderId: rider._id,
                        riderName: rider.name,
                        assignedAt
                    }
                }
            );

        if (result.matchedCount !== 1) {

            return res.status(404).json({
                success: false,
                message:
                    "Order could not be updated."
            });

        }

        // ========================================
        // GET UPDATED ORDER
        // ========================================

        const updatedOrder = await db
            .collection("orders")
            .findOne({
                _id: order._id
            });

        // ========================================
        // SOCKET: SEND TO RIDER
        // ========================================

        const io = req.app.get("io");

        if (io) {

            io.to(`rider:${rider._id.toString()}`)
                .emit(
                    "orderAssigned",
                    {
                        orderNumber:
                            updatedOrder.orderNumber,

                        riderId:
                            rider._id.toString(),

                        riderName:
                            rider.name,

                        order:
                            updatedOrder
                    }
                );

            // ========================================
            // SOCKET: UPDATE DASHBOARD
            // ========================================

            io.emit(
                "orderRiderUpdated",
                {
                    orderNumber:
                        updatedOrder.orderNumber,

                    riderId:
                        rider._id.toString(),

                    riderName:
                        rider.name
                }
            );
        }

        // ========================================
        // RESPONSE
        // ========================================

        return res.status(200).json({

            success: true,

            message:
                "Rider assigned successfully.",

            data:
                updatedOrder
        });

    } catch (error) {

        console.error(
            "❌ Error assigning rider:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to assign rider."
        });
    }
});


// ========================================
// DELETE /api/orders
// DELETE ALL ORDERS (ADMIN ONLY)
// ========================================

router.delete("/", async (req, res) => {
    try {
        const db = getDb();

        // Delete all documents from the orders collection
        const result = await db
            .collection("orders")
            .deleteMany({});

        // ========================================
        // SOCKET: NOTIFY DASHBOARD
        // ========================================
        const io = req.app.get("io");

        if (io) {
            io.emit("allOrdersCleared", {
                deletedCount: result.deletedCount
            });
        }

        return res.status(200).json({
            success: true,
            message: "All orders have been cleared.",
            data: {
                deletedCount: result.deletedCount
            }
        });
    } catch (error) {
        console.error("❌ Error clearing all orders:");
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to clear orders."
        });
    }
});

module.exports = router;