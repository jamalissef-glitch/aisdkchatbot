import { NextResponse } from "next/server";

export const runtime = "nodejs";

const IMAGE_MODEL = "bytedance-seed/seedream-5-0-flash";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        { success: false, message: "Image prompt is required." },
        { status: 400 },
      );
    }

    if (prompt.length > 4000) {
      return NextResponse.json(
        { success: false, message: "Prompt is too long." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error("OpenRouter API key is not configured.");
    }

    const response = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        resolution: "1K",
        aspect_ratio: "1:1",
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();

      console.error("OpenRouter image error:", errorDetails);

      return NextResponse.json(
        {
          success: false,
          message: "Image generation failed. Please try again.",
        },
        { status: response.status },
      );
    }

    const result = await response.json();

    const generatedImage = result.data?.[0];

    if (!generatedImage?.b64_json) {
      throw new Error("No image data returned from OpenRouter.");
    }

    const mediaType = generatedImage.media_type || "image/png";

    return NextResponse.json({
      success: true,
      image: `data:${mediaType};base64,${generatedImage.b64_json}`,
      model: IMAGE_MODEL,
      usage: result.usage ?? null,
    });
  } catch (error) {
    console.error("Image generation API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while generating the image.",
      },
      { status: 500 },
    );
  }
}
