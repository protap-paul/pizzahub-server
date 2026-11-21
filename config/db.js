import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

if (!uri) {
    throw new Error("MONGODB_URI is missing from environment variables.");
}

if (!dbName) {
    throw new Error("DB_NAME is missing from environment variables.");
}

export const client = new MongoClient(uri);
export const authDB = client.db(dbName);

let db;

let isConnected = false;

export async function connectToMongoDB() {
    try {
        if (isConnected) {
            return db;
        }

        await client.connect();
        db = client.db(dbName);
        await db.command({ ping: 1 });

        isConnected = true;

        console.log("You successfully connect to MongoDB!");

        return db;
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);

        await client.close().catch(() => { });

        throw error;
    }
};

export function getDB() {
    if (!db) {
        throw new Error("Database is not connected!");
    }

    return db;
}

export async function disconnectFromMongoDB() {
    isConnected = false;
    db = undefined;
    await client.close();
};