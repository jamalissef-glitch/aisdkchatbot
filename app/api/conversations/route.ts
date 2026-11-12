

import clientPromise from "@/lib/mongodb";


import { ObjectId } from "mongodb";


export const runtime = "nodejs";


export async function GET() {
  try {
    
    const client = await clientPromise;

    const db = client.db("ai_chatbot_dev");

    const conversations = await db
      .collection("conversations")
      .find({ userId: "local-user" })
      .sort({ updatedAt: -1 })
      .toArray();

   
    return Response.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);

    return Response.json(
      { success: false, message: "Failed to load conversations." },
      { status: 500 }
    );
  }
}


export async function POST(req: Request) {
  try {
  
    const body = await req.json();

    
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "New Chat";

    
    const client = await clientPromise;

  
    const db = client.db("ai_chatbot_dev");

    
    const now = new Date();

   
    const conversation = {
      title,
      userId: "local-user",
      createdAt: now,
      updatedAt: now,
    };

    // Ku kaydi conversation-ka MongoDB.
    const result = await db
      .collection("conversations")
      .insertOne(conversation);

    // Soo celi conversation-ka cusub.
    return Response.json({
      success: true,
      conversation: {
        _id: result.insertedId.toString(),
        ...conversation,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Create conversation error:", error);

    return Response.json(
      { success: false, message: "Failed to create conversation." },
      { status: 500 }
    );
  }
}
