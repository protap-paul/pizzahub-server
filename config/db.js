import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

const client = new MongoClient(uri);

let db;

export async function connectToMongoDB() {
    try {
        await client.connect();
        db = client.db(dbName);
        await db.command({ ping: 1 });

        console.log("You successfully connect to MongoDB!");

        return db;
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        throw error;
    }
};

export async function disconnectFromMongoDB() {
    await client.close();
};