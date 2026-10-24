import React from "react";

const mvpPillars = [
	{
		number: "01",
		badge: "Multi-Property Setup",
		title: "Manage Multiple PGs & Floors",
		description:
			"Add your PG branches, configure floors, and track capacities. Easily switch between multiple properties from one single master owner dashboard.",
		tag: "Multi-branch & floor governance",
		icon: (
			<svg
				className='h-6 w-6 text-[#0B2B20] dark:text-[#E5A83B]'
				fill='none'
				viewBox='0 0 24 24'
				stroke='currentColor'
				strokeWidth='2'
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
				/>
			</svg>
		),
	},
	{
		number: "02",
		badge: "Room Types & Beds",
		title: "AC, Non-AC & Sharing Tiers",
		description:
			"Mark rooms as AC or Non-AC. Set single, double, triple, or 4-sharing configurations with atomic bed generation and individual monthly rent tariffs.",
		tag: "AC & Non-AC • 1 to 4 Sharing",
		icon: (
			<svg
				className='h-6 w-6 text-[#0B2B20] dark:text-[#E5A83B]'
				fill='none'
				viewBox='0 0 24 24'
				stroke='currentColor'
				strokeWidth='2'
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					d='M4 6h16M4 10h16M4 14h16M4 18h16'
				/>
			</svg>
		),
	},
	{
		number: "03",
		badge: "Resident Admissions",
		title: "Digital Resident KYC & Bed Locks",
		description:
			"Save resident names, 10-digit mobile numbers, emergency contacts, and admission dates. Allocating a resident atomically locks the bed to prevent double-booking.",
		tag: "Atomic bed locking & checkout",
		icon: (
			<svg
				className='h-6 w-6 text-[#0B2B20] dark:text-[#E5A83B]'
				fill='none'
				viewBox='0 0 24 24'
				stroke='currentColor'
				strokeWidth='2'
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
				/>
			</svg>
		),
	},
	{
		number: "04",
		badge: "Rent Ledger & Dues",
		title: "Automated Monthly Billing & Receipts",
		description:
			"Generate monthly billing obligations (YYYY-MM), record partial or full rent collections, track security deposits, and produce digital receipts with unique numbers.",
		tag: "Receipt serials (RCP-YYYYMM-XXXXXX)",
		icon: (
			<svg
				className='h-6 w-6 text-[#0B2B20] dark:text-[#E5A83B]'
				fill='none'
				viewBox='0 0 24 24'
				stroke='currentColor'
				strokeWidth='2'
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					d='M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z'
				/>
			</svg>
		),
	},
	{
		number: "05",
		badge: "Indic Voice AI",
		title: "PG Saathi AI — Voice Assistant",
		description:
			"Speak naturally in Hindi, Hinglish, Gujarati, or English. Check vacant rooms, bed counts, rent rates, and pending tenant dues with zero token cost.",
		tag: "Hindi • Hinglish • Gujarati • English",
		icon: (
			<svg
				className='h-6 w-6 text-[#0B2B20] dark:text-[#E5A83B]'
				fill='none'
				viewBox='0 0 24 24'
				stroke='currentColor'
				strokeWidth='2'
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z'
				/>
			</svg>
		),
	},
	{
		number: "06",
		badge: "Live Occupancy",
		title: "Real-Time Vacant Bed Tracker",
		description:
			"Instantly see which beds are occupied, available, or under maintenance. Never lose revenue from unlisted vacancies or double-allocated rooms.",
		tag: "Instant empty bed visibility",
		icon: (
			<svg
				className='h-6 w-6 text-[#0B2B20] dark:text-[#E5A83B]'
				fill='none'
				viewBox='0 0 24 24'
				stroke='currentColor'
				strokeWidth='2'
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
				/>
			</svg>
		),
	},
];

const Features = () => {
	return (
		<section
			id='features'
			className='bg-[#FBF9F5] py-20 dark:bg-[#0E1713] sm:py-28'
		>
			<div className='mx-auto max-w-[1170px] px-4 sm:px-8 xl:px-0'>
				<div className='mx-auto max-w-2xl text-center'>
					<span className='rounded-full border border-[#E8E3D8] bg-white px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0B2B20] dark:border-slate-800 dark:bg-slate-900 dark:text-emerald-300'>
						Everything You Need
					</span>
					<h2 className='mt-4 font-inter text-3xl font-extrabold tracking-tight text-[#0B2B20] dark:text-white sm:text-4xl'>
						Run your PG without the headache.{" "}
						<span className='font-serif font-normal italic text-[#1A533F] dark:text-[#34D399]'>
							Easy to manage.
						</span>
					</h2>
					<p className='mt-3 text-base text-[#4A5550] dark:text-slate-300'>
						Simple tools made for Indian PG, hostel, and co-living owners. No
						confusing technical jargon, just clear daily management.
					</p>
				</div>

				{/* 4 Clean Feature Cards */}
				<div className='mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8'>
					{mvpPillars.map((item, idx) => (
						<div
							key={idx}
							className='group flex flex-col justify-between rounded-2xl border border-[#E8E3D8] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D5CEBF] hover:shadow-md dark:border-slate-800 dark:bg-slate-900'
						>
							<div>
								<div className='flex items-center justify-between'>
									<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-[#E8E3D8] bg-[#FAF8F5] transition-colors group-hover:bg-[#0B2B20]/5 dark:border-slate-800 dark:bg-slate-800 dark:group-hover:bg-slate-700'>
										{item.icon}
									</div>
									<span className='rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'>
										{item.badge}
									</span>
								</div>

								<h3 className='mt-6 text-xl font-bold text-[#0B2B20] dark:text-white'>
									{item.title}
								</h3>

								<p className='mt-2.5 text-sm leading-relaxed text-[#4A5550] dark:text-slate-300'>
									{item.description}
								</p>
							</div>

							<div className='mt-6 border-t border-[#F0EBE0] pt-4 dark:border-slate-800'>
								<span className='flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400'>
									<svg
										className='h-3.5 w-3.5'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
										strokeWidth='2.5'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											d='M5 13l4 4L19 7'
										/>
									</svg>
									{item.tag}
								</span>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
};

export default Features;
