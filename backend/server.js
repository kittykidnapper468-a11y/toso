require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const { connectDB } = require("./config/db");
const orderRoutes = require("./routes/orderRoutes");
const menuRoutes = require("./routes/menuRoutes");
const chefsSpecialRoutes = require("./routes/chefsSpecialRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes");
const subscriberRoutes = require("./routes/subscriberRoutes");
const riderRoutes = require("./routes/riderRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

// ========================================
// HTTP SERVER
// ========================================

const server = http.createServer(app);

// ========================================
// SOCKET.IO
// ========================================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "DELETE"]
    }
});

// ========================================
// MAKE IO AVAILABLE TO ROUTES
// ========================================

app.set("io", io);

// ========================================
// ONLINE RIDER PRESENCE
// ========================================

// riderId -> Set of connected socket IDs
const onlineRiders = new Map();

// Make it available to routes
app.set("onlineRiders", onlineRiders);

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors());

app.use(express.json());

// ========================================
// ROUTES
// ========================================

app.use("/api/orders", orderRoutes);

app.use("/api/menu", menuRoutes);

app.use("/api/chefs-special", chefsSpecialRoutes);

app.use("/api/inquiries", inquiryRoutes);

app.use("/api/subscribers", subscriberRoutes);

app.use("/api/riders", riderRoutes.router);

app.use("/api/admin", adminRoutes.router);

// ========================================
// TEST ROUTE
// ========================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "TOSO backend is running 🚀"
    });
});

// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        server: "OK"
    });
});

// ========================================
// SOCKET CONNECTION
// ========================================

// ========================================
// SOCKET CONNECTION
// ========================================

io.on("connection", (socket) => {

    console.log(
        "🔌 Socket connected:",
        socket.id
    );


    // ========================================
    // CUSTOMER ROOM
    // EXISTING FUNCTIONALITY
    // ========================================

    socket.on(
        "joinCustomerRoom",
        ({ customerId }) => {

            if (!customerId) {
                return;
            }

            socket.join(
                `customer:${customerId}`
            );

            console.log(
                `👤 Customer joined room: customer:${customerId}`
            );
        }
    );


    // ========================================
    // RIDER AUTHENTICATION
    // ========================================

    const riderToken =
        socket.handshake.auth?.token;

    if (riderToken) {

        try {

            if (!process.env.RIDER_JWT_SECRET) {

                console.warn(
                    "⚠️ RIDER_JWT_SECRET is not configured."
                );

            } else {

                const decoded =
                    require("jsonwebtoken").verify(
                        riderToken,
                        process.env.RIDER_JWT_SECRET
                    );

                if (
                    decoded &&
                    decoded.role === "rider" &&
                    decoded.riderId
                ) {

                    const riderId =
                        decoded.riderId;


                    // ========================================
                    // STORE SOCKET
                    // ========================================

                    if (
                        !onlineRiders.has(riderId)
                    ) {

                        onlineRiders.set(
                            riderId,
                            new Set()
                        );
                    }

                    onlineRiders
                        .get(riderId)
                        .add(socket.id);


                    // ========================================
                    // JOIN RIDER ROOM
                    // ========================================

                    socket.join(
                        `rider:${riderId}`
                    );


                    // Store rider ID on socket
                    socket.riderId =
                        riderId;


                    console.log(
                        `🟢 Rider online: ${riderId}`
                    );


                    // ========================================
                    // NOTIFY DASHBOARD
                    // ========================================

                    io.emit(
                        "riderPresenceUpdated",
                        {
                            riderId,
                            online: true
                        }
                    );
                }

            }

        } catch (error) {

            console.warn(
                "⚠️ Invalid rider socket token."
            );

        }
    }


    // ========================================
    // DISCONNECT
    // ========================================

    socket.on(
        "disconnect",
        () => {

            console.log(
                "🔌 Socket disconnected:",
                socket.id
            );


            // ========================================
            // RIDER OFFLINE
            // ========================================

            if (socket.riderId) {

                const riderId =
                    socket.riderId;

                const riderSockets =
                    onlineRiders.get(
                        riderId
                    );


                if (riderSockets) {

                    riderSockets.delete(
                        socket.id
                    );


                    // Only mark offline
                    // when NO other rider
                    // tabs/connections remain
                    if (
                        riderSockets.size === 0
                    ) {

                        onlineRiders.delete(
                            riderId
                        );


                        io.emit(
                            "riderPresenceUpdated",
                            {
                                riderId,
                                online: false
                            }
                        );


                        console.log(
                            `🔴 Rider offline: ${riderId}`
                        );
                    }
                }
            }
        }
    );

});

// ========================================
// START SERVER
// ========================================

const startServer = async () => {

    try {

        await connectDB();

        server.listen(PORT, () => {

            console.log(
                `🚀 TOSO server running on port ${PORT}`
            );

            console.log(
                "🔌 Socket.IO server is running"
            );

        });

    } catch (error) {

        console.error(
            "❌ Failed to start TOSO server."
        );

        console.error(error);

        process.exit(1);
    }
};

startServer();