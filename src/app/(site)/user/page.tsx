import { Badge, Button, Card, CardContent } from "@/components/Common/UI";
import { getAuthSession } from "@/libs/auth";
import { formatIndianMobile, formatINR } from "@/libs/formatters";
import { prisma } from "@/libs/prismaDb";
import {
	calculateRentSummary,
	formatBillingPeriod,
	getBillingPeriodString,
} from "@/libs/rentLedger";
import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
	title: "Owner Dashboard | ChooseBed",
	description: "Operations dashboard for ChooseBed PG and hostel owners.",
};

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
	// 1. Authoritative session verification
	const session = await getAuthSession();
	if (!session?.user?.id) {
		redirect("/auth/signin");
	}

	// 2. Strict Role Segregation: Admins belong exclusively in /admin
	if (session.user.role === "ADMIN") {
		redirect("/admin");
	}

	// 3. Query authoritative user and properties from database
	const dbUser = await prisma.user.findUnique({
		where: { id: session.user.id },
		select: {
			id: true,
			name: true,
			email: true,
			phone: true,
			role: true,
			status: true,
			setupCompleted: true,
			properties: {
				orderBy: { createdAt: "desc" },
				include: {
					rooms: {
						orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
						include: {
							beds: {
								orderBy: { bedNumber: "asc" },
							},
						},
					},
					residents: {
						orderBy: [{ status: "asc" }, { checkInDate: "desc" }],
						include: {
							room: { select: { roomNumber: true, floor: true } },
							bed: { select: { bedNumber: true } },
						},
					},
				},
			},
		},
	});

	if (!dbUser) {
		redirect("/auth/signin");
	}

	if (dbUser.status === "SUSPENDED") {
		redirect("/auth/signin?error=AccountSuspended");
	}

	// 4. Incomplete setup guard: If setup is pending or no property exists, force to /user/setup
	if (!dbUser.setupCompleted || dbUser.properties.length === 0) {
		redirect("/user/setup");
	}

	const activeProperty = dbUser.properties[0];
	const totalProperties = dbUser.properties.length;

	// Calculate operational metrics across all owner properties (or active property)
	const allRooms = dbUser.properties.flatMap((p) => p.rooms);
	const totalRooms = allRooms.length;
	const allBeds = allRooms.flatMap((r) => r.beds);
	const totalBeds = allBeds.length;
	const occupiedBeds = allBeds.filter((b) => b.status === "OCCUPIED").length;
	const availableBeds = allBeds.filter((b) => b.status === "AVAILABLE").length;
	const occupancyPercentage =
		totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

	// Resident metrics
	const allResidents = dbUser.properties.flatMap((p) => p.residents || []);
	const activeResidents = allResidents.filter((r) => r.status === "ACTIVE");
	const activeResidentCount = activeResidents.length;

	// Phase F: Query all rent charges and payments across owner properties
	const ownerPropertyIds = dbUser.properties.map((p) => p.id);
	const allRentCharges = await prisma.rentCharge.findMany({
		where: { propertyId: { in: ownerPropertyIds } },
		include: {
			payments: { select: { id: true, amount: true, paymentDate: true } },
		},
	});

	const currentBillingPeriod = getBillingPeriodString();
	const now = new Date();
	const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const currentMonthEnd = new Date(
		now.getFullYear(),
		now.getMonth() + 1,
		0,
		23,
		59,
		59,
		999
	);

	let totalOutstandingRent = 0;
	let totalOverdueRent = 0;
	let overdueChargesCount = 0;
	const residentsWithOutstandingSet = new Set<string>();

	let monthCollectionCurrentDues = 0;
	let monthCollectionOlderDues = 0;

	allRentCharges.forEach((charge) => {
		const summary = calculateRentSummary(charge, now);
		if (summary.remainingBalance > 0) {
			totalOutstandingRent += summary.remainingBalance;
			residentsWithOutstandingSet.add(charge.residentId);
			if (summary.isOverdue) {
				totalOverdueRent += summary.remainingBalance;
				overdueChargesCount++;
			}
		}

		// Calculate payments received during this calendar month
		charge.payments.forEach((p) => {
			const pDate = new Date(p.paymentDate);
			if (pDate >= currentMonthStart && pDate <= currentMonthEnd) {
				if (charge.billingPeriod === currentBillingPeriod) {
					monthCollectionCurrentDues += p.amount;
				} else {
					monthCollectionOlderDues += p.amount;
				}
			}
		});
	});

	const totalCollectedThisMonth =
		monthCollectionCurrentDues + monthCollectionOlderDues;
	const residentsWithOutstandingCount = residentsWithOutstandingSet.size;

	const formatPropertyType = (t: string) => {
		const typeLabels: Record<string, string> = {
			PG: "PG",
			HOSTEL: "Hostel",
			BOTH: "Both PG & Hostel",
		};
		return typeLabels[t] || "Both PG & Hostel";
	};

	const formatGender = (g: string) => {
		const genderLabels: Record<string, string> = {
			BOYS: "Boys PG/Hostel",
			GIRLS: "Girls PG/Hostel",
			COED: "Co-ed PG/Hostel",
		};
		return genderLabels[g] || "Co-ed PG/Hostel";
	};

	return (
		<div className='space-y-6 sm:space-y-8'>
			{/* Top Header & Property Context */}
			<div className='flex flex-col justify-between gap-4 border-b border-stroke pb-6 dark:border-stroke-dark sm:flex-row sm:items-center'>
				<div>
					<div className='flex flex-wrap items-center gap-2.5'>
						<h1 className='font-satoshi text-2xl font-bold tracking-tight text-dark dark:text-white sm:text-3xl'>
							{activeProperty.name}
						</h1>
						<Badge variant='success' size='sm'>
							Active PG/Hostel
						</Badge>
						<Badge variant='neutral' size='sm'>
							{formatPropertyType(activeProperty.type)}
						</Badge>
						<Badge variant='neutral' size='sm'>
							{formatGender(activeProperty.gender)}
						</Badge>
					</div>
					<p className='mt-1 text-xs text-body dark:text-gray-4 sm:text-sm'>
						📍 {activeProperty.address}, {activeProperty.area},{" "}
						{activeProperty.city}
					</p>
				</div>

				<div className='flex flex-wrap items-center gap-3'>
					<Link href='/user/account-settings'>
						<Button variant='outline' size='sm'>
							Account Settings
						</Button>
					</Link>
					<Button
						variant='primary'
						size='sm'
						disabled
						title='Multi-property management coming soon'
					>
						+ Add Another Property
					</Button>
				</div>
			</div>

			{/* Operational Metrics Cards (Real Data Grounded) */}
			<div>
				<div className='mb-3 flex items-center justify-between'>
					<h2 className='text-xs font-semibold uppercase tracking-wider text-body dark:text-gray-4'>
						Key Operational Metrics
					</h2>
					<span className='text-xs font-medium text-slate-500 dark:text-slate-400'>
						Live Property Data
					</span>
				</div>

				<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
					{/* Total Properties */}
					<Card>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<span className='text-xs font-medium text-body dark:text-gray-4'>
									Total PG/Hostel Properties
								</span>
								<span className='rounded-full bg-primary/10 p-2 text-primary'>
									<svg
										className='size-4'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
											d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
										/>
									</svg>
								</span>
							</div>
							<div className='mt-2 flex items-baseline gap-2'>
								<span className='font-satoshi text-2xl font-bold text-dark dark:text-white'>
									{totalProperties}
								</span>
								<span className='text-xs text-body dark:text-gray-4'>
									Registered facility
								</span>
							</div>
							<p className='mt-2 text-xs text-emerald-700 dark:text-emerald-400'>
								Verified in {activeProperty.city}
							</p>
						</CardContent>
					</Card>

					{/* Total Rooms */}
					<Card>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<span className='text-xs font-medium text-body dark:text-gray-4'>
									Total Configured Rooms
								</span>
								<span className='rounded-full bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
									<svg
										className='size-4'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
											d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
										/>
									</svg>
								</span>
							</div>
							<div className='mt-2 flex items-baseline gap-2'>
								<span className='font-satoshi text-2xl font-bold text-dark dark:text-white'>
									{totalRooms}
								</span>
								<span className='text-xs text-body dark:text-gray-4'>
									Rooms configured
								</span>
							</div>
							<p className='mt-2 text-xs text-body dark:text-gray-4'>
								{totalRooms > 0 ? (
									<Link
										href='/user/rooms'
										className='font-medium text-emerald-800 hover:underline dark:text-emerald-400'
									>
										View {totalRooms} rooms →
									</Link>
								) : (
									<Link
										href='/user/rooms?action=add'
										className='font-medium text-emerald-800 hover:underline dark:text-emerald-400'
									>
										+ Add first room
									</Link>
								)}
							</p>
						</CardContent>
					</Card>

					{/* Bed Occupancy */}
					<Card>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<span className='text-xs font-medium text-body dark:text-gray-4'>
									Bed Occupancy
								</span>
								<span className='rounded-full bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
									<svg
										className='size-4'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
											d='M4 6h16M4 10h16M4 14h16M4 18h16'
										/>
									</svg>
								</span>
							</div>
							<div className='mt-2 flex items-baseline gap-2'>
								<span className='font-satoshi text-2xl font-bold text-dark dark:text-white'>
									{totalBeds > 0 ? `${occupancyPercentage}%` : "0%"}
								</span>
								<span className='text-xs text-body dark:text-gray-4'>
									{occupiedBeds} / {totalBeds} Beds occupied
								</span>
							</div>
							<p className='mt-2 text-xs text-body dark:text-gray-4'>
								{totalBeds === 0
									? "No beds configured yet"
									: `${availableBeds} beds available for allocation`}
							</p>
						</CardContent>
					</Card>

					{/* Active Residents */}
					<Card>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<span className='text-xs font-medium text-body dark:text-gray-4'>
									Active Residents
								</span>
								<span className='rounded-full bg-blue-500/10 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-400'>
									<svg
										className='size-4'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
											d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
										/>
									</svg>
								</span>
							</div>
							<div className='mt-2 flex items-baseline gap-2'>
								<span className='font-satoshi text-2xl font-bold text-dark dark:text-white'>
									{activeResidentCount}
								</span>
								<span className='text-xs text-body dark:text-gray-4'>
									{activeResidentCount === 1
										? "Active resident"
										: "Active residents"}
								</span>
							</div>
							<p className='mt-2 text-xs text-body dark:text-gray-4'>
								{activeResidentCount > 0 ? (
									<Link
										href='/user/residents'
										className='font-medium text-emerald-800 hover:underline dark:text-emerald-400'
									>
										Manage {activeResidentCount} resident(s) →
									</Link>
								) : (
									<Link
										href='/user/residents?action=add'
										className='font-medium text-emerald-800 hover:underline dark:text-emerald-400'
									>
										+ Check in first resident
									</Link>
								)}
							</p>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Rent & Collections Overview (Live Ledger Data) */}
			<div>
				<div className='mb-3 flex items-center justify-between'>
					<div>
						<h2 className='text-xs font-semibold uppercase tracking-wider text-body dark:text-gray-4'>
							Rent & Collections Overview
						</h2>
						<span className='text-[11px] text-slate-500 dark:text-slate-400'>
							{formatBillingPeriod(currentBillingPeriod)} • Live Ledger
						</span>
					</div>
					<Link
						href='/user/billing'
						className='text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-400'
					>
						Open Full Rent Ledger →
					</Link>
				</div>

				<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
					{/* Collected This Month */}
					<Card>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<span className='text-xs font-medium text-body dark:text-gray-4'>
									Collected This Month
								</span>
								<span className='rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'>
									✓
								</span>
							</div>
							<div className='mt-2 flex items-baseline gap-2'>
								<span className='font-satoshi text-2xl font-bold text-emerald-700 dark:text-emerald-400'>
									{formatINR(totalCollectedThisMonth)}
								</span>
							</div>
							<p className='mt-2 text-[11px] text-body dark:text-gray-4'>
								{monthCollectionCurrentDues > 0 || monthCollectionOlderDues > 0
									? `Current: ${formatINR(monthCollectionCurrentDues)} • Older Dues: ${formatINR(monthCollectionOlderDues)}`
									: "No payments recorded yet this month"}
							</p>
						</CardContent>
					</Card>

					{/* Total Outstanding Dues */}
					<Card>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<span className='text-xs font-medium text-body dark:text-gray-4'>
									Total Outstanding Dues
								</span>
								<span className='rounded-full bg-blue-500/10 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-400'>
									⏳
								</span>
							</div>
							<div className='mt-2 flex items-baseline gap-2'>
								<span className='font-satoshi text-2xl font-bold text-dark dark:text-white'>
									{formatINR(totalOutstandingRent)}
								</span>
							</div>
							<p className='mt-2 text-xs text-body dark:text-gray-4'>
								{residentsWithOutstandingCount === 1
									? "1 resident with pending dues"
									: `${residentsWithOutstandingCount} residents with pending dues`}
							</p>
						</CardContent>
					</Card>

					{/* Overdue Balance */}
					<Card>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<span className='text-xs font-medium text-body dark:text-gray-4'>
									Overdue Rent
								</span>
								<span className='rounded-full bg-rose-500/10 p-2 text-rose-600 dark:bg-rose-950 dark:text-rose-400'>
									⚠️
								</span>
							</div>
							<div className='mt-2 flex items-baseline gap-2'>
								<span
									className={`font-satoshi text-2xl font-bold ${
										totalOverdueRent > 0
											? "text-rose-600 dark:text-rose-400"
											: "text-dark dark:text-white"
									}`}
								>
									{formatINR(totalOverdueRent)}
								</span>
							</div>
							<p className='mt-2 text-xs text-body dark:text-gray-4'>
								{overdueChargesCount === 1
									? "1 charge past due date"
									: `${overdueChargesCount} charges past due date`}
							</p>
						</CardContent>
					</Card>

					{/* Ledger Navigation / Quick Action */}
					<Card>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<span className='text-xs font-medium text-body dark:text-gray-4'>
									Rent Ledger Actions
								</span>
								<span className='rounded-full bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
									📑
								</span>
							</div>
							<div className='mt-2'>
								<span className='font-satoshi text-sm font-bold text-dark dark:text-white'>
									{allRentCharges.length} Recorded Charges
								</span>
							</div>
							<p className='mt-2 text-xs'>
								<Link
									href='/user/billing'
									className='font-semibold text-emerald-800 hover:underline dark:text-emerald-400'
								>
									Record payment / print receipts →
								</Link>
							</p>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Main Grid: Real Property Identity & Modules Empty States */}
			<div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
				{/* Left 2 Cols: Property Profile & Modules Empty State */}
				<div className='space-y-6 lg:col-span-2'>
					{/* Active Property Card */}
					<Card className='border-[#E8E3D8] bg-white shadow-sm dark:border-[#1E382B] dark:bg-[#071711]'>
						<CardContent className='p-5 sm:p-6'>
							<div className='flex items-start justify-between'>
								<div>
									<span className='text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400'>
										Primary Facility Profile
									</span>
									<h3 className='mt-1 font-satoshi text-lg font-bold text-slate-900 dark:text-white sm:text-xl'>
										{activeProperty.name}
									</h3>
									<p className='mt-0.5 text-xs text-slate-500 dark:text-slate-400'>
										{activeProperty.address}, {activeProperty.area},{" "}
										{activeProperty.city}
									</p>
								</div>
								<span className='flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1A382B] to-[#10B981] font-satoshi text-base font-bold text-white shadow-sm'>
									🏠
								</span>
							</div>

							<div className='mt-5 grid grid-cols-2 gap-3 border-t border-[#E8E3D8] pt-4 text-xs dark:border-[#1E382B] sm:grid-cols-4'>
								<div className='rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-[#0A1F17]'>
									<p className='text-[10px] uppercase text-slate-400'>
										Category
									</p>
									<p className='mt-0.5 font-bold text-slate-800 dark:text-slate-200'>
										{formatPropertyType(activeProperty.type)}
									</p>
								</div>
								<div className='rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-[#0A1F17]'>
									<p className='text-[10px] uppercase text-slate-400'>
										Resident Type
									</p>
									<p className='mt-0.5 font-bold text-slate-800 dark:text-slate-200'>
										{formatGender(activeProperty.gender)}
									</p>
								</div>
								<div className='rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-[#0A1F17]'>
									<p className='text-[10px] uppercase text-slate-400'>
										City / Area
									</p>
									<p className='mt-0.5 truncate font-bold text-slate-800 dark:text-slate-200'>
										{activeProperty.city}
									</p>
								</div>
								<div className='rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-[#0A1F17]'>
									<p className='text-[10px] uppercase text-slate-400'>
										Owner Mobile
									</p>
									<p className='mt-0.5 truncate font-bold text-slate-800 dark:text-slate-200'>
										{formatIndianMobile(dbUser.phone) || "Not provided"}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Rooms & Beds Inventory Live Overview or Empty State */}
					{totalRooms === 0 ? (
						<Card className='border-[#E8E3D8] bg-white shadow-sm dark:border-[#1E382B] dark:bg-[#071711]'>
							<CardContent className='p-6 text-center sm:p-8'>
								<div className='mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
									<svg
										className='size-6'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
											d='M4 6h16M4 10h16M4 14h16M4 18h16'
										/>
									</svg>
								</div>

								<h3 className='mt-4 font-satoshi text-base font-bold text-slate-900 dark:text-white sm:text-lg'>
									No Rooms or Beds Configured Yet
								</h3>

								<p className='mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm'>
									Your PG/Hostel building is officially registered! Start adding
									your floor-wise room layouts, single/double sharing
									allocations, and real-time bed inventories.
								</p>

								<div className='mt-5 flex items-center justify-center gap-3'>
									<Link href='/user/rooms?action=add'>
										<Button variant='primary' size='sm'>
											+ Add Your First Room
										</Button>
									</Link>
									<Link href='/user/rooms'>
										<Button variant='outline' size='sm'>
											Open Rooms & Beds
										</Button>
									</Link>
								</div>
							</CardContent>
						</Card>
					) : (
						<Card className='border-[#E8E3D8] bg-white shadow-sm dark:border-[#1E382B] dark:bg-[#071711]'>
							<CardContent className='p-5 sm:p-6'>
								<div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-center'>
									<div>
										<span className='text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400'>
											Live Inventory Overview
										</span>
										<h3 className='mt-1 font-satoshi text-lg font-bold text-slate-900 dark:text-white sm:text-xl'>
											Configured Rooms & Bed Allocation
										</h3>
										<p className='mt-0.5 text-xs text-slate-500 dark:text-slate-400'>
											{totalRooms} room(s) with {totalBeds} total bed(s) in{" "}
											{activeProperty.name}
										</p>
									</div>
									<div className='flex items-center gap-2'>
										<Link href='/user/rooms?action=add'>
											<Button variant='outline' size='sm'>
												+ Add Room
											</Button>
										</Link>
										<Link href='/user/rooms'>
											<Button variant='primary' size='sm'>
												Manage All Rooms →
											</Button>
										</Link>
									</div>
								</div>

								{/* Recent rooms list */}
								<div className='mt-4 divide-y divide-slate-100 border-t border-[#E8E3D8] pt-3 dark:divide-slate-800 dark:border-[#1E382B]'>
									{activeProperty.rooms.slice(0, 4).map((r) => {
										const avail = r.beds.filter(
											(b) => b.status === "AVAILABLE"
										).length;
										return (
											<div
												key={r.id}
												className='flex items-center justify-between py-2.5 text-xs'
											>
												<div className='flex items-center gap-3'>
													<span className='rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-900 dark:bg-slate-800 dark:text-white'>
														Room {r.roomNumber}
													</span>
													<span className='text-slate-500 dark:text-slate-400'>
														{r.floor} • {r.sharing.toLowerCase()} sharing
													</span>
													<span className='rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300'>
														{r.acType === "AC" ? "❄️ AC" : "Non-AC"}
													</span>
												</div>
												<div className='flex items-center gap-2'>
													<span className='font-semibold text-emerald-800 dark:text-emerald-400'>
														{avail}/{r.beds.length} Available
													</span>
												</div>
											</div>
										);
									})}
								</div>

								{activeProperty.rooms.length > 4 && (
									<div className='mt-3 border-t border-slate-100 pt-2 text-center dark:border-slate-800'>
										<Link
											href='/user/rooms'
											className='text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-400'
										>
											+ View remaining {activeProperty.rooms.length - 4} rooms
											in {activeProperty.name} →
										</Link>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Residents Management Section */}
					{activeResidentCount > 0 ? (
						<Card className='border-[#E8E3D8] bg-white shadow-sm dark:border-[#1E382B] dark:bg-[#071711]'>
							<CardContent className='p-5 sm:p-6'>
								<div className='flex items-center justify-between'>
									<div>
										<h3 className='font-satoshi text-base font-bold text-slate-900 dark:text-white sm:text-lg'>
											Active Residents ({activeResidentCount})
										</h3>
										<p className='text-xs text-slate-500 dark:text-slate-400'>
											Currently checked in across {activeProperty.name}
										</p>
									</div>
									<Link href='/user/residents'>
										<Button variant='outline' size='sm'>
											View All →
										</Button>
									</Link>
								</div>

								<div className='mt-4 divide-y divide-slate-100 border-t border-[#E8E3D8] pt-3 dark:divide-slate-800 dark:border-[#1E382B]'>
									{activeResidents.slice(0, 4).map((r) => (
										<div
											key={r.id}
											className='flex items-center justify-between py-2.5 text-xs'
										>
											<div className='flex items-center gap-3'>
												<div className='flex size-8 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'>
													{r.name.charAt(0).toUpperCase()}
												</div>
												<div>
													<p className='font-semibold text-slate-900 dark:text-white'>
														{r.name}
													</p>
													<p className='text-[11px] text-slate-500 dark:text-slate-400'>
														{r.phone}
													</p>
												</div>
											</div>
											<div className='text-right'>
												<span className='rounded-lg bg-slate-100 px-2 py-0.5 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200'>
													Room {r.room.roomNumber} • Bed {r.bed.bedNumber}
												</span>
												<p className='mt-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400'>
													{formatINR(r.monthlyRent)}/mo
												</p>
											</div>
										</div>
									))}
								</div>

								{activeResidents.length > 4 && (
									<div className='mt-3 border-t border-slate-100 pt-2 text-center dark:border-slate-800'>
										<Link
											href='/user/residents'
											className='text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-400'
										>
											+ View remaining {activeResidents.length - 4} residents →
										</Link>
									</div>
								)}
							</CardContent>
						</Card>
					) : (
						<Card className='border-[#E8E3D8] bg-white shadow-sm dark:border-[#1E382B] dark:bg-[#071711]'>
							<CardContent className='p-6 text-center sm:p-8'>
								<div className='mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
									<svg
										className='size-6'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
											d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
										/>
									</svg>
								</div>

								<h3 className='mt-4 font-satoshi text-base font-bold text-slate-900 dark:text-white sm:text-lg'>
									No Residents Checked In
								</h3>

								<p className='mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm'>
									Now that your property is set up, you can onboard residents,
									allocate available beds, and maintain digital check-in
									records.
								</p>

								<div className='mt-5 flex items-center justify-center gap-2'>
									<Link href='/user/residents?action=add'>
										<Button variant='primary' size='sm'>
											+ Onboard First Resident
										</Button>
									</Link>
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				{/* Right 1 Col: Onboarding Roadmap Checklist */}
				<div className='space-y-6'>
					<Card className='border-[#E8E3D8] bg-white shadow-sm dark:border-[#1E382B] dark:bg-[#071711]'>
						<CardContent className='p-5 sm:p-6'>
							<h3 className='font-satoshi text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300'>
								PG/Hostel Setup Roadmap
							</h3>
							<p className='mt-0.5 text-xs text-slate-500 dark:text-slate-400'>
								Your operational onboarding progress
							</p>

							<div className='mt-4 space-y-3.5'>
								{/* Step 1: Done */}
								<div className='flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/40'>
									<div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white'>
										✓
									</div>
									<div>
										<h4 className='text-xs font-bold text-emerald-950 dark:text-emerald-200'>
											Step 1: PG/Hostel Registered
										</h4>
										<p className='mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-300'>
											{activeProperty.name} is active in {activeProperty.city}.
										</p>
									</div>
								</div>

								{/* Step 2: Rooms & Beds */}
								{totalRooms > 0 ? (
									<div className='flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/40'>
										<div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white'>
											✓
										</div>
										<div>
											<h4 className='text-xs font-bold text-emerald-950 dark:text-emerald-200'>
												Step 2: Room & Bed Layouts
											</h4>
											<p className='mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-300'>
												{totalRooms} room(s) and {totalBeds} bed(s) configured.
											</p>
										</div>
									</div>
								) : (
									<div className='flex items-start gap-3 rounded-xl border border-stroke p-3 dark:border-stroke-dark'>
										<div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
											2
										</div>
										<div className='flex-1'>
											<h4 className='text-xs font-bold text-dark dark:text-white'>
												Step 2: Room & Bed Layouts
											</h4>
											<p className='mt-0.5 text-[11px] text-body dark:text-gray-4'>
												Add floors, 1/2/3/4 sharing rooms, and bed counts.
											</p>
											<Link
												href='/user/rooms?action=add'
												className='mt-1 inline-block text-[11px] font-semibold text-emerald-800 hover:underline dark:text-emerald-400'
											>
												Configure now →
											</Link>
										</div>
									</div>
								)}

								{/* Step 3: Resident Check-In */}
								{activeResidentCount > 0 ? (
									<div className='flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/40'>
										<div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white'>
											✓
										</div>
										<div>
											<h4 className='text-xs font-bold text-emerald-950 dark:text-emerald-200'>
												Step 3: Resident Check-In
											</h4>
											<p className='mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-300'>
												{activeResidentCount} resident(s) actively checked in.
											</p>
										</div>
									</div>
								) : (
									<div className='flex items-start gap-3 rounded-xl border border-stroke p-3 dark:border-stroke-dark'>
										<div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
											3
										</div>
										<div className='flex-1'>
											<h4 className='text-xs font-bold text-dark dark:text-white'>
												Step 3: Resident Check-In & Bed Allocation
											</h4>
											<p className='mt-0.5 text-[11px] text-body dark:text-gray-4'>
												Onboard residents and allocate available beds.
											</p>
											<Link
												href='/user/residents?action=add'
												className='mt-1 inline-block text-[11px] font-semibold text-emerald-800 hover:underline dark:text-emerald-400'
											>
												+ Check in resident →
											</Link>
										</div>
									</div>
								)}

								{/* Step 4: Rent Ledger & Dues Tracking (Phase F Active) */}
								{allRentCharges.length > 0 ? (
									<div className='flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/40'>
										<div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white'>
											✓
										</div>
										<div className='flex-1'>
											<h4 className='text-xs font-bold text-emerald-950 dark:text-emerald-200'>
												Step 4: Rent Ledger & Payment Tracking
											</h4>
											<p className='mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-300'>
												{allRentCharges.length} rent charges recorded. Live
												collections active.
											</p>
											<Link
												href='/user/billing'
												className='mt-1 inline-block text-[11px] font-semibold text-emerald-800 hover:underline dark:text-emerald-400'
											>
												Manage rent & dues →
											</Link>
										</div>
									</div>
								) : (
									<div className='flex items-start gap-3 rounded-xl border border-stroke p-3 dark:border-stroke-dark'>
										<div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
											4
										</div>
										<div className='flex-1'>
											<h4 className='text-xs font-bold text-dark dark:text-white'>
												Step 4: Rent Ledger & Dues Tracking
											</h4>
											<p className='mt-0.5 text-[11px] text-body dark:text-gray-4'>
												Generate monthly rent charges, record Cash/UPI payments,
												and print digital receipts.
											</p>
											<Link
												href='/user/billing'
												className='mt-1 inline-block text-[11px] font-semibold text-emerald-800 hover:underline dark:text-emerald-400'
											>
												Open rent ledger →
											</Link>
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Information Card */}
					<div className='rounded-xl border border-[#E8E3D8] bg-[#F4EFEA]/60 p-5 dark:border-[#1E3A2F] dark:bg-[#071711]'>
						<div className='flex items-start gap-3'>
							<span className='text-base'>🇮🇳</span>
							<div>
								<h4 className='text-xs font-bold text-slate-900 dark:text-white'>
									ChooseBed Support
								</h4>
								<p className='mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400'>
									Need help configuring your property or managing multiple
									PG/Hostel branches? Contact our team anytime from the Support
									section.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
