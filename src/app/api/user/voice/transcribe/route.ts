import { getAuthSession } from "@/libs/auth";
import { prisma } from "@/libs/prismaDb";
import { transcribeAudioWithGnani } from "@/libs/voice/gnaniClient";
import { transcribeAudioWithGroqWhisper } from "@/libs/voice/groqClient";
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
		let transcript = "";
		let detectedLanguage = languageCode;
		let gnaniError: string | null = null;

		// Helper to detect repetitive hallucinations (e.g. "झाल झाल झाल", "word word word")
		const isRepetitiveHallucination = (text: string) => {
			const words = text.trim().split(/\s+/);
			return (
				words.length >= 3 &&
				words.every((w) => w.toLowerCase() === words[0].toLowerCase())
			);
		};

		// 5. Primary Engine: Groq Whisper (whisper-large-v3-turbo)
		// Built-in Language Identification (LID) auto-detects English, Hindi, Gujarati, Hinglish with zero hallucination!
		if (process.env.GROQ_API_KEY) {
			try {
				const whisperResult = await transcribeAudioWithGroqWhisper(
					buffer,
					mimeType,
					languageCode
				);
				if (
					whisperResult?.transcript &&
					!isRepetitiveHallucination(whisperResult.transcript)
				) {
					transcript = whisperResult.transcript;
					detectedLanguage = whisperResult.language || languageCode;
				}
			} catch (whisperErr: any) {
				console.warn(
					"[STT] Groq Whisper attempt failed, falling back to Gnani STT:",
					whisperErr?.message || whisperErr
				);
			}
		}

		// 6. Secondary Engine / Fallback: Gnani STT API (Prisma STT)
		if (!transcript && process.env.GNANI_API_KEY) {
			try {
				const gnaniLang = languageCode === "auto" ? "hi-IN" : languageCode;
				const sttResult = await transcribeAudioWithGnani(buffer, mimeType, {
					languageCode: gnaniLang,
					preferredLanguage: gnaniLang,
				});
				if (
					sttResult.transcript &&
					!isRepetitiveHallucination(sttResult.transcript)
				) {
					transcript = sttResult.transcript;
					detectedLanguage = sttResult.language || languageCode;
				}
			} catch (err: any) {
				gnaniError = err?.message || String(err);
				console.warn("[STT] Gnani STT fallback failed:", gnaniError);
			}
		}

		// 8. Return successful transcript
		if (transcript) {
			return NextResponse.json({
				success: true,
				transcript,
				language: detectedLanguage,
			});
		}

		// If no speech was detected in valid audio
		if (!gnaniError) {
			return NextResponse.json(
				{
					success: true,
					transcript: "",
					message:
						"No speech recognized. Please speak closer to the microphone or type below.",
				},
				{ status: 200 }
			);
		}

		// Return clean error response
		return NextResponse.json(
			{
				message:
					"Audio recognize nahi ho saka. Kripya dobara bolein ya niche type karein.",
				detail: gnaniError?.replace(/^GNANI_\w+:\s*/, "").slice(0, 200),
			},
			{ status: 500 }
		);
	} catch (error: any) {
		console.error("[POST /api/user/voice/transcribe] Fatal error:", error);
		return NextResponse.json(
			{
				message:
					"Failed to transcribe audio. Please try again or type your question.",
				error: error?.message,
			},
			{ status: 500 }
		);
	}
}
