

import { MongoClient } from "mongodb";


const uri = process.env.MONGODB_URI;


if (!uri) {
  
  throw new Error("Please define MONGODB_URI in .env.local");
}


declare global {

  var _mongoClientPromise: Promise<MongoClient> | undefined;
}


const client = new MongoClient(uri);


const clientPromise =
  globalThis._mongoClientPromise ?? client.connect();


if (!globalThis._mongoClientPromise) {
  globalThis._mongoClientPromise = clientPromise;
}


export default clientPromise;
