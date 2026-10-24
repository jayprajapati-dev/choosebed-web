"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import React from "react";
import { HeroVoiceWidget } from "./HeroVoiceWidget";
import { OperationsPreview } from "./OperationsPreview";

const Hero = () => {
	const { data: session } = useSession();
	const isLoggedIn = !!session?.user;
	const dashboardHref = session?.user?.role === "ADMIN" ? "/admin" : "/user";

	return (
		<section className='relative overflow-hidden bg-[#FBF9F5] pb-16 pt-32 dark:bg-[#0E1713] sm:pb-20 sm:pt-36'>
			{/* Subtle warm background glow */}
			<div className='from-[#133E2F]/6 pointer-events-none absolute left-1/2 top-0 h-[480px] w-full max-w-7xl -translate-x-1/2 bg-gradient-to-b via-transparent to-transparent blur-3xl dark:from-emerald-950/25' />

			<div className='relative mx-auto max-w-[1170px] px-4 sm:px-8 xl:px-0'>
				<div className='mx-auto max-w-3xl text-center'>
					{/* Target Audience & Voice AI Pill */}
					<div className='flex flex-wrap items-center justify-center gap-2.5'>
						<div className='inline-flex items-center gap-2 rounded-full border border-[#E8E3D8] bg-white px-4 py-1.5 text-xs font-semibold text-[#0B2B20] shadow-sm transition-all hover:border-[#D5CEBF] dark:border-slate-800 dark:bg-slate-900 dark:text-emerald-300'>
							<span className='relative flex h-2 w-2'>
								<span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75' />
								<span className='relative inline-flex h-2 w-2 rounded-full bg-[#E5A83B]' />
							</span>
							<span className='text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200'>
								Made for PG &amp; Hostel Owners
							</span>
						</div>

						<a
							href='#voice-hero-widget'
							className='group inline-flex items-center gap-2 rounded-full border border-emerald-400/80 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-900 shadow-2xs transition-all hover:bg-emerald-100 hover:shadow-sm dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
						>
							<span className='flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse' />
							<span>🎙️ PG Saathi AI: Indic Voice Copilot</span>
							<span className='rounded bg-emerald-700/10 px-1 py-0.2 text-[9px] font-extrabold uppercase text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200'>
								Interactive
							</span>
							<span className='text-[10px] text-emerald-600 transition-transform group-hover:translate-x-0.5 dark:text-emerald-400'>
								→
							</span>
						</a>
					</div>

					{/* Main Headline */}
					<h1 className='mt-6 font-inter text-3xl font-extrabold tracking-tight text-[#0B2B20] dark:text-white sm:text-5xl sm:leading-[1.15] lg:text-[58px] lg:leading-[1.1]'>
						<span className='block'>Manage Your PG</span>
						<span className='font-serif mt-1 block font-normal italic text-[#1A533F] dark:text-[#34D399] sm:mt-2'>
							the Easy Way — with Voice AI.
						</span>
					</h1>

					{/* High-Intent SEO & Human Subtitle */}
					<p className='mt-5 text-base leading-relaxed text-[#4A5550] dark:text-slate-300 sm:text-lg'>
						Manage rooms, tenant records, and empty beds in real time, or simply
						ask in <strong>Hindi, English &amp; Gujarati</strong> using hands-free{" "}
						<strong className='text-emerald-700 dark:text-emerald-400'>PG Saathi AI</strong>.
						Built specifically for Indian PG, hostel, and co-living owners.
					</p>

					{/* CTAs */}
					<div className='mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row'>
						{isLoggedIn ? (
							<Link
								href={dashboardHref}
								className='w-full rounded-xl bg-[#0B2B20] px-7 py-3.5 text-center text-sm font-semibold text-white shadow-md transition-all hover:bg-[#133E2F] hover:shadow-lg dark:bg-white dark:text-[#0B2B20] dark:hover:bg-slate-100 sm:w-auto'
							>
								Go to Dashboard →
							</Link>
						) : (
							<Link
								href='/auth/signup'
								className='w-full rounded-xl bg-[#0B2B20] px-7 py-3.5 text-center text-sm font-semibold text-white shadow-md transition-all hover:bg-[#133E2F] hover:shadow-lg dark:bg-white dark:text-[#0B2B20] dark:hover:bg-slate-100 sm:w-auto'
							>
								Register Your PG →
							</Link>
						)}
						<a
							href='#voice-hero-widget'
							className='w-full rounded-xl border border-emerald-600/30 bg-emerald-50 px-6 py-3.5 text-center text-sm font-bold text-emerald-900 shadow-sm transition-all hover:bg-emerald-100 hover:shadow-md dark:border-emerald-500/40 dark:bg-emerald-950/70 dark:text-emerald-300 dark:hover:bg-emerald-900/80 sm:w-auto'
						>
							🎙️ Try Voice AI Demo
						</a>
						<a
							href='#how-it-works'
							className='w-full rounded-xl border border-[#D5CEBF] bg-white px-6 py-3.5 text-center text-sm font-semibold text-[#0B2B20] shadow-sm transition-all hover:bg-[#FAF8F5] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto'
						>
							See How It Works
						</a>
					</div>

					{/* Simple Value Props Strip */}
					<div className='mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-600 dark:text-slate-400'>
						<span className='flex items-center gap-1.5'>
							<svg
								className='h-4 w-4 text-emerald-600 dark:text-emerald-400'
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
							Manage Your PG
						</span>
						<span className='flex items-center gap-1.5'>
							<svg
								className='h-4 w-4 text-emerald-600 dark:text-emerald-400'
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
							AC &amp; Non-AC Rooms
						</span>
						<span className='flex items-center gap-1.5'>
							<svg
								className='h-4 w-4 text-emerald-600 dark:text-emerald-400'
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
							Resident Details
						</span>
						<span className='flex items-center gap-1.5'>
							<svg
								className='h-4 w-4 text-emerald-600 dark:text-emerald-400'
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
							Track Empty Beds
						</span>
						<span className='flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300'>
							<span>🎙️</span>
							<span>Hindi, Eng &amp; Guj Voice</span>
						</span>
					</div>
				</div>

				{/* NEW: Dedicated Interactive Voice Copilot Hero Showcase */}
				<div id='voice-hero-widget'>
					<HeroVoiceWidget />
				</div>

				{/* Dashboard Preview Section with Polished Context Header */}
				<div id='preview' className='mt-14 sm:mt-20'>
					<div className='mb-4 flex flex-col items-center justify-center gap-1.5 px-1 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left'>
						<div className='shadow-xs inline-flex items-center gap-2 rounded-full border border-[#E8E3D8] bg-white px-3.5 py-1 text-xs font-semibold text-[#0B2B20] dark:border-slate-800 dark:bg-[#0B1E17] dark:text-emerald-300'>
							<span className='relative flex h-2 w-2'>
								<span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75' />
								<span className='relative inline-flex h-2 w-2 rounded-full bg-emerald-500' />
							</span>
							<span className='text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200'>
								Your PG at a Glance
							</span>
						</div>
						<p className='text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs'>
							Sample PG preview • Not real customer data
						</p>
					</div>

					<OperationsPreview />
				</div>
			</div>
		</section>
	);
};

export default Hero;
