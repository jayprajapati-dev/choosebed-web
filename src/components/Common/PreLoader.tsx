"use client";

import React, { useEffect, useState } from "react";

/**
 * ChooseBed.com — Ultra-Premium Brand PreLoader
 * Features the signature ChooseBed monogram
 * enveloped by an emerald & gold orbital aura and smooth fade-out.
 */
const PreLoader = () => {
	const [isVisible, setIsVisible] = useState(true);
	const [isFading, setIsFading] = useState(false);

	useEffect(() => {
		// Begin fade out after a brief, crisp brand introduction
		const fadeTimer = setTimeout(() => {
			setIsFading(true);
		}, 650);

		// Completely unmount after fade-out transition finishes
		const removeTimer = setTimeout(() => {
			setIsVisible(false);
		}, 1050);

		return () => {
			clearTimeout(fadeTimer);
			clearTimeout(removeTimer);
		};
	}, []);

	if (!isVisible) return null;

	return (
		<div
			className={`duration-400 fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#FBF9F5] transition-opacity ease-out dark:bg-[#0E1713] ${
				isFading ? "pointer-events-none opacity-0" : "opacity-100"
			}`}
		>
			<div className='relative flex h-20 w-20 items-center justify-center'>
				{/* Pulsing Emerald Halo */}
				<div className='absolute h-20 w-20 animate-ping rounded-full bg-emerald-500/15 opacity-75 [animation-duration:2.2s]' />

				{/* Spinning Orbit Ring */}
				<svg
					className='absolute h-20 w-20 animate-spin text-emerald-600 [animation-duration:2.8s] dark:text-emerald-400'
					viewBox='0 0 80 80'
					fill='none'
					xmlns='http://www.w3.org/2000/svg'
				>
					<circle
						cx='40'
						cy='40'
						r='36'
						stroke='currentColor'
						strokeWidth='2'
						strokeLinecap='round'
						strokeDasharray='55 170'
						opacity='0.6'
					/>
					<circle
						cx='40'
						cy='40'
						r='36'
						stroke='url(#loader-gradient)'
						strokeWidth='2.5'
						strokeLinecap='round'
						strokeDasharray='30 195'
					/>
					<defs>
						<linearGradient
							id='loader-gradient'
							x1='40'
							y1='4'
							x2='76'
							y2='40'
							gradientUnits='userSpaceOnUse'
						>
							<stop stopColor='#E5A83B' />
							<stop offset='1' stopColor='#34D399' />
						</linearGradient>
					</defs>
				</svg>

				{/* Brand Symbol Squircle Emblem */}
				<div className='absolute flex h-13 w-13 items-center justify-center rounded-xl bg-[#082319] shadow-md ring-1 ring-[#174A37] dark:bg-[#0E2C22] dark:shadow-[0_0_15px_rgba(52,211,153,0.2)] dark:ring-[#2E7A5D]/70'>
					<svg
						className='h-7 w-7'
						viewBox='0 0 32 32'
						fill='none'
						xmlns='http://www.w3.org/2000/svg'
					>
						{/* Headboard Post */}
						<rect
							x='5.5'
							y='7.5'
							width='3'
							height='17'
							rx='1.5'
							fill='#34D399'
						/>
						{/* Horizontal Base Rail */}
						<rect
							x='5.5'
							y='19'
							width='20.5'
							height='3'
							rx='0.8'
							fill='#34D399'
						/>
						{/* Footboard Leg */}
						<rect
							x='23.5'
							y='19'
							width='2.5'
							height='5.5'
							rx='1'
							fill='#34D399'
						/>
						{/* Cozy Pillow */}
						<path
							d='M8.5 16C8.5 12.2 11.8 11.2 14.5 12.2C15.5 12.6 16 14.2 15.5 16H8.5Z'
							fill='#FFFFFF'
						/>
						{/* Mattress Cushion */}
						<rect
							x='8.5'
							y='15.5'
							width='15.5'
							height='3.8'
							rx='1.5'
							fill='#FFFFFF'
						/>
					</svg>
				</div>
			</div>

			{/* Brand Wordmark (Choose Bed - No .com) */}
			<div className='mt-5 flex items-baseline gap-1 font-inter text-lg font-extrabold tracking-tight text-[#0B2B20] dark:text-white'>
				<span>Choose</span>
				<span className='text-[#10B981] dark:text-[#34D399]'>Bed</span>
			</div>

			{/* Micro-Progress Loading Pill */}
			<div className='mt-3.5 flex items-center gap-1.5'>
				<span className='h-1.5 w-1.5 animate-bounce rounded-full bg-[#059669] delay-0 dark:bg-[#34D399]' />
				<span className='h-1.5 w-1.5 animate-bounce rounded-full bg-[#E5A83B] [animation-delay:150ms]' />
				<span className='h-1.5 w-1.5 animate-bounce rounded-full bg-[#059669] [animation-delay:300ms] dark:bg-[#34D399]' />
			</div>
		</div>
	);
};

export default PreLoader;
