import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

type MessageRole = "user" | "assistant";

// GET: Load conversation messages together with their attachments.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get the conversation ID from the route parameters.
    const { id } = await params;

    // Validate the conversation ID.
    if (!ObjectId.isValid(id)) {
      return Response.json(
        { success: false, message: "Invalid conversation ID." },
        { status: 400 },
      );
    }

    // Connect to MongoDB.
    const client = await clientPromise;
    const db = client.db("ai_chatbot_dev");

    // Convert the ID into MongoDB ObjectId.
    const conversationObjectId = new ObjectId(id);

    // Check that the conversation belongs to the current user.
    const conversation = await db.collection("conversations").findOne({
      _id: conversationObjectId,
      userId: "local-user",
    });

    // Return an error if the conversation does not exist.
    if (!conversation) {
      return Response.json(
        { success: false, message: "Conversation not found." },
        { status: 404 },
      );
    }

    // Load all messages belonging to this conversation.
    const messages = await db
      .collection("messages")
      .find({ conversationId: conversationObjectId })
      .sort({ createdAt: 1 })
      .toArray();

    // Collect all attachment IDs from the messages.
    const allAttachmentIds = messages.flatMap((message) =>
      Array.isArray(message.attachmentIds) ? message.attachmentIds : [],
    );

    // Retrieve attachment information from MongoDB.
    const files = allAttachmentIds.length
      ? await db
          .collection("files")
          .find({
            _id: { $in: allAttachmentIds },
            conversationId: conversationObjectId,
            userId: "local-user",
          })
          .toArray()
      : [];

    // Attach the file information to its corresponding message.
    const messagesWithAttachments = messages.map((message) => {
      // Convert attachment IDs into strings for comparison.
      const attachmentIds = Array.isArray(message.attachmentIds)
        ? message.attachmentIds.map((fileId: ObjectId) => fileId.toString())
        : [];

      // Find files belonging to this message.
      const messageAttachments = files
        .filter((file) => attachmentIds.includes(file._id.toString()))
        .map((file) => ({
          _id: file._id.toString(),
          fileName: file.fileName,
          mimeType: file.mimeType,
          size: file.size,
          secureUrl: file.secureUrl,
        }));

      // Return the message with its attachments.
      return {
        ...message,
        _id: message._id.toString(),
        conversationId: message.conversationId.toString(),
        attachments: messageAttachments,
      };
    });

    // Return messages and their attachment information.
    return Response.json({
      success: true,
      messages: messagesWithAttachments,
    });
  } catch (error) {
    // Log errors for debugging.
    console.error("Get messages error:", error);

    // Return a server error response.
    return Response.json(
      { success: false, message: "Failed to load messages." },
      { status: 500 },
    );
  }
}

// POST: Save a new message to a conversation.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get the conversation ID from the route parameters.
    const { id } = await params;

    // Validate the conversation ID.
    if (!ObjectId.isValid(id)) {
      return Response.json(
        { success: false, message: "Invalid conversation ID." },
        { status: 400 },
      );
    }

    // Read the request body.
    const body = await request.json();

    // Get the message role.
    const role = body.role as MessageRole;

    // Validate the message role.
    if (role !== "user" && role !== "assistant") {
      return Response.json(
        { success: false, message: "Invalid message role." },
        { status: 400 },
      );
    }

    // Validate the message content.
    if (typeof body.content !== "string" || !body.content.trim()) {
      return Response.json(
        { success: false, message: "Message content is required." },
        { status: 400 },
      );
    }

    // Connect to MongoDB.
    const client = await clientPromise;
    const db = client.db("ai_chatbot_dev");

    // Convert the conversation ID.
    const conversationObjectId = new ObjectId(id);

    // Verify that the conversation belongs to the current user.
    const conversation = await db.collection("conversations").findOne({
      _id: conversationObjectId,
      userId: "local-user",
    });

    // Return an error if the conversation does not exist.
    if (!conversation) {
      return Response.json(
        { success: false, message: "Conversation not found." },
        { status: 404 },
      );
    }

    // Prepare the message document.
    const message = {
      conversationId: conversationObjectId,
      role,
      content: body.content.trim(),
      createdAt: new Date(),
    };

    // Insert the message into MongoDB.
    const result = await db.collection("messages").insertOne(message);

    // Update the conversation activity timestamp.
    await db
      .collection("conversations")
      .updateOne(
        { _id: conversationObjectId },
        { $set: { updatedAt: new Date() } },
      );

    // Return the saved message.
    return Response.json(
      {
        success: true,
        message: {
          _id: result.insertedId.toString(),
          conversationId: id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    // Log errors for debugging.
    console.error("Save message error:", error);

    // Return a server error response.
    return Response.json(
      { success: false, message: "Failed to save messages." },
      { status: 500 },
    );
  }
}
