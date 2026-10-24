"use client";

import Link from "next/link";
import React from "react";

export interface BrandLogoProps {
	className?: string;
	href?: string;
	compact?: boolean;
	variant?: "default" | "symbol" | "full";
	themeMode?: "auto" | "light" | "dark" | "monochrome";
	size?: "sm" | "md" | "lg";
	showSubtitle?: boolean;
	hideSubtitleOnMobile?: boolean;
}

/**
 * Choose Bed — Premium Brand Symbol
 * Modern architectural icon featuring an arched luxury bed, dual pillows,
 * a dynamic emerald verified choice checkmark, and a golden keystone sparkle.
 */
export function BrandSymbol({
	size = "md",
	themeMode = "auto",
	className = "",
}: {
	size?: "sm" | "md" | "lg";
	themeMode?: "auto" | "light" | "dark" | "monochrome";
	className?: string;
}) {
	const sizeMap = {
		sm: "h-8 w-8 rounded-lg",
		md: "h-9.5 w-9.5 rounded-xl",
		lg: "h-11 w-11 rounded-2xl",
	};

	const isForcedDark = themeMode === "dark";
	const isForcedLight = themeMode === "light";
	const isMonochrome = themeMode === "monochrome";

	return (
		<div
			className={`shadow-xs relative flex shrink-0 items-center justify-center transition-all ${
				sizeMap[size]
			} ${
				isMonochrome
					? "bg-slate-900 text-white"
					: isForcedDark
						? "bg-[#0E2C22] shadow-[0_0_12px_rgba(52,211,153,0.15)] ring-1 ring-[#2E7A5D]/60"
						: isForcedLight
							? "bg-[#082319] ring-1 ring-[#174A37]/60"
							: "bg-[#082319] ring-1 ring-[#174A37]/60 dark:bg-[#0E2C22] dark:shadow-[0_0_12px_rgba(52,211,153,0.15)] dark:ring-[#2E7A5D]/60"
			} ${className}`}
		>
			<svg
				className='h-[66%] w-[66%]'
				viewBox='0 0 32 32'
				fill='none'
				xmlns='http://www.w3.org/2000/svg'
				aria-hidden='true'
			>
				{/* 1. Bed Frame & Headboard (Sleek, Bold Emerald Geometry) */}
				{/* Headboard Post */}
				<rect
					x='5.5'
					y='7.5'
					width='3'
					height='17'
					rx='1.5'
					fill={isMonochrome ? "#FFFFFF" : isForcedDark ? "#34D399" : "#10B981"}
				/>
				{/* Horizontal Base Rail */}
				<rect
					x='5.5'
					y='19'
					width='20.5'
					height='3'
					rx='0.8'
					fill={isMonochrome ? "#FFFFFF" : isForcedDark ? "#34D399" : "#10B981"}
				/>
				{/* Footboard Leg */}
				<rect
					x='23.5'
					y='19'
					width='2.5'
					height='5.5'
					rx='1'
					fill={isMonochrome ? "#FFFFFF" : isForcedDark ? "#34D399" : "#10B981"}
				/>

				{/* 2. Cozy Pillow (Clean Organic Curve) */}
				<path
					d='M8.5 16C8.5 12.2 11.8 11.2 14.5 12.2C15.5 12.6 16 14.2 15.5 16H8.5Z'
					fill={isMonochrome ? "#CBD5E1" : "#FFFFFF"}
				/>

				{/* 3. Mattress Cushion (Sleek Horizontal Pill with Soft Radius) */}
				<rect
					x='8.5'
					y='15.5'
					width='15.5'
					height='3.8'
					rx='1.5'
					fill={isMonochrome ? "#CBD5E1" : "#FFFFFF"}
				/>
			</svg>
		</div>
	);
}

export function BrandLogo({
	className = "",
	href = "/",
	variant = "default",
	themeMode = "auto",
	size = "md",
	showSubtitle = false,
}: BrandLogoProps) {
	const isSymbolOnly = variant === "symbol";
	const isForcedDark = themeMode === "dark";

	const textSizeMap = {
		sm: "text-base",
		md: "text-lg sm:text-[19px]",
		lg: "text-xl sm:text-2xl",
	};

	return (
		<Link
			href={href}
			className={`inline-flex items-center gap-2.5 transition-opacity hover:opacity-95 ${className}`}
			aria-label='Choose Bed'
		>
			<BrandSymbol size={size} themeMode={themeMode} />

			{!isSymbolOnly && (
				<div className='flex items-baseline'>
					{/* Brand Wordmark (Choose Bed - No .com in logo) */}
					<span
						className={`font-inter font-extrabold leading-none tracking-tight ${
							textSizeMap[size]
						} ${
							isForcedDark ? "text-white" : "text-[#0B2B20] dark:text-white"
						}`}
					>
						<span>Choose</span>{" "}
						<span
							className={
								isForcedDark
									? "text-[#34D399]"
									: "text-[#10B981] dark:text-[#34D399]"
							}
						>
							Bed
						</span>
					</span>

					{/* Optional Tagline / Subtitle */}
					{showSubtitle && (
						<span
							className={`ml-2 text-[9px] font-semibold uppercase tracking-[0.14em] ${
								isForcedDark
									? "text-[#A7F3D0]"
									: "text-[#059669] dark:text-[#34D399]"
							}`}
						>
							PG &amp; Hostel OS
						</span>
					)}
				</div>
			)}
		</Link>
	);
}
