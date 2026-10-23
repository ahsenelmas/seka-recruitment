"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export default function DemoAccessBoundary({children}: {children: React.ReactNode}) {
 const pathname=usePathname(); const [entered,setEntered]=useState(false);
 useEffect(()=>{if(pathname==="/login")return;try{if(sessionStorage.getItem("seka-demo-entered")==="yes"){setEntered(true);return;}}catch{}window.location.replace("/login");},[pathname]);
 if(pathname==="/login"||entered)return <>{children}</>;
 return <main className="empty-state"><p>SEKA · Ładowanie / Loading…</p><a href="/login">Przejdź do wyboru roli / Choose a role</a></main>;
}
