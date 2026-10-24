import { getAuthSession } from "@/libs/auth";
import { prisma } from "@/libs/prismaDb";
import { synthesizeSpeechWithGnani } from "@/libs/voice/gnaniClient";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	try {
		// 1. Authoritative NextAuth authentication check
		const session = await getAuthSession();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ message: "Authentication required to access voice synthesis." },
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

		const body = await request.json().catch(() => ({}));
		const rawText = (body.text as string)?.trim();
		const language = (body.language as string) || "hi-IN";

		if (!rawText) {
			return NextResponse.json(
				{ message: "Text parameter is required for speech synthesis." },
				{ status: 400 }
			);
		}

		// 3. Call Gnani Timbre TTS (Server-to-Server)
		const audioBuffer = await synthesizeSpeechWithGnani(rawText, {
			language,
		});

		// 4. Return binary WAV audio stream with caching headers
		return new Response(audioBuffer as unknown as BodyInit, {
			status: 200,
			headers: {
				"Content-Type": "audio/wav",
				"Content-Length": String(audioBuffer.byteLength),
				"Cache-Control": "private, max-age=3600", // Cache audio response
			},
		});
	} catch (error: any) {
		const errorMsg = error?.message || "";

		if (errorMsg.includes("GNANI_CONFIG_ERROR")) {
			return NextResponse.json(
				{
					message:
						"Gnani TTS is not configured. Add GNANI_API_KEY in server .env to enable spoken replies.",
					code: "GNANI_API_KEY_MISSING",
				},
				{ status: 503 }
			);
		}

		if (errorMsg.includes("GNANI_AUTH_ERROR")) {
			return NextResponse.json(
				{
					message: "Gnani API authentication failed for TTS.",
					code: "GNANI_AUTH_FAILED",
				},
				{ status: 502 }
			);
		}

		if (errorMsg.includes("GNANI_RATE_LIMIT")) {
			return NextResponse.json(
				{
					message: "Gnani TTS credit quota exceeded.",
					code: "GNANI_RATE_LIMIT",
				},
				{ status: 429 }
			);
		}

		console.warn("[POST /api/user/voice/tts] Warning:", errorMsg);
		return NextResponse.json(
			{
				message: "Failed to synthesize speech audio.",
				error: process.env.NODE_ENV === "development" ? errorMsg : undefined,
			},
			{ status: 500 }
		);
	}
}
