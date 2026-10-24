import { getAuthSession } from "@/libs/auth";
import { prisma } from "@/libs/prismaDb";
import { transcribeAudioWithGnani } from "@/libs/voice/gnaniClient";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Maximum audio payload size: 10MB
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = [
	"audio/webm",
	"audio/wav",
	"audio/x-wav",
	"audio/ogg",
	"audio/mp4",
	"audio/m4a",
	"audio/mpeg",
	"audio/mp3",
	"application/octet-stream", // Fallback for some browser blob uploads
];

export async function POST(request: Request) {
	try {
		// 1. Authoritative NextAuth authentication check
		const session = await getAuthSession();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ message: "Authentication required to access voice assistant." },
				{ status: 401 }
			);
		}

		if (session.user.role === "ADMIN") {
			return NextResponse.json(
				{ message: "Admin accounts use the administrative panel." },
				{ status: 403 }
			);
		}

		// 2. Check owner account status
		const owner = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: { id: true, status: true },
		});

		if (!owner || owner.status === "SUSPENDED") {
			return NextResponse.json(
				{ message: "Your account is suspended. Please contact support." },
				{ status: 403 }
			);
		}

		// 3. Extract audio multipart data
		const formData = await request.formData().catch(() => null);
		if (!formData) {
			return NextResponse.json(
				{ message: "Invalid form data. Expected multipart audio payload." },
				{ status: 400 }
			);
		}

		const audioEntry = formData.get("audio") || formData.get("audio_file");
		if (!audioEntry || !(audioEntry instanceof Blob)) {
			return NextResponse.json(
				{ message: "No audio file provided in request." },
				{ status: 400 }
			);
		}

		const audioBlob = audioEntry as Blob;
		const audioSizeBytes = audioBlob.size;

		if (audioSizeBytes === 0) {
			return NextResponse.json(
				{
					message: "Empty audio recording. Please speak clearly and try again.",
				},
				{ status: 400 }
			);
		}

		if (audioSizeBytes > MAX_AUDIO_SIZE_BYTES) {
			return NextResponse.json(
				{
					message: `Audio file exceeds maximum size limit of ${
						MAX_AUDIO_SIZE_BYTES / (1024 * 1024)
					}MB.`,
				},
				{ status: 413 }
			);
		}

		const mimeType = audioBlob.type || "audio/webm";
		const isAllowedMime = ALLOWED_MIME_PREFIXES.some((prefix) =>
			mimeType.toLowerCase().startsWith(prefix)
		);

		if (!isAllowedMime) {
			return NextResponse.json(
				{
					message: `Unsupported audio format (${mimeType}). Supported formats: WebM, WAV, OGG, MP4.`,
				},
				{ status: 415 }
			);
		}

		const languageCode = (formData.get("languageCode") as string) || "hi-IN";

		// 4. Convert Blob to ArrayBuffer -> Buffer
		const arrayBuffer = await audioBlob.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// 5. Call Gnani STT API (Server-to-Server)
		const sttResult = await transcribeAudioWithGnani(buffer, mimeType, {
			languageCode,
			preferredLanguage: languageCode,
		});

		if (!sttResult.transcript) {
			return NextResponse.json(
				{
					success: true,
					transcript: "",
					message:
						"No speech recognized. Please speak closer to the microphone.",
				},
				{ status: 200 }
			);
		}

		return NextResponse.json({
			success: true,
			transcript: sttResult.transcript,
			language: sttResult.language,
		});
	} catch (error: any) {
		const errorMsg = error?.message || "";

		// Handle missing Gnani configuration specifically so user gets clear guidance
		if (errorMsg.includes("GNANI_CONFIG_ERROR")) {
			return NextResponse.json(
				{
					message:
						"Gnani STT is not configured. Please add GNANI_API_KEY in your server .env file or use typed input below.",
					code: "GNANI_API_KEY_MISSING",
				},
				{ status: 503 }
			);
		}

		if (errorMsg.includes("GNANI_AUTH_ERROR")) {
			return NextResponse.json(
				{
					message:
						"Gnani API key authentication failed. Please check credentials.",
					code: "GNANI_AUTH_FAILED",
				},
				{ status: 502 }
			);
		}

		if (errorMsg.includes("GNANI_TIMEOUT")) {
			return NextResponse.json(
				{
					message: "Speech recognition request timed out. Please try again.",
					code: "GNANI_TIMEOUT",
				},
				{ status: 504 }
			);
		}

		if (errorMsg.includes("GNANI_RATE_LIMIT")) {
			return NextResponse.json(
				{
					message:
						"Gnani STT credit quota ya rate limit exceed ho gayi hai. Kuch der baad try karein.",
					code: "GNANI_RATE_LIMIT",
				},
				{ status: 429 }
			);
		}

		console.error("[POST /api/user/voice/transcribe] Error:", error);
		return NextResponse.json(
			{
				message:
					"Failed to transcribe audio. Please try again or type your question.",
				// Expose readable error always (not just dev), since owner needs to debug mic/API issues
				detail:
					errorMsg?.replace(/^GNANI_\w+:\s*/, "").slice(0, 200) || undefined,
				error: process.env.NODE_ENV === "development" ? errorMsg : undefined,
			},
			{ status: 500 }
		);
	}
}
