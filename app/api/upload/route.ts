
// Import the configured Cloudinary instance.
import cloudinary from "@/lib/cloudinary";

// Import MongoDB connection.
import clientPromise from "@/lib/mongodb";

// Import ObjectId for conversation validation.
import { ObjectId } from "mongodb";

// Use the Node.js runtime.
export const runtime = "nodejs";

// Define the maximum upload size: 10 MB.
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Define the file types allowed by this API.
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Handle file upload requests.
export async function POST(request: Request) {
  try {
    // Check that all Cloudinary credentials exist.
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return Response.json(
        { success: false, message: "Cloudinary configuration is missing." },
        { status: 500 }
      );
    }

    // Read the multipart form data.
    const formData = await request.formData();

    // Extract the uploaded file.
    const file = formData.get("file");

    // Extract the optional conversation ID.
    const conversationId = formData.get("conversationId");

    // Make sure the uploaded value is a file.
    if (!(file instanceof File)) {
      return Response.json(
        { success: false, message: "Please select a file." },
        { status: 400 }
      );
    }

    // Validate the file type.
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return Response.json(
        { success: false, message: "This file type is not supported." },
        { status: 400 }
      );
    }

    // Validate the file size.
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return Response.json(
        { success: false, message: "File must be between 1 byte and 10 MB." },
        { status: 400 }
      );
    }

    // Connect to MongoDB.
    const client = await clientPromise;

    // Select the chatbot database.
    const db = client.db("ai_chatbot_dev");

    // Prepare the conversation reference.
    let conversationObjectId: ObjectId | null = null;

    // Validate the conversation ID if one was supplied.
    if (conversationId !== null) {
      // Ensure the conversation ID is a string.
      if (
        typeof conversationId !== "string" ||
        !ObjectId.isValid(conversationId)
      ) {
        return Response.json(
          { success: false, message: "Invalid conversation ID." },
          { status: 400 }
        );
      }

      // Convert the ID into MongoDB ObjectId.
      conversationObjectId = new ObjectId(conversationId);

      // Confirm that the conversation belongs to the local user.
      const conversation = await db.collection("conversations").findOne({
        _id: conversationObjectId,
        userId: "local-user",
      });

      // Reject uploads linked to an unknown conversation.
      if (!conversation) {
        return Response.json(
          { success: false, message: "Conversation not found." },
          { status: 404 }
        );
      }
    }

    // Convert the uploaded file into a Node.js Buffer.
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload the file to Cloudinary using a Promise.
    const uploadResult = await new Promise<any>((resolve, reject) => {
      // Create the Cloudinary upload stream.
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          // Store files inside this Cloudinary folder.
          folder: "tt-chatbot/uploads",

          // Automatically select image, raw or video resource type.
          resource_type: "auto",

          // Use the original filename where possible.
          use_filename: true,

          // Prevent filename collisions.
          unique_filename: true,
        },
        // Handle the Cloudinary upload result.
        (error, result) => {
          // Reject the Promise if Cloudinary returns an error.
          if (error) {
            reject(error);
            return;
          }

          // Reject if no upload result is returned.
          if (!result) {
            reject(new Error("Cloudinary returned no upload result."));
            return;
          }

          // Return the successful upload result.
          resolve(result);
        }
      );

      // Send the file buffer into Cloudinary.
      uploadStream.end(buffer);
    });

    // Prepare the file metadata for MongoDB.
    const fileDocument = {
      // Store the original filename.
      fileName: file.name,

      // Store the detected MIME type.
      mimeType: file.type,

      // Store the file size in bytes.
      size: file.size,

      // Store the Cloudinary public ID.
      publicId: uploadResult.public_id,

      // Store the Cloudinary secure URL.
      secureUrl: uploadResult.secure_url,

      // Store the Cloudinary resource type.
      resourceType: uploadResult.resource_type,

      // Store the file format.
      format: uploadResult.format,

      // Link the file to its conversation when provided.
      conversationId: conversationObjectId,

      // Identify the current development user.
      userId: "local-user",

      // Record the upload date.
      createdAt: new Date(),
    };

    // Save the file metadata in MongoDB.
    const savedFile = await db.collection("files").insertOne(fileDocument);

    // Return the uploaded file information.
    return Response.json(
      {
        success: true,
        message: "File uploaded successfully.",
        file: {
          // Return the MongoDB file record ID.
          _id: savedFile.insertedId.toString(),

          // Return the original filename.
          fileName: fileDocument.fileName,

          // Return the MIME type.
          mimeType: fileDocument.mimeType,

          // Return the file size.
          size: fileDocument.size,

          // Return the Cloudinary URL.
          secureUrl: fileDocument.secureUrl,

          // Return the Cloudinary public ID.
          publicId: fileDocument.publicId,

          // Return the conversation ID if available.
          conversationId: conversationObjectId?.toString() ?? null,

          // Return the upload date.
          createdAt: fileDocument.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Log upload errors on the server.
    console.error("File upload error:", error);

    // Return a generic server error.
    return Response.json(
      { success: false, message: "Failed to upload file." },
      { status: 500 }
    );
  }
}
