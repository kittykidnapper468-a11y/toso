const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// ========================================
// ADMIN CONFIG
// ========================================

const ADMIN_USERNAME =
    process.env.ADMIN_USERNAME;

const ADMIN_PASSWORD_HASH =
    process.env.ADMIN_PASSWORD_HASH;

const ADMIN_JWT_SECRET =
    process.env.ADMIN_JWT_SECRET;


// ========================================
// ADMIN AUTH MIDDLEWARE
// ========================================

function authenticateAdmin(req, res, next) {

    try {

        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Admin authentication required."
            });
        }

        const token =
            authHeader.split(" ")[1];

        if (!ADMIN_JWT_SECRET) {

            return res.status(500).json({
                success: false,
                message:
                    "Admin authentication is not configured."
            });
        }

        const decoded =
            jwt.verify(
                token,
                ADMIN_JWT_SECRET
            );

        if (
            !decoded ||
            decoded.role !== "admin"
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid admin authentication."
            });
        }

        req.admin = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message:
                "Invalid or expired admin session."
        });
    }
}


// ========================================
// POST /api/admin/login
// ADMIN LOGIN
// ========================================

router.post("/login", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;


        // ========================================
        // VALIDATION
        // ========================================

        if (
            !username ||
            !password
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Username and password are required."
            });
        }


        // ========================================
        // CONFIG CHECK
        // ========================================

        if (
            !ADMIN_USERNAME ||
            !ADMIN_PASSWORD_HASH ||
            !ADMIN_JWT_SECRET
        ) {

            return res.status(500).json({
                success: false,
                message:
                    "Admin authentication is not configured."
            });
        }


        // ========================================
        // EXACT USERNAME MATCH
        // ========================================

        if (
            username.trim() !== ADMIN_USERNAME
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid username or password."
            });
        }


        // ========================================
        // PASSWORD CHECK
        // ========================================

        const passwordMatches =
            await bcrypt.compare(
                password,
                ADMIN_PASSWORD_HASH
            );

        if (!passwordMatches) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid username or password."
            });
        }


        // ========================================
        // CREATE JWT
        // ========================================

        const token =
            jwt.sign(
                {
                    role: "admin",
                    username:
                        ADMIN_USERNAME
                },
                ADMIN_JWT_SECRET,
                {
                    expiresIn: "12h"
                }
            );


        // ========================================
        // RESPONSE
        // ========================================

        return res.status(200).json({

            success: true,

            message:
                "Admin login successful.",

            token,

            admin: {
                username:
                    ADMIN_USERNAME
            }
        });

    } catch (error) {

        console.error(
            "❌ Admin login error:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to login admin."
        });
    }
});


// ========================================
// GET /api/admin/me
// VERIFY ADMIN SESSION
// ========================================

router.get(
    "/me",
    authenticateAdmin,
    async (req, res) => {

        return res.status(200).json({

            success: true,

            data: {
                username:
                    req.admin.username,

                role:
                    "admin"
            }
        });
    }
);


module.exports = {
    router,
    authenticateAdmin
};