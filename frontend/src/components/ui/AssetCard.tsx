"use client";
import React, { useState } from "react";
import { useRealtimePrice } from "@/hooks/useRealtimePrice";
import AnalysisModal from "@/components/ui/AnalysisModal";

/* ── İkonlar ────────────────────────────────────────────────── */
function IconGold() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9z" opacity="0.9"/>
      <path d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" opacity="0.6"/>
      <path d="M9 13h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function IconSwissCross() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="10" y="4" width="4" height="16" rx="1.2"/>
      <rect x="4" y="10" width="16" height="4" rx="1.2"/>
    </svg>
  );
}

function IconChip() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="7" width="10" height="10" rx="2"/>
      <path d="M9 7V4M12 7V4M15 7V4M9 20v-3M12 20v-3M15 20v-3M4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3"/>
    </svg>
  );
}

function IconSignal() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M1.5 8.5a13 13 0 0 1 21 0"/>
      <path d="M5 12a9 9 0 0 1 14 0"/>
      <path d="M8.5 15.5a5 5 0 0 1 7 0"/>
      <circle cx="12" cy="19" r="1" fill="currentColor"/>
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L4 7v6c0 4.4 3.4 8.5 8 9.5 4.6-1 8-5.1 8-9.5V7l-8-4z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L4.5 13.5H12L11 22l8.5-11.5H12L13 2z"/>
    </svg>
  );
}

/* ── Metadata ───────────────────────────────────────────────── */
const META: Record<string, {
  name: string;
  ticker: string;
  color: string;
  bg: string;
  Icon: () => React.ReactElement;
}> = {
  "XAU/USD": { name: "Altın",       ticker: "XAU/USD", color: "#FF9500", bg: "#FFF3DC", Icon: IconGold },
  "USD/CHF": { name: "Swiss Franc", ticker: "USD/CHF", color: "#FF3B30", bg: "#FFECEC", Icon: IconSwissCross },
  MRVL:      { name: "Marvell",     ticker: "MRVL",    color: "#5856D6", bg: "#EEECFF", Icon: IconChip },
  AVGO:      { name: "Broadcom",    ticker: "AVGO",    color: "#34C759", bg: "#E3F9E9", Icon: IconSignal },
  ASELS:     { name: "Aselsan",     ticker: "ASELS",   color: "#0A84FF", bg: "#E5F3FF", Icon: IconShield },
  YEOTK:     { name: "Yeo Teknoloji", ticker: "YEOTK", color: "#FF9F0A", bg: "#FFF4E0", Icon: IconSun },
  KONTR:     { name: "Kontrolmatik", ticker: "KONTR",  color: "#30D158", bg: "#E2F9EB", Icon: IconBolt },
};

/* ── Kart ───────────────────────────────────────────────────── */
export default function AssetCard({ symbol }: { symbol: string }) {
  const { price, direction } = useRealtimePrice(symbol);
  const meta = META[symbol] ?? { name: symbol, ticker: symbol, color: "#007AFF", bg: "#E5F0FF", Icon: IconChip };
  const [showModal, setShowModal] = useState(false);

  const isUp   = direction === "up";
  const isDown = direction === "down";
  const { Icon } = meta;

  return (
    <>
    <div
      onClick={() => setShowModal(true)}
      className="bg-white rounded-[20px] p-5 flex flex-col gap-3 cursor-pointer select-none"
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 6px 20px rgba(0,0,0,0.06)",
        border: "0.5px solid rgba(0,0,0,0.08)",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.07), 0 6px 20px rgba(0,0,0,0.06)";
      }}
    >

      {/* Üst satır: ikon + yön rozeti */}
      <div className="flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center"
          style={{ background: meta.bg, color: meta.color }}
        >
          <Icon />
        </div>
        {direction !== "neutral" && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: isUp ? "#34C759" : "#FF3B30",
              background: isUp ? "#E3F9E9" : "#FFECEC",
            }}
          >
            {isUp ? "↑" : "↓"}
          </span>
        )}
      </div>

      {/* İsim + sembol */}
      <div>
        <p className="text-[15px] font-semibold text-apple-label leading-tight">{meta.name}</p>
        <p className="text-[12px] text-apple-secondary mt-0.5">{meta.ticker}</p>
      </div>

      {/* Fiyat */}
      <div
        className="num text-[24px] font-bold tracking-tight leading-none"
        style={{ color: isUp ? "#34C759" : isDown ? "#FF3B30" : "#1D1D1F" }}
      >
        {price !== null ? (
          price.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: symbol === "XAU/USD" ? 2 : 4,
          })
        ) : (
          <div className="h-7 w-28 rounded-lg bg-gray-100 animate-pulse" />
        )}
      </div>

    </div>

    {showModal && (
      <AnalysisModal
        symbol={symbol}
        name={meta.name}
        color={meta.color}
        onClose={() => setShowModal(false)}
      />
    )}
    </>
  );
}
