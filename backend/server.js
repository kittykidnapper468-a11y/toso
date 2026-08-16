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

io.on("connection", (socket) => {
    

    console.log(
        "🔌 Socket connected:",
        socket.id
    );

socket.on("joinCustomerRoom", ({ customerId }) => {

    if (!customerId) {
        return;
    }

    socket.join(`customer:${customerId}`);

    console.log(
        `👤 Customer joined room: customer:${customerId}`
    );

});

    socket.on("disconnect", () => {

        console.log(
            "🔌 Socket disconnected:",
            socket.id
        );

    });

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