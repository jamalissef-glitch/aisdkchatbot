
import clientPromise from "@/lib/mongodb"; 
export const runtime = "nodejs"; 

export async function POST() { 
  try {
    const client = await clientPromise; 

    const db = client.db("ai_chatbot_dev"); 

    const conversations = db.collection("conversations"); 

    const messages = db.collection("messages"); 

    
    await conversations.createIndex({ userId: 1 });

    
    await conversations.createIndex({ updatedAt: -1 });

    await messages.createIndex({ conversationId: 1, createdAt: 1 });

   
    return Response.json({
      success: true,
      message: "Database collections and indexes are ready.",
      collections: ["conversations", "messages"],
    });
  } catch (error) {
    console.error("Database setup error:", error); 

    return Response.json(
      {
        success: false,
        message: "Database setup failed.",
      },
      { status: 500 }
    );
  }
}
