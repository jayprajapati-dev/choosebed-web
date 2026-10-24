import { Badge, Button, Card, CardContent } from "@/components/Common/UI";
import { requireAdminSession } from "@/libs/adminAuth";
import { formatIndianMobile } from "@/libs/formatters";
import { prisma } from "@/libs/prismaDb";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Properties",
	description: "Platform PG/Hostel property inventory and facility monitoring.",
};

export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
	// Strict Server-side Super Admin Guard
	await requireAdminSession();

	// Fetch real properties from database
	const properties = await prisma.property.findMany({
		include: {
			owner: {
				select: {
					id: true,
					name: true,
					email: true,
					phone: true,
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

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
			BOYS: "Boys",
			GIRLS: "Girls",
			COED: "Co-ed",
		};
		return genderLabels[g] || "Co-ed";
	};

	return (
		<div className='space-y-5 pb-10 sm:space-y-6'>
			{/* Clean Page Title */}
			<div>
				<h1 className='font-satoshi text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl lg:text-3xl'>
					Properties
				</h1>
				<p className='mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm'>
					Monitor and inspect registered PG/Hostel properties across Choose Bed.
				</p>
			</div>

			{properties.length === 0 ? (
				/* Properties Empty State Card */
				<Card className='border-[#E8E3D8] bg-white shadow-sm dark:border-[#1E382B] dark:bg-[#071711]'>
					<CardContent className='px-4 py-10 text-center sm:py-14'>
						<div className='mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'>
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
									d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
								/>
							</svg>
						</div>

						<h2 className='mt-4 font-satoshi text-base font-bold text-slate-900 dark:text-white sm:text-lg'>
							No PG/Hostel Properties Added Yet
						</h2>

						<p className='mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm'>
							Registered PG/Hostel owners configure their properties during
							initial onboarding. As properties are launched, they will appear
							here with live details.
						</p>

						<div className='mt-6 flex flex-wrap items-center justify-center gap-3'>
							<Link href='/admin/owners'>
								<Button variant='primary' size='sm'>
									View PG Owners
								</Button>
							</Link>
							<Link href='/admin'>
								<Button variant='outline' size='sm'>
									Back to Overview
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			) : (
				/* Real Properties List Table */
				<Card className='border-[#E8E3D8] bg-white shadow-sm dark:border-[#1E382B] dark:bg-[#071711]'>
					<CardContent className='p-0'>
						<div className='overflow-x-auto'>
							<table className='w-full text-left text-xs sm:text-sm'>
								<thead className='border-b border-[#E8E3D8] bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-[#1E382B] dark:bg-[#0A1F17] dark:text-slate-400'>
									<tr>
										<th className='px-4 py-3 sm:px-6 sm:py-3.5'>Property</th>
										<th className='px-4 py-3 sm:px-6 sm:py-3.5'>Category</th>
										<th className='px-4 py-3 sm:px-6 sm:py-3.5'>Location</th>
										<th className='px-4 py-3 sm:px-6 sm:py-3.5'>Owner</th>
										<th className='px-4 py-3 text-right sm:px-6 sm:py-3.5'>
											Actions
										</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-[#E8E3D8] dark:divide-[#1E382B]'>
									{properties.map((prop) => (
										<tr
											key={prop.id}
											className='transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30'
										>
											<td className='px-4 py-3.5 sm:px-6 sm:py-4'>
												<div className='flex items-center gap-3'>
													<div className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 font-satoshi text-sm font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'>
														🏠
													</div>
													<div className='min-w-0'>
														<p className='truncate font-satoshi font-bold text-slate-900 dark:text-white'>
															{prop.name}
														</p>
														<p className='truncate text-[11px] text-slate-500 dark:text-slate-400'>
															{prop.address}
														</p>
													</div>
												</div>
											</td>
											<td className='px-4 py-3.5 sm:px-6 sm:py-4'>
												<div className='flex flex-wrap items-center gap-1.5'>
													<Badge variant='neutral' size='sm'>
														{formatPropertyType(prop.type)}
													</Badge>
													<Badge variant='success' size='sm'>
														{formatGender(prop.gender)}
													</Badge>
												</div>
											</td>
											<td className='px-4 py-3.5 text-slate-700 dark:text-slate-300 sm:px-6 sm:py-4'>
												<span className='font-semibold'>{prop.city}</span>
												<span className='block text-[11px] text-slate-400'>
													{prop.area}
												</span>
											</td>
											<td className='px-4 py-3.5 sm:px-6 sm:py-4'>
												<p className='font-medium text-slate-900 dark:text-white'>
													{prop.owner?.name || "Owner"}
												</p>
												<p className='text-[11px] text-slate-500 dark:text-slate-400'>
													{formatIndianMobile(prop.owner?.phone) ||
														prop.owner?.email}
												</p>
											</td>
											<td className='px-4 py-3.5 text-right sm:px-6 sm:py-4'>
												{prop.owner?.id && (
													<Link href={`/admin/owners/${prop.owner.id}`}>
														<Button variant='outline' size='sm'>
															View Owner →
														</Button>
													</Link>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
