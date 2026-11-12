

import clientPromise from "@/lib/mongodb";


export const runtime = "nodejs";


export async function GET() {
  try {
    
    const client = await clientPromise;

    await client.db("admin").command({ ping: 1 });

   
    return Response.json({
      success: true,
      message: "MongoDB connected successfully!",
      database: "ai_chatbot_dev",
    });
  } catch (error) {
    
    console.error("MongoDB connection error:", error);

   
    return Response.json(
      {
        success: false,
        message: "MongoDB connection failed.",
      },
      { status: 500 }
    );
  }
}
