import React from "react";

export function Roadmap() {
	return (
		<section
			id='roadmap'
			className='border-t border-[#E8E3D8] bg-[#FAF8F5] py-20 dark:border-slate-800 dark:bg-[#101A15] sm:py-28'
		>
			<div className='mx-auto max-w-[1170px] px-4 sm:px-8 xl:px-0'>
				<div className='mx-auto max-w-2xl text-center'>
					<span className='rounded-full border border-[#E8E3D8] bg-white px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0B2B20] dark:border-slate-800 dark:bg-slate-900 dark:text-emerald-300'>
						What&apos;s Coming Next
					</span>
					<h2 className='mt-4 font-inter text-3xl font-extrabold tracking-tight text-[#0B2B20] dark:text-white sm:text-4xl'>
						Built for today.{" "}
						<span className='font-serif font-normal italic text-[#1A533F] dark:text-[#34D399]'>
							Ready for tomorrow.
						</span>
					</h2>
					<p className='mt-3 text-base text-[#4A5550] dark:text-slate-300'>
						We start with simple daily PG management. Here is what we are
						planning down the line.
					</p>
				</div>

				{/* 3 Clear Roadmap Cards */}
				<div className='mt-14 grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8'>
					{/* Card 1: Core MVP (Active Now) */}
					<div className='flex flex-col justify-between rounded-2xl border-2 border-[#0B2B20] bg-white p-7 shadow-sm dark:border-emerald-600 dark:bg-slate-900'>
						<div>
							<div className='flex items-center justify-between'>
								<span className='rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'>
									● Live for Owners (Active)
								</span>
								<span className='font-mono text-xs font-semibold text-slate-400'>
									Phase 01
								</span>
							</div>

							<h3 className='mt-5 text-lg font-bold text-[#0B2B20] dark:text-white'>
								Daily Operations &amp; PG Saathi AI
							</h3>
							<p className='mt-2 text-xs text-[#4A5550] dark:text-slate-400'>
								Complete suite to manage rooms, residents, dues ledger, and hands-free voice operations.
							</p>

							<ul className='mt-5 space-y-2.5 text-xs text-slate-700 dark:text-slate-300'>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-emerald-600 dark:text-emerald-400'>
										✓
									</span>
									<span>Multi-Property &amp; Floor Bed Matrix</span>
								</li>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-emerald-600 dark:text-emerald-400'>
										✓
									</span>
									<span>AC &amp; Non-AC single, double, triple sharing</span>
								</li>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-emerald-600 dark:text-emerald-400'>
										✓
									</span>
									<span>Resident profiles, mobile KYC &amp; room allotment</span>
								</li>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-emerald-600 dark:text-emerald-400'>
										✓
									</span>
									<span>Monthly rent dues, ledger &amp; digital receipts</span>
								</li>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-emerald-600 dark:text-emerald-400'>
										✓
									</span>
									<span><strong>PG Saathi AI:</strong> Real-time Indic voice assistant</span>
								</li>
							</ul>
						</div>

						<div className='mt-6 border-t border-[#F0EBE0] pt-4 dark:border-slate-800'>
							<span className='text-xs font-bold text-[#0B2B20] dark:text-emerald-400'>
								Ready to use today
							</span>
						</div>
					</div>

					{/* Card 2: Nearby Discovery (Roadmap Exploration) */}
					<div className='flex flex-col justify-between rounded-2xl border border-[#E8E3D8] bg-white p-7 shadow-sm transition-all hover:border-[#D5CEBF] dark:border-slate-800 dark:bg-slate-900'>
						<div>
							<div className='flex items-center justify-between'>
								<span className='rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'>
									Coming Soon
								</span>
								<span className='font-mono text-xs font-semibold text-slate-400'>
									Phase 02
								</span>
							</div>

							<h3 className='mt-5 text-lg font-bold text-[#0B2B20] dark:text-white'>
								Nearby PG Discovery &amp; Inquiries
							</h3>
							<p className='mt-2 text-xs text-[#4A5550] dark:text-slate-400'>
								Helping students and working professionals find your PG directly in their area.
							</p>

							<ul className='mt-5 space-y-2.5 text-xs text-slate-700 dark:text-slate-300'>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-amber-600 dark:text-amber-400'>
										•
									</span>
									<span>Discover verified PGs near colleges &amp; IT parks</span>
								</li>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-amber-600 dark:text-amber-400'>
										•
									</span>
									<span>Owner toggle to enable/disable public listing</span>
								</li>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-amber-600 dark:text-amber-400'>
										•
									</span>
									<span>
										Direct WhatsApp &amp; call connect — zero commission
									</span>
								</li>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-amber-600 dark:text-amber-400'>
										•
									</span>
									<span>Instant walk-in inquiry tracking pipeline</span>
								</li>
							</ul>
						</div>

						<div className='mt-6 border-t border-[#F0EBE0] pt-4 dark:border-slate-800'>
							<span className='text-xs font-semibold text-amber-700 dark:text-amber-400'>
								In development
							</span>
						</div>
					</div>

					{/* Card 3: Enterprise & Automation */}
					<div className='flex flex-col justify-between rounded-2xl border border-[#E8E3D8] bg-white p-7 shadow-sm transition-all hover:border-[#D5CEBF] dark:border-slate-800 dark:bg-slate-900'>
						<div>
							<div className='flex items-center justify-between'>
								<span className='rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300'>
									Future Suite
								</span>
								<span className='font-mono text-xs font-semibold text-slate-400'>
									Phase 03
								</span>
							</div>

							<h3 className='mt-5 text-lg font-bold text-[#0B2B20] dark:text-white'>
								Biometrics &amp; Smart Gate Automation
							</h3>
							<p className='mt-2 text-xs text-[#4A5550] dark:text-slate-400'>
								Automated entry tracking, digital parent notifications, and biometric integration.
							</p>

							<ul className='mt-5 space-y-2.5 text-xs text-slate-700 dark:text-slate-300'>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-slate-500'>•</span>
									<span>Fingerprint &amp; face-recognition entry sync</span>
								</li>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-slate-500'>•</span>
									<span>Automated late entry SMS alerts to wardens</span>
								</li>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-slate-500'>•</span>
									<span>Digital visitor passes with QR verification</span>
								</li>
								<li className='flex items-start gap-2'>
									<span className='font-bold text-slate-500'>•</span>
									<span>Automated electricity sub-meter calculations</span>
								</li>
							</ul>
						</div>

						<div className='mt-6 border-t border-[#F0EBE0] pt-4 dark:border-slate-800'>
							<span className='text-xs font-semibold text-slate-500 dark:text-slate-400'>
								Planned for upcoming release
							</span>
						</div>
					</div>
				</div>

				{/* Owner Commitment & Roadmap Note */}
				<p className='mt-8 text-center text-xs text-slate-500 dark:text-slate-400'>
					Our Commitment to Owners: Core property and bed management tools are
					live today. Advanced rent dues and digital KYC features are
					continually rolled out based directly on feedback from Indian PG
					owners.
				</p>
			</div>
		</section>
	);
}
