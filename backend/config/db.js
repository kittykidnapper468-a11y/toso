const { MongoClient } = require("mongodb");

let dbInstance = null;
let client = null;

// ========================================
// CONNECT TO MONGODB
// ========================================

const connectDB = async () => {
    // If already connected, reuse the existing connection
    if (dbInstance) {
        return dbInstance;
    }

    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!uri) {
        throw new Error(
            "MONGODB_URI is not defined in your .env file."
        );
    }

    try {
        client = new MongoClient(uri);

        await client.connect();

        // Explicitly use the TOSO database
        dbInstance = client.db("toso");

        // Test the connection
        await dbInstance.command({ ping: 1 });

        console.log("🍃 Connected successfully to MongoDB Atlas");
        console.log("📦 Database: toso");

        return dbInstance;
    } catch (error) {
        console.error("❌ MongoDB Connection Error:");
        console.error(error);

        throw error;
    }
};

// ========================================
// GET DATABASE INSTANCE
// ========================================

const getDb = () => {
    if (!dbInstance) {
        throw new Error(
            "Database not initialized. Call connectDB() first."
        );
    }

    return dbInstance;
};

// ========================================
// EXPORTS
// ========================================

module.exports = {
    connectDB,
    getDb
};