"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useChat } from "@ai-sdk/react";

import { DefaultChatTransport } from "ai";

import ReactMarkdown from "react-markdown";

import remarkGfm from "remark-gfm";

import { useDropzone } from "react-dropzone";

import {
  ArrowUp,
  MessageSquare,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  X,
  Check,
  FolderOpen,
  Globe,
  ImagePlus,
  PenTool,
  Presentation,
  FileText,
  FileType,
  LayoutTemplate,
  Telescope,
  Upload,
  Image as ImageIcon,
} from "lucide-react";

type Conversation = {
  _id: string;
  title: string;
  userId: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
};

type SavedMessage = {
  _id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: {
    _id: string;
    fileName: string;
    mimeType: string;
    size: number;
    secureUrl: string;
  }[];
};

type UploadedAttachment = {
  id: string;
  _id?: string;
  fileName: string;
  mimeType: string;
  size: number;
  secureUrl?: string;
  publicId?: string;
  status: "uploading" | "uploaded" | "error";
  progress: number;
  error?: string;
};

type GeneratedImage = {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
};

// Main chatbot page.
export default function Home() {
  // Control sidebar visibility.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Control Recents visibility.
  const [recentsOpen, setRecentsOpen] = useState(true);

  // Store the composer input.
  const [input, setInput] = useState("");

  // Store files selected or uploaded by the user.
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

  // Control the attachment menu visibility.
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  // Control image generation mode in the composer.
  const [imageMode, setImageMode] = useState(false);

  // Store the image generation prompt.
  const [imagePrompt, setImagePrompt] = useState("");

  // Track image generation loading state.
  const [imageGenerating, setImageGenerating] = useState(false);

  // Keep generated images in the current chat session.
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  // Detect clicks outside the attachment menu.
  const attachMenuRef = useRef<HTMLDivElement | null>(null);

  // Store conversations loaded from MongoDB.
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Store the currently selected conversation ID.
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  // Keep the conversation ID available to the API transport.
  const conversationIdRef = useRef<string | null>(null);

  // Keep uploaded MongoDB file IDs available to the API transport.
  const attachmentIdsRef = useRef<string[]>([]);

  // Track whether a conversation is being created.
  const [creatingConversation, setCreatingConversation] = useState(false);

  // Track which conversation menu is open.
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Track the conversation being renamed.
  const [renamingConversation, setRenamingConversation] =
    useState<Conversation | null>(null);

  // Store the new conversation title.
  const [renameTitle, setRenameTitle] = useState("");

  // Track the conversation awaiting delete confirmation.
  const [deletingConversation, setDeletingConversation] =
    useState<Conversation | null>(null);

  // Track ongoing management requests.
  const [actionLoading, setActionLoading] = useState(false);

  // Configure the backend transport.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          conversationId: conversationIdRef.current,
          attachmentIds: attachmentIdsRef.current,
        }),
      }),
    [],
  );

  // Connect the frontend to the AI SDK.
  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
  });

  // Load conversations from MongoDB.
  async function loadConversations() {
    try {
      // Request conversations from the backend.
      const response = await fetch("/api/conversations");

      // Check whether the request succeeded.
      if (!response.ok) {
        throw new Error("Failed to load conversations.");
      }

      // Read the JSON response.
      const data = await response.json();

      // Update the conversations state.
      setConversations(data.conversations ?? []);
    } catch (error) {
      // Log errors for debugging.
      console.error("Load conversations error:", error);
    }
  }

  // Load conversations when the page opens.
  useEffect(() => {
    loadConversations();
  }, []);

  // Close the attachment menu when the user clicks outside it.
  useEffect(() => {
    if (!attachMenuOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(event.target as Node)
      ) {
        setAttachMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [attachMenuOpen]);

  // Sort pinned conversations first, then by recent activity.
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      // Put pinned conversations before unpinned conversations.
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }

      // Sort conversations by most recently updated.
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [conversations]);

  // Extract text from an AI SDK message.
  function getMessageText(message: (typeof messages)[number]) {
    // Combine all text parts into one string.
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
  }

  // Create a conversation in MongoDB.
  async function createConversation(title: string) {
    // Send a POST request to the conversations API.
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });

    // Check the response.
    if (!response.ok) {
      throw new Error("Failed to create conversation.");
    }

    // Read the created conversation.
    const data = await response.json();

    // Return the new conversation.
    return data.conversation as Conversation;
  }

  // Open an existing conversation.
  async function openConversation(conversationId: string) {
    try {
      // Set the current conversation ID.
      conversationIdRef.current = conversationId;

      // Update the selected conversation.
      setActiveConversationId(conversationId);

      // Clear the previous messages.
      setMessages([]);

      // Clear attachments from the previous composer.
      setAttachments([]);

      // Generated images are currently kept in local chat state only.
      setGeneratedImages([]);
      setImageMode(false);
      setImagePrompt("");

      // Close the attachment menu.
      setAttachMenuOpen(false);

      // Close any open conversation menu.
      setOpenMenuId(null);

      // Request the conversation messages.
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
      );

      // Check the response.
      if (!response.ok) {
        throw new Error("Failed to load conversation messages.");
      }

      // Read the saved messages.
      const data = await response.json();

      // Convert MongoDB messages into AI SDK UI messages.
      const restoredMessages = (data.messages as SavedMessage[]).map(
        (message) => ({
          id: message._id,
          role: message.role,
          parts: [
            // Restore the original message text.
            {
              type: "text" as const,
              text: message.content,
            },

            // Restore uploaded files as AI SDK file parts.
            ...(message.attachments ?? []).map((file) => ({
              type: "file" as const,
              mediaType: file.mimeType,
              filename: file.fileName,
              url: file.secureUrl,
            })),
          ],
        }),
      );

      // Restore the messages in the chat interface.
      setMessages(restoredMessages);
    } catch (error) {
      // Log errors for debugging.
      console.error("Open conversation error:", error);
    }
  }

  // Start a new chat.
  function handleNewChat() {
    // Clear the current conversation ID.
    conversationIdRef.current = null;

    // Clear the selected conversation.
    setActiveConversationId(null);

    // Clear chat messages.
    setMessages([]);

    // Clear the composer.
    setInput("");

    // Clear selected attachments.
    setAttachments([]);

    // Clear generated images and exit image mode.
    setGeneratedImages([]);
    setImageMode(false);
    setImagePrompt("");

    // Close the attachment menu.
    setAttachMenuOpen(false);

    // Close any open menu.
    setOpenMenuId(null);
  }

  // Upload one selected file to the backend and Cloudinary.
  async function uploadFile(file: File) {
    // Create a unique frontend ID for this attachment.
    const fileId = crypto.randomUUID();

    // Display the file immediately with an uploading status.
    setAttachments((previous) => [
      ...previous,
      {
        id: fileId,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        status: "uploading",
        progress: 0,
      },
    ]);

    try {
      // Create a conversation if the user uploads before starting a chat.
      if (!conversationIdRef.current) {
        const conversation = await createConversation(file.name.slice(0, 60));
        conversationIdRef.current = conversation._id;
        setActiveConversationId(conversation._id);
        setConversations((previous) => [conversation, ...previous]);
      }

      // Build multipart form data for the upload API.
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversationId", conversationIdRef.current ?? "");

      // Use XMLHttpRequest because it exposes upload progress events.
      const xhr = new XMLHttpRequest();

      // Wait for the upload request to finish.
      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.open("POST", "/api/upload");

        // Update the progress bar while bytes are being uploaded.
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setAttachments((previous) =>
              previous.map((attachment) =>
                attachment.id === fileId
                  ? { ...attachment, progress }
                  : attachment,
              ),
            );
          }
        };

        // Read and validate the API response.
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status < 200 || xhr.status >= 300 || !data.success) {
              throw new Error(data.message || "File upload failed.");
            }

            // Support an API response with either data.file or root-level file fields.
            const uploadedFile = data.file ?? data;
            setAttachments((previous) =>
              previous.map((attachment) =>
                attachment.id === fileId
                  ? {
                      ...attachment,
                      _id: uploadedFile._id,
                      fileName: uploadedFile.fileName || file.name,
                      mimeType: uploadedFile.mimeType || file.type,
                      size: uploadedFile.size || file.size,
                      secureUrl: uploadedFile.secureUrl || uploadedFile.url,
                      publicId: uploadedFile.publicId,
                      status: "uploaded",
                      progress: 100,
                    }
                  : attachment,
              ),
            );
            resolve();
          } catch (uploadError) {
            reject(uploadError);
          }
        };

        // Report network errors separately from API errors.
        xhr.onerror = () =>
          reject(new Error("Network error during file upload."));
        xhr.onabort = () => reject(new Error("File upload was cancelled."));
        xhr.send(formData);
      });

      await uploadPromise;
      await loadConversations();
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Upload failed.";
      setAttachments((previous) =>
        previous.map((attachment) =>
          attachment.id === fileId
            ? { ...attachment, status: "error", error: message }
            : attachment,
        ),
      );
      console.error("File upload error:", uploadError);
    }
  }

  // Handle files selected through drag-and-drop or the file picker.
  function onDrop(acceptedFiles: File[]) {
    acceptedFiles.forEach((file) => {
      void uploadFile(file);
    });
  }

  // Configure accepted file types and upload limits.
  const { getRootProps, getInputProps, open, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      noClick: true,
      noKeyboard: true,
      maxFiles: 5,
      maxSize: 10 * 1024 * 1024,
      accept: {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/webp": [".webp"],
        "image/gif": [".gif"],
        "application/pdf": [".pdf"],
        "text/plain": [".txt"],
        "application/msword": [".doc"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          [".docx"],
      },
    });

  // Send a message to the AI.
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Prevent the browser from reloading.
    event.preventDefault();

    // Remove unnecessary spaces.
    const trimmedInput = input.trim();

    // Check whether any selected file is still uploading or has failed.
    const hasUploadingFiles = attachments.some(
      (file) => file.status === "uploading",
    );
    const hasFailedFiles = attachments.some((file) => file.status === "error");

    // Validate the message, chat status, and attachment states.
    if (
      (!trimmedInput && attachments.length === 0) ||
      status !== "ready" ||
      creatingConversation ||
      hasUploadingFiles ||
      hasFailedFiles
    ) {
      return;
    }

    try {
      // Mark conversation creation as active.
      setCreatingConversation(true);

      // Create a conversation if this is a new chat.
      if (!conversationIdRef.current) {
        // Use the first message as the conversation title.
        const conversation = await createConversation(
          trimmedInput.slice(0, 60),
        );

        // Save its ID for future API requests.
        conversationIdRef.current = conversation._id;

        // Set it as the active conversation.
        setActiveConversationId(conversation._id);

        // Add it to the sidebar.
        setConversations((previous) => [conversation, ...previous]);
      }

      // Collect MongoDB IDs for successfully uploaded attachments.
      const uploadedAttachmentIds = attachments
        .filter(
          (attachment) => attachment.status === "uploaded" && attachment._id,
        )
        .map((attachment) => attachment._id as string);

      // Make the selected file IDs available to the transport request.
      attachmentIdsRef.current = uploadedAttachmentIds;

      // Send the user message to the AI with the selected file IDs in the request body.
      await sendMessage({
        text:
          trimmedInput ||
          "Please analyze the attached file and explain its contents in Somali.",
      });

      // Clear the composer and selected attachments after sending.
      setInput("");
      setAttachments([]);
      attachmentIdsRef.current = [];

      // Refresh conversations to update their latest activity.
      await loadConversations();
    } catch (error) {
      // Log errors for debugging.
      console.error("Send message error:", error);
    } finally {
      // Allow another conversation action.
      setCreatingConversation(false);
    }
  }

  // Generate an image using the backend API.
  async function handleGenerateImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = imagePrompt.trim();

    if (!prompt || imageGenerating) return;

    try {
      setImageGenerating(true);

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.image) {
        throw new Error(data.message || "Image generation failed.");
      }

      const newImage: GeneratedImage = {
        id: crypto.randomUUID(),
        prompt,
        imageUrl: data.image,
        createdAt: new Date().toISOString(),
      };

      setGeneratedImages((previous) => [...previous, newImage]);
      setImagePrompt("");
      setImageMode(false);
    } catch (generationError) {
      console.error("Image generation error:", generationError);
      alert(
        generationError instanceof Error
          ? generationError.message
          : "Something went wrong while generating the image.",
      );
    } finally {
      setImageGenerating(false);
    }
  }

  // Open the rename dialog.
  function openRenameDialog(conversation: Conversation) {
    // Set the selected conversation.
    setRenamingConversation(conversation);

    // Put the current title in the input.
    setRenameTitle(conversation.title);

    // Close the three-dot menu.
    setOpenMenuId(null);
  }

  // Rename a conversation.
  async function handleRename(event: React.FormEvent<HTMLFormElement>) {
    // Prevent form submission from reloading the page.
    event.preventDefault();

    // Get the trimmed title.
    const title = renameTitle.trim();

    // Validate the title.
    if (!renamingConversation || !title || actionLoading) {
      return;
    }

    try {
      // Start the loading state.
      setActionLoading(true);

      // Send a PATCH request to MongoDB API.
      const response = await fetch(
        `/api/conversations/${renamingConversation._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        },
      );

      // Check the response.
      if (!response.ok) {
        throw new Error("Failed to rename conversation.");
      }

      // Update the conversation in the sidebar.
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation._id === renamingConversation._id
            ? { ...conversation, title, updatedAt: new Date().toISOString() }
            : conversation,
        ),
      );

      // Close the rename dialog.
      setRenamingConversation(null);

      // Clear the rename input.
      setRenameTitle("");
    } catch (error) {
      // Log the error.
      console.error("Rename conversation error:", error);

      // Inform the user.
      alert("Could not rename the conversation. Please try again.");
    } finally {
      // Stop the loading state.
      setActionLoading(false);
    }
  }

  // Toggle pin status.
  async function handleTogglePin(conversation: Conversation) {
    try {
      // Start the loading state.
      setActionLoading(true);

      // Reverse the current pin status.
      const pinned = !conversation.pinned;

      // Send a PATCH request to the backend.
      const response = await fetch(`/api/conversations/${conversation._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pinned }),
      });

      // Check the response.
      if (!response.ok) {
        throw new Error("Failed to update pin status.");
      }

      // Update the conversation in local state.
      setConversations((previous) =>
        previous.map((item) =>
          item._id === conversation._id ? { ...item, pinned } : item,
        ),
      );

      // Close the menu.
      setOpenMenuId(null);
    } catch (error) {
      // Log the error.
      console.error("Pin conversation error:", error);

      // Inform the user.
      alert("Could not update pin status. Please try again.");
    } finally {
      // Stop the loading state.
      setActionLoading(false);
    }
  }

  // Delete a conversation and its messages.
  async function handleDeleteConversation() {
    // Validate the selected conversation.
    if (!deletingConversation || actionLoading) {
      return;
    }

    try {
      // Start the loading state.
      setActionLoading(true);

      // Send a DELETE request to the backend.
      const response = await fetch(
        `/api/conversations/${deletingConversation._id}`,
        {
          method: "DELETE",
        },
      );

      // Check the response.
      if (!response.ok) {
        throw new Error("Failed to delete conversation.");
      }

      // Remove the deleted conversation from the sidebar.
      setConversations((previous) =>
        previous.filter((item) => item._id !== deletingConversation._id),
      );

      // If the deleted conversation was open, clear the chat.
      if (activeConversationId === deletingConversation._id) {
        conversationIdRef.current = null;
        setActiveConversationId(null);
        setMessages([]);
        setInput("");
        setAttachments([]);
      }

      // Close the delete dialog.
      setDeletingConversation(null);
    } catch (error) {
      // Log the error.
      console.error("Delete conversation error:", error);

      // Inform the user.
      alert("Could not delete the conversation. Please try again.");
    } finally {
      // Stop the loading state.
      setActionLoading(false);
    }
  }

  // Render the chatbot interface.
  return (
    <main className="flex h-screen overflow-hidden bg-[#212121] text-white">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="flex w-[260px] shrink-0 flex-col bg-[#171717] p-3">
          {/* Sidebar header */}
          <div className="mb-8 flex items-center justify-between">
            <span className="text-lg font-semibold tracking-tight">
              TT Chatbot
            </span>

            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
              aria-label="Close sidebar"
            >
              <PanelLeftClose size={20} />
            </button>
          </div>

          {/* New Chat */}
          <button
            onClick={handleNewChat}
            className="mb-6 flex items-center gap-3 rounded-lg border border-[#424242] px-3 py-3 text-sm hover:bg-[#2a2a2a]"
          >
            <Plus size={18} />
            <span>New chat</span>
          </button>

          {/* Recents heading */}
          <button
            onClick={() => setRecentsOpen((previous) => !previous)}
            className="mb-3 flex items-center justify-between px-2 py-2 text-xs font-medium text-gray-400 hover:text-white"
          >
            <span>Recents</span>

            {recentsOpen ? (
              <ChevronDown size={15} />
            ) : (
              <ChevronRight size={15} />
            )}
          </button>

          {/* Recent conversations */}
          {recentsOpen && (
            <div className="flex-1 overflow-y-auto">
              {sortedConversations.length === 0 ? (
                <p className="px-2 text-sm text-gray-500">
                  Your conversations will appear here.
                </p>
              ) : (
                sortedConversations.map((conversation) => (
                  <div
                    key={conversation._id}
                    className={`group relative mb-1 flex items-center rounded-lg ${
                      activeConversationId === conversation._id
                        ? "bg-[#2a2a2a]"
                        : "hover:bg-[#242424]"
                    }`}
                  >
                    {/* Conversation selection */}
                    <button
                      onClick={() => openConversation(conversation._id)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-3 text-left text-sm text-gray-300"
                    >
                      <MessageSquare size={16} className="shrink-0" />

                      <span className="truncate">{conversation.title}</span>
                    </button>

                    {/* Pinned indicator */}
                    {conversation.pinned && (
                      <Pin size={14} className="mr-1 shrink-0 text-gray-400" />
                    )}

                    {/* Three-dot menu button */}
                    <button
                      onClick={(event) => {
                        event.stopPropagation();

                        setOpenMenuId((previous) =>
                          previous === conversation._id
                            ? null
                            : conversation._id,
                        );
                      }}
                      className="mr-1 rounded-md p-1.5 text-gray-400 opacity-0 hover:bg-[#424242] hover:text-white group-hover:opacity-100"
                      aria-label="Conversation options"
                      title="Conversation options"
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {/* Conversation options menu */}
                    {openMenuId === conversation._id && (
                      <div className="absolute right-1 top-11 z-30 w-44 rounded-xl border border-[#424242] bg-[#252525] p-1 shadow-xl">
                        {/* Rename option */}
                        <button
                          onClick={() => openRenameDialog(conversation)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-[#383838]"
                        >
                          <Pencil size={15} />
                          Rename
                        </button>

                        {/* Pin / Unpin option */}
                        <button
                          onClick={() => handleTogglePin(conversation)}
                          disabled={actionLoading}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-[#383838] disabled:opacity-50"
                        >
                          {conversation.pinned ? (
                            <PinOff size={15} />
                          ) : (
                            <Pin size={15} />
                          )}

                          {conversation.pinned ? "Unpin" : "Pin"}
                        </button>

                        {/* Delete option */}
                        <button
                          onClick={() => {
                            setDeletingConversation(conversation);
                            setOpenMenuId(null);
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-400 hover:bg-[#383838]"
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sidebar footer */}
          <div className="border-t border-[#303030] pt-4">
            <p className="text-xs text-gray-500">TT Chatbot · Development</p>
          </div>
        </aside>
      )}

      {/* Main chat section */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#303030] px-4">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-gray-400 hover:bg-[#303030] hover:text-white"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen size={20} />
              </button>
            )}

            <span className="text-sm font-semibold">TT Assistant</span>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-[#303030] px-3 py-1.5 text-xs text-gray-300">
            <Sparkles size={14} />
            OpenRouter
          </div>
        </header>

        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#303030]">
                <Sparkles size={28} />
              </div>

              <h1 className="mb-3 text-2xl font-semibold tracking-tight">
                Ready when you are
              </h1>

              <p className="max-w-md text-sm leading-6 text-gray-400">
                Ask questions, explore ideas, and work with your AI assistant.
              </p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-7 ${
                      message.role === "user"
                        ? "bg-[#303030]"
                        : "bg-transparent"
                    }`}
                  >
                    {/* Render message content as Markdown */}
                    {message.parts.map((part, index) => {
                      // Render ordinary text and Markdown.
                      if (part.type === "text") {
                        return (
                          <ReactMarkdown
                            key={index}
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ children }) => (
                                <h1 className="mb-4 mt-6 text-2xl font-bold">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="mb-3 mt-5 text-xl font-semibold">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="mb-2 mt-4 text-lg font-semibold">
                                  {children}
                                </h3>
                              ),
                              p: ({ children }) => (
                                <p className="mb-4 leading-7 last:mb-0">
                                  {children}
                                </p>
                              ),
                              ul: ({ children }) => (
                                <ul className="mb-4 ml-6 list-disc space-y-2">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="mb-4 ml-6 list-decimal space-y-2">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="pl-1">{children}</li>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-bold text-white">
                                  {children}
                                </strong>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="my-4 border-l-4 border-gray-500 pl-4 text-gray-300">
                                  {children}
                                </blockquote>
                              ),
                              code: ({ children, className }) => (
                                <code
                                  className={`${className ?? ""} rounded bg-[#303030] px-1.5 py-1 font-mono text-sm text-gray-200`}
                                >
                                  {children}
                                </code>
                              ),
                              pre: ({ children }) => (
                                <pre className="my-4 overflow-x-auto rounded-xl border border-[#424242] bg-[#111111] p-4">
                                  {children}
                                </pre>
                              ),
                              table: ({ children }) => (
                                <div className="my-4 overflow-x-auto">
                                  <table className="w-full border-collapse text-left">
                                    {children}
                                  </table>
                                </div>
                              ),
                              th: ({ children }) => (
                                <th className="border border-[#424242] bg-[#303030] px-3 py-2 font-semibold">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="border border-[#424242] px-3 py-2">
                                  {children}
                                </td>
                              ),
                            }}
                          >
                            {part.text}
                          </ReactMarkdown>
                        );
                      }

                      // Render uploaded files as clickable attachment cards.
                      if (part.type === "file") {
                        return (
                          <a
                            key={index}
                            href={part.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="my-2 flex max-w-xs items-center gap-3 rounded-xl border border-[#424242] bg-[#303030] p-3 transition hover:bg-[#383838]"
                          >
                            <FileText
                              size={24}
                              className="shrink-0 text-gray-300"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {part.filename || "Attached file"}
                              </p>

                              <p className="text-xs text-gray-400">
                                {part.mediaType === "application/pdf"
                                  ? "PDF · Uploaded"
                                  : "File · Uploaded"}
                              </p>
                            </div>
                          </a>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              ))}

              {/* AI loading indicator */}
              {status === "submitted" && (
                <p className="text-sm text-gray-400">AI is thinking...</p>
              )}

              {/* AI streaming indicator */}
              {status === "streaming" && (
                <p className="text-sm text-gray-400">AI is responding...</p>
              )}

              {/* API error */}
              {error && (
                <p className="text-sm text-red-400">Error: {error.message}</p>
              )}
            </div>
          )}

          {/* Generated images, displayed as a clean ChatGPT-style result. */}
          {generatedImages.length > 0 && (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-8">
              {generatedImages.map((generatedImage) => (
                <div
                  key={generatedImage.id}
                  className="flex w-full flex-col items-end gap-3"
                >
                  <div className="max-w-[85%] rounded-[24px] bg-[#303030] px-4 py-3 text-sm leading-6 text-white">
                    {generatedImage.prompt}
                  </div>
                  <div className="w-full max-w-[560px] overflow-hidden rounded-2xl">
                    <a
                      href={generatedImage.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                      title="Open generated image"
                    >
                      <img
                        src={generatedImage.imageUrl}
                        alt={generatedImage.prompt}
                        className="block h-auto max-h-[720px] w-full rounded-2xl object-contain"
                      />
                    </a>
                    <div className="mt-2 flex items-center justify-between px-1">
                      <span className="text-xs text-gray-500">
                        Generated image
                      </span>
                      <a
                        href={generatedImage.imageUrl}
                        download="tt-generated-image.png"
                        className="rounded-lg px-3 py-1.5 text-xs text-gray-300 transition hover:bg-[#303030] hover:text-white"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message composer */}
        <div className="w-full px-4 pb-6">
          {/* Dropzone wrapper makes the composer accept drag-and-drop files. */}
          <div
            {...getRootProps()}
            className="relative mx-auto w-full max-w-3xl"
          >
            {/* Hidden input controlled by React Dropzone. */}
            <input {...getInputProps()} />

            {/* Overlay shown while files are dragged over the composer. */}
            {isDragActive && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl border-2 border-dashed border-white bg-black/80">
                <div className="text-center">
                  <Upload size={30} className="mx-auto mb-2" />
                  <p className="text-sm font-medium">Drop files here</p>
                </div>
              </div>
            )}

            {/* Selected and uploaded attachment previews. */}
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex w-full max-w-xs items-center gap-3 rounded-xl border border-[#424242] bg-[#303030] p-3"
                  >
                    {attachment.mimeType.startsWith("image/") ? (
                      <ImageIcon size={22} className="shrink-0 text-gray-300" />
                    ) : (
                      <FileText size={22} className="shrink-0 text-gray-300" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {attachment.fileName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {(attachment.size / 1024 / 1024).toFixed(2)} MB
                        {" · "}
                        {attachment.status === "uploading" && "Uploading..."}
                        {attachment.status === "uploaded" && "Uploaded"}
                        {attachment.status === "error" && "Upload failed"}
                      </p>

                      {attachment.status === "uploading" && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#555]">
                          <div
                            className="h-full rounded-full bg-white transition-all"
                            style={{ width: `${attachment.progress}%` }}
                          />
                        </div>
                      )}

                      {attachment.status === "error" && (
                        <p className="mt-1 text-xs text-red-400">
                          {attachment.error}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((previous) =>
                          previous.filter((item) => item.id !== attachment.id),
                        )
                      }
                      className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-[#484848] hover:text-white"
                      aria-label="Remove attachment"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Explain why a selected file was rejected. */}
            {fileRejections.length > 0 && (
              <p className="mb-2 text-xs text-red-400">
                Some files were rejected. Allowed: PDF, TXT, DOC, DOCX, JPG,
                PNG, WEBP and GIF. Maximum size: 10 MB.
              </p>
            )}

            {/* Image generation mode indicator. */}
            {imageMode && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-[#424242] bg-[#303030] px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-gray-200">
                  <ImagePlus size={17} />
                  <span>Image generation</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImageMode(false);
                    setImagePrompt("");
                  }}
                  className="cursor-pointer rounded-lg px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-[#424242] hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Chat and image generation share the same composer. */}
            <form
              onSubmit={imageMode ? handleGenerateImage : handleSubmit}
              className="flex items-end gap-3 rounded-3xl border border-[#424242] bg-[#303030] p-3 shadow-lg"
            >
              {/* Attachment menu and its trigger. */}
              <div ref={attachMenuRef} className="relative mb-1">
                <button
                  type="button"
                  onClick={() => setAttachMenuOpen((previous) => !previous)}
                  className="rounded-full p-2 text-gray-400 hover:bg-[#424242] hover:text-white"
                  aria-label="Open attachment menu"
                  aria-expanded={attachMenuOpen}
                  title="Attach files and tools"
                >
                  <Paperclip size={20} />
                </button>

                {/* Compact attachment menu with the five requested actions. */}
                {attachMenuOpen && (
                  <div className="absolute bottom-14 left-0 z-50 w-[280px] max-w-[85vw] rounded-2xl border border-[#424242] bg-[#252525] p-2 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        open();
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-gray-100 transition hover:bg-[#383838]"
                    >
                      <Paperclip size={18} className="text-gray-300" />
                      <span>Add from file</span>
                    </button>

                    <button
                      type="button"
                      disabled
                      title="Library support will be added later"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-gray-400 opacity-60"
                    >
                      <FolderOpen size={18} />
                      <span>Add from library</span>
                      <span className="ml-auto text-[10px]">Soon</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setImageMode(true);
                        setImagePrompt("");
                        setAttachMenuOpen(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-gray-100 transition hover:bg-[#383838]"
                    >
                      <ImagePlus size={18} className="text-gray-300" />
                      <span>Create image</span>
                    </button>

                    <div className="my-1 border-t border-[#3a3a3a]" />

                    <button
                      type="button"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        open();
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-gray-100 transition hover:bg-[#383838]"
                    >
                      <FileType size={18} className="text-gray-300" />
                      <span>PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        open();
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-gray-100 transition hover:bg-[#383838]"
                    >
                      <FileText size={18} className="text-gray-300" />
                      <span>Documentation</span>
                    </button>
                  </div>
                )}
              </div>

              {/* User message input. */}
              <textarea
                value={imageMode ? imagePrompt : input}
                onChange={(event) =>
                  imageMode
                    ? setImagePrompt(event.target.value)
                    : setInput(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  imageMode
                    ? "Describe the image you want to create..."
                    : "Ask TT chatbot..."
                }
                rows={1}
                className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-gray-500"
              />

              {/* Send button is disabled while files are uploading or have errors. */}
              <button
                type="submit"
                disabled={
                  imageMode
                    ? !imagePrompt.trim() || imageGenerating
                    : (!input.trim() && attachments.length === 0) ||
                      status !== "ready" ||
                      creatingConversation ||
                      attachments.some((file) => file.status === "uploading") ||
                      attachments.some((file) => file.status === "error")
                }
                className={`${
                  imageMode
                    ? "mb-1 flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-[#555555] disabled:text-gray-400"
                    : "mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-[#555555] disabled:text-gray-400"
                }`}
                aria-label={imageMode ? "Generate image" : "Send message"}
              >
                {imageMode ? (
                  imageGenerating ? (
                    "Generating..."
                  ) : (
                    "Generate"
                  )
                ) : (
                  <ArrowUp size={20} />
                )}
              </button>
            </form>
          </div>

          {/* Footer disclaimer. */}
          <p className="mt-3 text-center text-xs text-gray-500">
            AI can make mistakes. Check important information.
          </p>
        </div>
      </section>

      {/* Rename dialog */}
      {renamingConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#424242] bg-[#252525] p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Rename conversation</h2>

              <button
                onClick={() => setRenamingConversation(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-[#383838] hover:text-white"
                aria-label="Close rename dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRename}>
              <label className="mb-2 block text-sm text-gray-300">
                Conversation name
              </label>

              <input
                autoFocus
                maxLength={100}
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                className="w-full rounded-xl border border-[#424242] bg-[#171717] px-3 py-3 text-sm text-white outline-none focus:border-gray-500"
                placeholder="Enter a new name..."
              />

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenamingConversation(null)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-[#383838]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!renameTitle.trim() || actionLoading}
                  className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  <Check size={15} />
                  {actionLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deletingConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#424242] bg-[#252525] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Delete conversation?</h2>

              <button
                onClick={() => setDeletingConversation(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-[#383838] hover:text-white"
                aria-label="Close delete dialog"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm leading-6 text-gray-400">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-white">
                {deletingConversation.title}
              </span>
              ? This will permanently delete the conversation and all its
              messages.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingConversation(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-[#383838]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteConversation}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                <Trash2 size={15} />
                {actionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
