require('dotenv').config();
const { MongoClient } = require("mongodb");

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;

const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}?retryWrites=true&w=majority`;

const client = new MongoClient(atlasURI);

async function connectToDatabase() {
  await client.connect();
  console.log("Connected to MongoDB Atlas");
  const db = client.db(mongodb_database);
  return db;
}

module.exports = { connectToDatabase };
