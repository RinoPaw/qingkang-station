export function QingKangLogoMark() {
  return (
    <svg className="home-logo-svg" viewBox="0 0 96 96" role="img" aria-label="青康小站标志">
      <defs>
        <linearGradient id="qkLogoA" x1="18" x2="78" y1="18" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#13d2b8" />
          <stop offset="0.55" stopColor="#1ab9d9" />
          <stop offset="1" stopColor="#0d9a86" />
        </linearGradient>
        <linearGradient id="qkLogoB" x1="30" x2="68" y1="20" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9fff9" />
        </linearGradient>
        <filter id="qkLogoShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#0f766e" floodOpacity="0.2" />
        </filter>
      </defs>
      <path
        d="M48 8c19.9 0 36 16.1 36 36 0 24.6-25.5 36.9-35.1 42.3a2.2 2.2 0 0 1-2.1 0C37.3 80.9 12 68.5 12 44 12 24.1 28.1 8 48 8Z"
        fill="url(#qkLogoA)"
        filter="url(#qkLogoShadow)"
      />
      <path
        d="M33.8 35.2c0-7.7 6.3-13.8 14.2-13.8s14.2 6.1 14.2 13.8c0 6.1-3.8 10.7-8.3 15.3L48 56.6l-5.9-6.1c-4.5-4.6-8.3-9.2-8.3-15.3Z"
        fill="url(#qkLogoB)"
        opacity="0.98"
      />
      <path
        d="M47.9 59.2c9.4-11.8 22.4-11.9 31.4-6.9-1.8 11.8-11.5 22-25.4 22-4.1 0-7.9-.9-11.5-2.8 1.4-4.3 3.2-8.5 5.5-12.3Z"
        fill="url(#qkLogoB)"
        opacity="0.95"
      />
      <path
        d="M51.5 66.2c6.9-5.5 14.6-8.2 23.1-8.1"
        fill="none"
        stroke="#0f9f92"
        strokeLinecap="round"
        strokeWidth="3.4"
        opacity="0.7"
      />
    </svg>
  )
}

export function HomeLeafMark() {
  return (
    <svg className="home-leaf-svg" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="qkLeafA" x1="9" x2="40" y1="36" y2="9" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0da192" />
          <stop offset="1" stopColor="#25d8bd" />
        </linearGradient>
      </defs>
      <path
        d="M38.5 8.5C24.4 8.8 13.2 15.9 10.2 27.7c-1.4 5.7.4 10.2 5.2 11.7 13.5 4.1 25-12.3 23.1-30.9Z"
        fill="url(#qkLeafA)"
      />
      <path
        d="M16.2 35.4c4.1-8.6 10.6-15.2 19.9-20.1"
        fill="none"
        stroke="#eafff9"
        strokeLinecap="round"
        strokeWidth="3.2"
      />
      <path
        d="M22 25.7c4.1.2 7.6 1.3 10.8 3.5"
        fill="none"
        stroke="#eafff9"
        strokeLinecap="round"
        strokeWidth="2.4"
        opacity="0.8"
      />
    </svg>
  )
}

export function HeartStationIllustration() {
  return (
    <svg className="home-hero-illustration home-heart-station-svg" viewBox="0 0 360 300" aria-hidden="true">
      <defs>
        <linearGradient id="stationBody" x1="84" x2="272" y1="34" y2="264" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.62" stopColor="#e9f6f5" />
          <stop offset="1" stopColor="#c8e8e5" />
        </linearGradient>
        <linearGradient id="stationSide" x1="252" x2="309" y1="59" y2="242" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a5e5de" />
          <stop offset="1" stopColor="#44bdb2" />
        </linearGradient>
        <linearGradient id="screenGradient" x1="116" x2="222" y1="64" y2="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="#16d1ba" />
          <stop offset="1" stopColor="#079a8b" />
        </linearGradient>
        <filter id="stationShadow" x="0" y="0" width="360" height="300" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="28" stdDeviation="24" floodColor="#0f766e" floodOpacity="0.18" />
        </filter>
      </defs>
      <ellipse cx="178" cy="260" rx="112" ry="18" fill="#0f766e" opacity="0.08" />
      <g filter="url(#stationShadow)">
        <path d="M88 48c0-16.6 13.4-30 30-30h125c30.9 0 56 25.1 56 56v154c0 14.9-12.1 27-27 27H118c-16.6 0-30-13.4-30-30V48Z" fill="url(#stationBody)" />
        <path d="M244 18c30.4.6 55 25.4 55 56v154c0 14.9-12.1 27-27 27h-28V18Z" fill="url(#stationSide)" opacity="0.82" />
        <rect x="112" y="55" width="116" height="84" rx="18" fill="#102837" opacity="0.14" />
        <rect x="120" y="62" width="100" height="70" rx="15" fill="url(#screenGradient)" />
        <path
          d="M156 97c-5.8-7.3-18.2-2.9-18.2 6.6 0 10 14.3 16.4 22.1 22.3.9.7 2.2.7 3.1 0 7.8-5.9 22.1-12.3 22.1-22.3 0-9.5-12.4-13.9-18.2-6.6l-5.5 6.9-5.4-6.9Z"
          fill="white"
        />
        <path d="M146 112h8.4l4.3-8.2 5.4 16 4.2-8.3H180" fill="none" stroke="#0aa99b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        <rect x="139" y="167" width="64" height="72" rx="25" fill="#173d48" />
        <rect x="151" y="178" width="40" height="50" rx="18" fill="url(#screenGradient)" opacity="0.8" />
        <circle cx="223" cy="171" r="7" fill="#16c7b3" opacity="0.95" />
        <circle cx="243" cy="171" r="7" fill="#dff3e8" />
        <path d="M106 153h120" stroke="#d5e7e5" strokeLinecap="round" strokeWidth="3" />
      </g>
      <g opacity="0.85">
        <path d="M38 214c31-24 48-24 75 0s46 24 78 0 52-24 83 0" fill="none" stroke="#12b8a6" strokeLinecap="round" strokeWidth="5" opacity="0.22" />
        <path d="M44 226h36l10-20 16 38 13-25h36" fill="none" stroke="#0fb69e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </g>
    </svg>
  )
}

