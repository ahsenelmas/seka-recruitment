"use client";
import { useEffect, useState } from "react";
import { apiGet, type DemoContext } from "@/lib/api";
export default function DemoRoleSelector({language,onContext}: {language:"pl"|"en";onContext?:(context:DemoContext)=>void}) {
 const pl=language==="pl";const [role,setRole]=useState<DemoContext["role"]|null>(null);const [error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();apiGet<DemoContext>("/demo/context",controller.signal).then(data=>{setRole(data.role);onContext?.(data);}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[onContext]);
 return <details className="demo-role-panel"><summary>{pl?"Widok i uprawnienia · symulacja ról":"View and permissions · role simulation"}</summary><p className="muted-text">{pl?"Wybór roli nie jest uwierzytelnianiem. Aby zmienić widok, użyj przycisku „Zmień rolę” w nagłówku.":"Role selection is not authentication. Use Change role in the header to switch workspace."}</p>{role==="admin"&&<p className="muted-text">{pl?"Administrator — stan integracji: Microsoft Entra ID niepołączone; wysyłka e-mail nieskonfigurowana; zarządzanie użytkownikami w przygotowaniu.":"Administrator — integration status: Microsoft Entra ID not connected; email delivery not configured; user management pending."}</p>}{error&&<p className="error" role="alert">{pl?"Nie udało się pobrać uprawnień. Sprawdź połączenie z API.":"Could not load permissions. Check the API connection."}</p>}</details>;
}
