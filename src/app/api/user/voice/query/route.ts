import { getAuthSession } from "@/libs/auth";
import { prisma } from "@/libs/prismaDb";
import {
	executeRoomBedQuery,
	resolveRoomBedIntent,
} from "@/libs/voice/roomBedQueryService";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	try {
		// 1. Authoritative NextAuth authentication check
		const session = await getAuthSession();
		if (!session?.user?.id) {
			return NextResponse.json(
				{ message: "Authentication required to query PG Saathi AI." },
				{ status: 401 }
			);
		}

		if (session.user.role === "ADMIN") {
			return NextResponse.json(
				{ message: "Admin accounts use the administrative portal." },
				{ status: 403 }
			);
		}

		// 2. Check owner account status
		const owner = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: { id: true, status: true, setupCompleted: true },
		});

		if (!owner || owner.status === "SUSPENDED") {
			return NextResponse.json(
				{ message: "Your account is suspended. Please contact support." },
				{ status: 403 }
			);
		}

		const body = await request.json().catch(() => ({}));
		const rawQuery = (body.query as string)?.trim();
		const propertyId = (body.propertyId as string)?.trim();
		const correlationId = (body.correlationId as string)?.trim();
		const context = body.context;

		if (!rawQuery) {
			return NextResponse.json(
				{ message: "Query text is required." },
				{ status: 400 }
			);
		}

		// 3. Resolve intent (Deterministic regex first with conversational follow-up memory, Groq fallback if ambiguous)
		const intent = await resolveRoomBedIntent(rawQuery, context);

		// 4. Execute deterministic query scoped strictly to this authenticated owner
		const result = await executeRoomBedQuery(
			session.user.id,
			intent,
			propertyId
		);

		return NextResponse.json({
			...result,
			correlationId,
		});
	} catch (error: any) {
		console.error("[POST /api/user/voice/query] Error:", error);
		return NextResponse.json(
			{
				message:
					"An error occurred while processing your query. Please try again.",
				error:
					process.env.NODE_ENV === "development" ? error?.message : undefined,
			},
			{ status: 500 }
		);
	}
}