export function TongueUploadIllustration() {
  return (
    <svg className="home-hero-illustration home-tongue-phone-svg" viewBox="0 0 360 300" aria-hidden="true">
      <defs>
        <linearGradient id="phoneCase" x1="86" x2="268" y1="18" y2="270" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14364a" />
          <stop offset="1" stopColor="#071f2f" />
        </linearGradient>
        <linearGradient id="phoneScreen" x1="117" x2="239" y1="45" y2="247" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbffff" />
          <stop offset="1" stopColor="#d9eff7" />
        </linearGradient>
        <linearGradient id="tongueGrad" x1="136" x2="219" y1="76" y2="218" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffb3ae" />
          <stop offset="0.55" stopColor="#eb7081" />
          <stop offset="1" stopColor="#c64d68" />
        </linearGradient>
        <linearGradient id="scanBlue" x1="68" x2="294" y1="39" y2="249" gradientUnits="userSpaceOnUse">
          <stop stopColor="#28d5eb" />
          <stop offset="1" stopColor="#0d8fcf" />
        </linearGradient>
        <filter id="phoneShadow" x="0" y="0" width="360" height="300" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="24" stdDeviation="22" floodColor="#0c4966" floodOpacity="0.2" />
        </filter>
      </defs>
      <ellipse cx="182" cy="262" rx="110" ry="18" fill="#0d8fcf" opacity="0.08" />
      <g transform="rotate(-7 180 150)" filter="url(#phoneShadow)">
        <rect x="111" y="21" width="138" height="247" rx="34" fill="url(#phoneCase)" />
        <rect x="123" y="36" width="114" height="218" rx="26" fill="url(#phoneScreen)" />
        <rect x="156" y="51" width="48" height="7" rx="4" fill="#14364a" />
        <path
          d="M180 82c33 0 54 26 48 68-5 36-20 70-48 70s-43-34-48-70c-6-42 15-68 48-68Z"
          fill="url(#tongueGrad)"
        />
        <path d="M151 103c16-9 39-12 58-2" fill="none" stroke="white" strokeLinecap="round" strokeWidth="5" opacity="0.72" />
        <path d="M211 127c6 22 5 45-2 65" fill="none" stroke="white" strokeLinecap="round" strokeWidth="4" opacity="0.55" />
        <circle cx="180" cy="236" r="13" fill="white" />
        <circle cx="180" cy="236" r="7" fill="#14364a" />
        <path d="M139 92h24M139 92v24M221 92h-24M221 92v24M139 206h24M139 206v-24M221 206h-24M221 206v-24" fill="none" stroke="white" strokeLinecap="round" strokeWidth="4" opacity="0.9" />
      </g>
      <g opacity="0.9">
        <rect x="54" y="70" width="78" height="42" rx="21" fill="white" opacity="0.86" />
        <path d="M74 91h29M95 82l10 9-10 9" fill="none" stroke="url(#scanBlue)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        <circle cx="285" cy="89" r="20" fill="url(#scanBlue)" opacity="0.14" />
        <path d="M285 75v28M271 89h28" stroke="url(#scanBlue)" strokeLinecap="round" strokeWidth="5" />
        <circle cx="81" cy="197" r="8" fill="#1eb8e0" opacity="0.5" />
        <circle cx="300" cy="202" r="6" fill="#1eb8e0" opacity="0.42" />
      </g>
    </svg>
  )
}
