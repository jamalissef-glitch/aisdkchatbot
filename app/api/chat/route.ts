import { streamText, convertToModelMessages } from "ai";

import type { UIMessage } from "ai";

import { chatModel } from "@/lib/ai";

import clientPromise from "@/lib/mongodb";

import { ObjectId } from "mongodb";

export const runtime = "nodejs";

const MAX_ATTACHMENTS = 5;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const messages = body.messages as UIMessage[];

    const conversationId = body.conversationId;

    const attachmentIds = Array.isArray(body.attachmentIds)
      ? body.attachmentIds
      : [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { success: false, message: "Messages are required." },
        { status: 400 },
      );
    }

    if (
      typeof conversationId !== "string" ||
      !ObjectId.isValid(conversationId)
    ) {
      return Response.json(
        { success: false, message: "Invalid conversation ID." },
        { status: 400 },
      );
    }

    if (attachmentIds.length > MAX_ATTACHMENTS) {
      return Response.json(
        { success: false, message: "You can attach up to five files." },
        { status: 400 },
      );
    }

    if (
      !attachmentIds.every(
        (id: unknown) => typeof id === "string" && ObjectId.isValid(id),
      )
    ) {
      return Response.json(
        { success: false, message: "One or more attachment IDs are invalid." },
        { status: 400 },
      );
    }

    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role !== "user") {
      return Response.json(
        {
          success: false,
          message: "The latest message must be from the user.",
        },
        { status: 400 },
      );
    }

    const userContent = lastMessage.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();

    if (!userContent && attachmentIds.length === 0) {
      return Response.json(
        {
          success: false,
          message: "Message text or an attachment is required.",
        },
        { status: 400 },
      );
    }

    const client = await clientPromise;

    const db = client.db("ai_chatbot_dev");

    const conversationObjectId = new ObjectId(conversationId);
    const conversation = await db.collection("conversations").findOne({
      _id: conversationObjectId,
      userId: "local-user",
    });

    if (!conversation) {
      return Response.json(
        { success: false, message: "Conversation not found." },
        { status: 404 },
      );
    }

    const files = attachmentIds.length
      ? await db
          .collection("files")
          .find({
            _id: { $in: attachmentIds.map((id: string) => new ObjectId(id)) },
            conversationId: conversationObjectId,
            userId: "local-user",
          })
          .toArray()
      : [];

    if (files.length !== attachmentIds.length) {
      return Response.json(
        {
          success: false,
          message: "One or more files were not found for this conversation.",
        },
        { status: 404 },
      );
    }

    await db.collection("messages").insertOne({
      conversationId: conversationObjectId,
      role: "user",
      content: userContent || "[Attached file(s)]",
      attachmentIds: attachmentIds.map((id: string) => new ObjectId(id)),
      createdAt: new Date(),
    });

    await db
      .collection("conversations")
      .updateOne(
        { _id: conversationObjectId },
        { $set: { updatedAt: new Date() } },
      );

    const modelMessages = await convertToModelMessages(messages);

    const latestModelMessage = modelMessages[modelMessages.length - 1];

    if (latestModelMessage?.role === "user" && files.length > 0) {
      const contentParts: any[] = Array.isArray(latestModelMessage.content)
        ? [...latestModelMessage.content]
        : [{ type: "text", text: String(latestModelMessage.content ?? "") }];

      for (const file of files) {
        if (
          typeof file.secureUrl !== "string" ||
          !file.secureUrl.startsWith("https://")
        ) {
          throw new Error(
            `Invalid secure URL for uploaded file: ${file.fileName}`,
          );
        }

        contentParts.push({
          type: "text",
          text: `Attached file: ${file.fileName} (${file.mimeType}).`,
        });

        if (
          typeof file.mimeType === "string" &&
          file.mimeType.startsWith("image/")
        ) {
          contentParts.push({
            type: "image",
            image: new URL(file.secureUrl),
          });
          continue;
        }

        if (file.mimeType === "text/plain") {
          const fileResponse = await fetch(file.secureUrl);
          if (!fileResponse.ok) {
            throw new Error(`Could not retrieve text file: ${file.fileName}`);
          }
          const extractedText = await fileResponse.text();
          contentParts.push({
            type: "text",
            text: `Contents of ${file.fileName}:\n${extractedText.slice(0, 50000)}`,
          });
          continue;
        }

        // Process PDF files before sending them to the AI model.
        if (file.mimeType === "application/pdf") {
          // Download the PDF from Cloudinary on our server.
          const pdfResponse = await fetch(file.secureUrl);

          // Check whether Cloudinary returned the PDF successfully.
          if (!pdfResponse.ok) {
            throw new Error(
              `PDF download failed: ${pdfResponse.status} ${pdfResponse.statusText} - ${file.secureUrl}`,
            );
          }

          // Convert the downloaded PDF into binary data.
          const pdfBuffer = new Uint8Array(await pdfResponse.arrayBuffer());

          // Add the PDF binary data to the AI message.
          contentParts.push({
            type: "file",
            data: pdfBuffer,
            mediaType: "application/pdf",
            filename: file.fileName,
          });

          continue;
        }

        // Explain unsupported document types rather than silently ignoring them.
        contentParts.push({
          type: "text",
          text: `The file ${file.fileName} was uploaded, but its format is not yet supported for AI content extraction.`,
        });
      }

      // Replace the latest user message content with text and attachment parts.
      (latestModelMessage as any).content = contentParts;
    }

    // Stream the AI response using the configured OpenRouter model.
    const result = streamText({
      // Use the selected OpenRouter model.
      model: chatModel,

      // Send converted messages plus authorized attachment content.
      messages: modelMessages,

      // Save the completed assistant response to MongoDB.
      onFinish: async ({ text }) => {
        try {
          // Ignore empty AI responses.
          if (!text.trim()) return;

          // Insert the assistant response.
          await db.collection("messages").insertOne({
            conversationId: conversationObjectId,
            role: "assistant",
            content: text,
            createdAt: new Date(),
          });

          // Update the conversation activity timestamp.
          await db
            .collection("conversations")
            .updateOne(
              { _id: conversationObjectId },
              { $set: { updatedAt: new Date() } },
            );
        } catch (error) {
          // Log persistence errors without interrupting the completed stream.
          console.error("Save AI response error:", error);
        }
      },
    });

    // Return the AI response as a UI message stream.
    return result.toUIMessageStreamResponse();
  } catch (error) {
    // Log the detailed server error for debugging.
    console.error("Chat API error:", error);

    // Return a generic error response to the browser.
    return Response.json(
      { success: false, message: "Internal server error." },
      { status: 500 },
    );
  }
}
