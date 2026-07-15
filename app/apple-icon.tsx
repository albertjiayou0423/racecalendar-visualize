import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "37px",
          backgroundColor: "#E10600",
        }}
      >
        {/* 方格旗 */}
        <svg width="132" height="156" viewBox="0 0 132 156" fill="none">
          {/* 3x3 棋盘格 */}
          <rect x="18" y="12" width="22" height="22" fill="white" />
          <rect x="40" y="12" width="22" height="22" fill="#1a1a1e" />
          <rect x="62" y="12" width="22" height="22" fill="white" />
          <rect x="18" y="34" width="22" height="22" fill="#1a1a1e" />
          <rect x="40" y="34" width="22" height="22" fill="white" />
          <rect x="62" y="34" width="22" height="22" fill="#1a1a1e" />
          <rect x="18" y="56" width="22" height="22" fill="white" />
          <rect x="40" y="56" width="22" height="22" fill="#1a1a1e" />
          <rect x="62" y="56" width="22" height="22" fill="white" />
          {/* 旗杆 */}
          <rect x="10" y="12" width="8" height="90" rx="3" fill="white" />
          {/* 赛车剪影 */}
          <path
            d="M20 125 L30 118 L45 115 L65 108 L85 105 L110 108 L125 115 L135 120 L145 125 L140 128 L130 125 L120 128 L110 125 L100 128 L90 125 L80 128 L70 125 L60 128 L50 125 L40 128 L30 125 L20 128 Z"
            fill="white"
            opacity="0.95"
          />
          {/* 车轮 */}
          <ellipse cx="42" cy="128" rx="12" ry="10" fill="#1a1a1e" />
          <ellipse cx="42" cy="128" rx="7" ry="6" fill="#333" />
          <ellipse cx="120" cy="128" rx="12" ry="10" fill="#1a1a1e" />
          <ellipse cx="120" cy="128" rx="7" ry="6" fill="#333" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
