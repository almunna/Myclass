import React from "react"

export const LoginFormIcon = ({ className, fill = "none" }: { className?: string, fill?: string }) => {
    return (
        <svg  viewBox="0 0 360 640" fill={fill} xmlns="http://www.w3.org/2000/svg" className={className}>
            <rect className={ className} fill="url(#grad)" />

            <path d="M100 500C40 480 20 400 60 320C100 240 140 100 240 160C340 220 300 380 280 460C260 540 180 520 100 500Z" fill="#E0F2FE" />

            <rect x="80" y="480" width="200" height="20" rx="4" fill="#94A3B8" />
            <rect x="90" y="420" width="40" height="60" rx="5" fill="#3B82F6" />
            <rect x="140" y="400" width="80" height="80" rx="10" fill="#1D4ED8" />
            <rect x="230" y="430" width="30" height="50" rx="5" fill="#3B82F6" />
            <circle cx="180" cy="300" r="40" fill="#FBBF24" />
            <rect x="160" y="340" width="40" height="20" rx="10" fill="#FBBF24" />

            <rect x="60" y="180" width="180" height="50" rx="10" fill="white" stroke="#E5E7EB" strokeWidth="2" />
            <text x="70" y="210" fontFamily="Arial, sans-serif" fontSize="14" fill="#1F2937">Track student movement</text>

            <text x="20" y="60" fontSize="22" fontFamily="Arial, sans-serif" fill="#1E3A8A" fontWeight="bold">
                Welcome to MyClassLog
            </text>
            <text x="20" y="90" fontSize="14" fontFamily="Arial, sans-serif" fill="#1E40AF">
                Smart attendance and movement log for your class.
            </text>

            <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="360" y2="640" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#E0F2FE" />
                    <stop offset="1" stopColor="#F8FAFC" />
                </linearGradient>
            </defs>
        </svg>

    )
}