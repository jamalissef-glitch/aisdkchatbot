
// Soo qaado MongoDB connection-ka.
import clientPromise from "@/lib/mongodb";

// Soo qaado ObjectId si loo aqoonsado conversation-ka.
import { ObjectId } from "mongodb";

// Adeegso Node.js runtime.
export const runtime = "nodejs";

// PATCH: Rename ama Pin/Unpin conversation.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Hel conversation ID-ga URL-ka.
    const { id } = await params;

    // Hubi in ID-gu yahay MongoDB ObjectId sax ah.
    if (!ObjectId.isValid(id)) {
      return Response.json(
        { success: false, message: "Invalid conversation ID." },
        { status: 400 }
      );
    }

    // Akhri xogta laga soo diray frontend-ka.
    const body = await request.json();

    // Diyaari fields-ka la cusboonaysiinayo.
    const updates: {
      title?: string;
      pinned?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    // Haddii title la soo diray, hubi oo cusboonaysii.
    if (body.title !== undefined) {
      if (
        typeof body.title !== "string" ||
        !body.title.trim()
      ) {
        return Response.json(
          { success: false, message: "A valid title is required." },
          { status: 400 }
        );
      }

      // Kaydi title-ka cusub.
      updates.title = body.title.trim().slice(0, 100);
    }

    // Haddii pinned la soo diray, hubi inuu boolean yahay.
    if (body.pinned !== undefined) {
      if (typeof body.pinned !== "boolean") {
        return Response.json(
          { success: false, message: "Pinned must be true or false." },
          { status: 400 }
        );
      }

      // Kaydi xaaladda Pin/Unpin.
      updates.pinned = body.pinned;
    }

    // Hubi in ugu yaraan hal field la beddelayo.
    if (body.title === undefined && body.pinned === undefined) {
      return Response.json(
        { success: false, message: "No valid updates provided." },
        { status: 400 }
      );
    }

    // Ku xir MongoDB.
    const client = await clientPromise;

    // Dooro database-ka mashruuca.
    const db = client.db("ai_chatbot_dev");

    // Cusboonaysii conversation-ka user-kan.
    const result = await db.collection("conversations").findOneAndUpdate(
      {
        _id: new ObjectId(id),
        userId: "local-user",
      },
      {
        $set: updates,
      },
      {
        returnDocument: "after",
      }
    );

    // Hubi in conversation-ku jiro.
    if (!result) {
      return Response.json(
        { success: false, message: "Conversation not found." },
        { status: 404 }
      );
    }

    // Soo celi xogta cusub.
    return Response.json({
      success: true,
      message: "Conversation updated successfully.",
      conversation: {
        ...result,
        _id: result._id.toString(),
      },
    });
  } catch (error) {
    // Ku qor khaladka terminal-ka.
    console.error("Update conversation error:", error);

    // Soo celi server error.
    return Response.json(
      { success: false, message: "Failed to update conversation." },
      { status: 500 }
    );
  }
}

// DELETE: Tirtir conversation iyo fariimihiisa.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Hel conversation ID-ga URL-ka.
    const { id } = await params;

    // Hubi in ID-gu sax yahay.
    if (!ObjectId.isValid(id)) {
      return Response.json(
        { success: false, message: "Invalid conversation ID." },
        { status: 400 }
      );
    }

    // Ku xir MongoDB.
    const client = await clientPromise;

    // Dooro database-ka mashruuca.
    const db = client.db("ai_chatbot_dev");

    // U beddel ID-ga ObjectId.
    const conversationObjectId = new ObjectId(id);

    // Marka hore hubi in conversation-ku jiro.
    const conversation = await db.collection("conversations").findOne({
      _id: conversationObjectId,
      userId: "local-user",
    });

    // Haddii aanu jirin, soo celi 404.
    if (!conversation) {
      return Response.json(
        { success: false, message: "Conversation not found." },
        { status: 404 }
      );
    }

    // Tirtir dhammaan fariimaha conversation-ka.
    await db.collection("messages").deleteMany({
      conversationId: conversationObjectId,
    });

    // Kadib tirtir conversation-ka laftiisa.
    await db.collection("conversations").deleteOne({
      _id: conversationObjectId,
      userId: "local-user",
    });

    // Soo celi natiijada.
    return Response.json({
      success: true,
      message: "Conversation and its messages deleted successfully.",
      deletedConversationId: id,
    });
  } catch (error) {
    // Ku qor khaladka terminal-ka.
    console.error("Delete conversation error:", error);

    // Soo celi server error.
    return Response.json(
      { success: false, message: "Failed to delete conversation." },
      { status: 500 }
    );
  }
}
