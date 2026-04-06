"use client";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { ethers } from "ethers";

const CONTRACT = "0x80fc3f9E5Aa513cB3DAfa721D8236A0e791dc3aF";
const CHAIN_ID_HEX = "0x8df38dd443ebb";
const RPC = "https://fortress-node-production.up.railway.app";
const GAS_STATION = "0xBd33C81E9c15f9554140bF49bDF3db6269E094f5";

type Section = "home" | "how" | "bridge" | "vault" | "faucet" | "tools" | "about";
type Tool = "advisor" | "simulator" | "leaderboard" | "history";
interface Tx { type: string; amount: string; hash: string; time: number; status: string; }
interface BalanceSnapshot { time: number; balance: number; yield: number; }

export default function Fortress() {
  const { openConnect } = useInterwovenKit();
  const [section, setSection] = useState<Section>("home");
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState("0.0000");
  const [walletBalance, setWalletBalance] = useState("0.0000");
  const [yieldEarned, setYieldEarned] = useState("0.000000");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<{ type: "ok" | "err" | "info"; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>("advisor");
  const [aiInput, setAiInput] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [simAmount, setSimAmount] = useState("1000");
  const [simDays, setSimDays] = useState(365);
  const [history, setHistory] = useState<BalanceSnapshot[]>([]);
  const [txHistory, setTxHistory] = useState<Tx[]>([]);
  const [lbData, setLbData] = useState<any[]>([]);
  const [faucetAddr, setFaucetAddr] = useState("");
  const [faucetAmount, setFaucetAmount] = useState("100");
  const [faucetStatus, setFaucetStatus] = useState<{ type: "ok" | "err" | "info"; msg: string } | null>(null);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("fortress_address");
    const savedKey = localStorage.getItem("fortress_api_key");
    const savedTx = localStorage.getItem("fortress_tx_history");
    const savedHistory = localStorage.getItem("fortress_history");
    if (saved) { setAddress(saved); refresh(saved); }
    if (savedKey) { setApiKey(savedKey); setApiKeySaved(true); }
    if (savedTx) setTxHistory(JSON.parse(savedTx));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => {
    if (!address) return;
    intervalRef.current = setInterval(() => refresh(address), 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [address]);

  const saveSnapshot = useCallback((bal: number, yld: number) => {
    try {
      const stored = JSON.parse(localStorage.getItem("fortress_history") || "[]");
      const snap: BalanceSnapshot = { time: Date.now(), balance: bal, yield: yld };
      const updated = [...stored.slice(-99), snap];
      localStorage.setItem("fortress_history", JSON.stringify(updated));
      setHistory(updated);
    } catch {}
  }, []);

  async function refresh(addr: string) {
  try {
    const provider = new ethers.BrowserProvider((window as any).ethereum);

    const abi = [
      "function balances(address) view returns (uint256)",
      "function calculateYield(address) view returns (uint256)"
    ];

    const c = new ethers.Contract(CONTRACT, abi, provider);

    const [bal, yld, walBal] = await Promise.all([
      c.balances(addr),
      c.calculateYield(addr),
      provider.getBalance(addr)
    ]);

    const balNum = parseFloat(ethers.formatEther(bal));
    const yldNum = parseFloat(ethers.formatEther(yld));
    const walNum = parseFloat(ethers.formatEther(walBal));

    setBalance(balNum.toFixed(4));
    setYieldEarned(yldNum.toFixed(6));
    setWalletBalance(walNum.toFixed(4));

    if (balNum > 0) saveSnapshot(balNum, yldNum);
  } catch {}
}

  async function fetchLeaderboard() {
  try {
    const provider = new ethers.BrowserProvider((window as any).ethereum);

    const abi = [
      "function balances(address) view returns (uint256)",
      "function calculateYield(address) view returns (uint256)",
      "event Deposited(address indexed user, uint256 amount)"
    ];

    const c = new ethers.Contract(CONTRACT, abi, provider);

    const events = await c.queryFilter(c.filters.Deposited(), 0, "latest");

    const uniqueAddrs = [...new Set(events.map((e: any) => e.args[0]))];

    const rows = await Promise.all(
      uniqueAddrs.map(async (addr: any) => {
        const [bal, yld] = await Promise.all([
          c.balances(addr),
          c.calculateYield(addr)
        ]);

        return {
          addr: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
          fullAddr: addr,
          deposited: parseFloat(ethers.formatEther(bal)).toFixed(4),
          earned: parseFloat(ethers.formatEther(yld)).toFixed(6),
          bal: parseFloat(ethers.formatEther(bal))
        };
      })
    );

    setLbData(rows.filter(r => r.bal > 0).sort((a, b) => b.bal - a.bal));
  } catch {}
}

  useEffect(() => { if (activeTool === "leaderboard") fetchLeaderboard(); }, [activeTool]);

  async function connect() {
    try {
      await (window as any).ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: CHAIN_ID_HEX, chainName: "Snow Chain", nativeCurrency: { name: "SNW", symbol: "SNW", decimals: 18 }, rpcUrls: [RPC] }] });
    } catch {}
    try { await (window as any).ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] }); } catch {}
    const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
    setAddress(accounts[0]);
    localStorage.setItem("fortress_address", accounts[0]);
    await refresh(accounts[0]);
    setSection("vault");
  }

  function disconnect() {
    setAddress(""); setBalance("0.0000"); setWalletBalance("0.0000"); setYieldEarned("0.000000");
    localStorage.removeItem("fortress_address");
    setSection("home");
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  function saveTx(tx: Tx) {
    const stored = JSON.parse(localStorage.getItem("fortress_tx_history") || "[]");
    const updated = [tx, ...stored].slice(0, 50);
    localStorage.setItem("fortress_tx_history", JSON.stringify(updated));
    setTxHistory(updated);
  }

 async function deposit() {
  if (!amount) return;

  setLoading(true);
  setStatus({ type: "info", msg: "Sending deposit to Snow Chain..." });

  try {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();

    const c = new ethers.Contract(
      CONTRACT,
      ["function deposit() payable"],
      signer
    );

    const tx = await c.deposit({
      value: ethers.parseEther(amount)
    });

    setStatus({ type: "info", msg: "Waiting for confirmation..." });

    const receipt = await tx.wait();

    await refresh(address);

    saveTx({
      type: "Deposit",
      amount: `${amount} SNW`,
      hash: receipt.hash,
      time: Date.now(),
      status: "Confirmed"
    });

    setStatus({ type: "ok", msg: `${amount} SNW deposited.` });
    setAmount("");
  } catch (e: any) {
    setStatus({ type: "err", msg: e.message?.slice(0, 120) ?? "Error" });
  }

  setLoading(false);
}

  async function withdraw() {
  if (!amount) {
    setStatus({ type: "err", msg: "Enter the amount you want to withdraw." });
    return;
  }
  setLoading(true);
  setStatus({ type: "info", msg: "Preparing your withdrawal..." });
  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    const c = new ethers.Contract(
      CONTRACT,
      ["function withdraw(uint256 amount)"],
      signer
    );
const tx = await c.withdraw(ethers.parseEther(amount));
    setStatus({ type: "info", msg: "Almost there, waiting for confirmation..." });
    const receipt = await tx.wait();
    await refresh(address);
    saveTx({ type: "Withdraw", amount: `${amount} SNW + yield`, hash: receipt.hash, time: Date.now(), status: "Confirmed" });
    setStatus({ type: "ok", msg: `${amount} SNW + yield sent back to your wallet.` });
  } catch (e: any) {
    setStatus({ type: "err", msg: e.message?.slice(0, 120) ?? "Something went wrong." });
  }
  setLoading(false);
}

  async function requestFaucet() {
    if (!faucetAddr || !faucetAmount) return;
    setFaucetLoading(true);
    setFaucetStatus({ type: "info", msg: "Processing your request..." });
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: faucetAddr, amount: faucetAmount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFaucetStatus({ type: "ok", msg: `${faucetAmount} SNW sent to ${faucetAddr.slice(0, 8)}...${faucetAddr.slice(-4)}. Tx: ${data.hash?.slice(0, 10)}...` });
      setFaucetAddr("");
    } catch (e: any) { setFaucetStatus({ type: "err", msg: e.message?.slice(0, 120) ?? "Faucet failed." }); }
    setFaucetLoading(false);
  }

  function saveApiKey() { localStorage.setItem("fortress_api_key", apiKey); setApiKeySaved(true); }
  function removeApiKey() { localStorage.removeItem("fortress_api_key"); setApiKey(""); setApiKeySaved(false); }

  async function askAI() {
  if (!aiInput.trim()) return;
  setAiLoading(true); setAiResponse("");
  try {
    const prompt = `You are the AI advisor for Fortress, a DeFi yield vault on Snow Chain — an EVM appchain on Initia.

FORTRESS: Non-custodial yield vault. Users deposit SNW tokens, earn 5% APY per second, withdraw principal + yield anytime. No lock-up. No fees. Contract: 0xbEB954154E79FF4B124715E9E2568aFDf7340D08.
USER: ${address ? `Wallet: ${address}` : "Not connected"}. Vault: ${balance} SNW. Yield: +${yieldEarned} SNW. Wallet: ${walletBalance} SNW.
SNOW CHAIN: EVM rollup on Initia. 100ms blocks. SNW native token. Chain ID: snow-1. RPC: localhost:8545.
INITIA: L1 blockchain. Testnet: initiation-2. Interwoven Bridge for L1↔Snow Chain transfers. Faucet: app.testnet.initia.xyz/faucet. Bridge: bridge.testnet.initia.xyz.
SNW USES: Snow Chain gas token. Used to pay transaction fees on Snow Chain. Depositable in Fortress vault for yield. First token on Snow Chain.

Answer in 2-4 clear sentences. No jargon. Be specific with numbers when relevant. Question: ${aiInput}`;

    const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
    const data = await res.json();
    setAiResponse(data.content?.[0]?.text ?? "Something went wrong.");
  } catch { setAiResponse("Could not reach the AI. Check your API key."); }
  setAiLoading(false);
}

  const simYield = (amt: number, days: number) => (amt * 0.05 * days) / 365;
  const simTotal = (amt: number, days: number) => amt + simYield(amt, days);
  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  const navItems: { id: Section; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "how", label: "How it works" },
    { id: "bridge", label: "Bridge" },
    { id: "vault", label: "Vault" },
    { id: "faucet", label: "Faucet" },
    { id: "tools", label: "Tools" },
    { id: "about", label: "About" },
  ];

  const toolItems: { id: Tool; label: string }[] = [
    { id: "advisor", label: "AI Advisor" },
    { id: "simulator", label: "Yield Simulator" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "history", label: "Portfolio History" },
  ];

  function SimChart() {
    const amt = parseFloat(simAmount) || 0;
    const points = [7, 30, 90, 180, 365, 730].map(d => ({ d, t: simTotal(amt, d) }));
    const maxVal = points[points.length - 1].t;
    const w = 560; const h = 180; const pad = 48;
    const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = (v: number) => h - pad - ((v - amt) / (maxVal - amt + 0.001)) * (h - pad * 2);
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.t)}`).join(" ");
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", background: "var(--surface)", borderRadius: 8 }}>
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="var(--line)" strokeWidth="1" />
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--line)" strokeWidth="1" />
        {[0, 0.5, 1].map((t, i) => {
          const val = amt + t * (maxVal - amt);
          const yy = h - pad - t * (h - pad * 2);
          return <g key={i}><text x={pad - 6} y={yy + 4} fill="var(--muted)" fontSize="9" textAnchor="end" fontFamily="IBM Plex Mono">{val.toFixed(0)}</text></g>;
        })}
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.t)} r="4" fill="var(--accent)" />
            <text x={x(i)} y={h - pad + 14} fill="var(--muted)" fontSize="9" textAnchor="middle" fontFamily="IBM Plex Mono">{p.d}d</text>
          </g>
        ))}
      </svg>
    );
  }

  function HistoryChart() {
    if (history.length < 2) return <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Make a deposit to start tracking your portfolio.</div>;
    const w = 560; const h = 180; const pad = 48;
    const bals = history.map(h => h.balance);
    const minB = Math.min(...bals); const maxB = Math.max(...bals) || 1;
    const x = (i: number) => pad + (i / (history.length - 1)) * (w - pad * 2);
    const y = (v: number) => h - pad - ((v - minB) / (maxB - minB + 0.001)) * (h - pad * 2);
    const pathD = history.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(s.balance)}`).join(" ");
    const areaD = `${pathD} L ${x(history.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", background: "var(--surface)", borderRadius: 8 }}>
        <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" stopOpacity="0.2" /><stop offset="100%" stopColor="#4ade80" stopOpacity="0" /></linearGradient></defs>
        <path d={areaD} fill="url(#ag)" />
        <path d={pathD} fill="none" stroke="#4ade80" strokeWidth="2" />
        <circle cx={x(history.length - 1)} cy={y(history[history.length - 1].balance)} r="4" fill="#4ade80" />
        <text x={pad - 6} y={y(maxB) + 4} fill="var(--muted)" fontSize="9" textAnchor="end" fontFamily="IBM Plex Mono">{maxB.toFixed(2)}</text>
        <text x={pad - 6} y={h - pad + 4} fill="var(--muted)" fontSize="9" textAnchor="end" fontFamily="IBM Plex Mono">{minB.toFixed(2)}</text>
      </svg>
    );
  }
function HeroCanvas() {
  useEffect(() => {
    const canvas = document.getElementById("hero-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    let t = 0;
    let animId: number;

    const rings = [
      { tiltX: 0,    tiltZ: 0,    speed: 0.006, radius: 160 },
      { tiltX: 0.5,  tiltZ: 0.3,  speed: 0.005, radius: 155 },
      { tiltX: 1.0,  tiltZ: 0.6,  speed: 0.007, radius: 148 },
      { tiltX: 1.5,  tiltZ: 0.9,  speed: 0.004, radius: 140 },
      { tiltX: 2.0,  tiltZ: 1.2,  speed: 0.008, radius: 130 },
      { tiltX: 2.5,  tiltZ: 1.5,  speed: 0.005, radius: 118 },
      { tiltX: 3.0,  tiltZ: 1.8,  speed: 0.006, radius: 105 },
      { tiltX: -0.5, tiltZ: -0.3, speed: 0.007, radius: 155 },
      { tiltX: -1.0, tiltZ: -0.6, speed: 0.005, radius: 148 },
      { tiltX: -1.5, tiltZ: -0.9, speed: 0.006, radius: 138 },
      { tiltX: -2.0, tiltZ: -1.2, speed: 0.007, radius: 125 },
      { tiltX: -2.5, tiltZ: -1.5, speed: 0.004, radius: 110 },
    ];

    function drawRing(
      cx: number, cy: number,
      radius: number,
      tiltX: number, tiltZ: number,
      angle: number,
      opacity: number
    ) {
      const points: [number, number][] = [];
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        let x = Math.cos(a) * radius;
        let y = Math.sin(a) * radius;
        let z = 0;
        // rotate around X axis
        const y1 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
        const z1 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
        // rotate around Z axis
        const x2 = x * Math.cos(tiltZ) - y1 * Math.sin(tiltZ);
        const y2 = x * Math.sin(tiltZ) + y1 * Math.cos(tiltZ);
        // rotate around Y axis (main spin)
        const x3 = x2 * Math.cos(angle) + z1 * Math.sin(angle);
        const y3 = y2;
        const z3 = -x2 * Math.sin(angle) + z1 * Math.cos(angle);
        // perspective
        const perspective = 600 / (600 + z3);
        points.push([cx + x3 * perspective, cy + y3 * perspective]);
      }
      ctx.beginPath();
      ctx.strokeStyle = `rgba(196,169,107,${opacity})`;
      ctx.lineWidth = 0.8;
      points.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
      ctx.stroke();
    }

    function draw() {
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      ctx.clearRect(0, 0, W, H);

      rings.forEach((ring, i) => {
        const angle = t * ring.speed + i * 0.2;
        const opacity = 0.25 + (i % 4) * 0.12;
        drawRing(cx, cy, ring.radius, ring.tiltX, ring.tiltZ, angle, opacity);
      });

      t++;
      animId = requestAnimationFrame(draw);
    }

    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return null;
}
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

        :root{
          --bg:#08080a;
          --surface:#111114;
          --surface2:#18181c;
          --surface3:#202026;
          --white:#f2f0ec;
          --muted:#6b6b72;
          --muted2:#3a3a42;
          --line:rgba(242,240,236,0.06);
          --accent:#c4a96b;
          --accent2:rgba(196,169,107,0.1);
          --green:#4ade80;
          --green2:rgba(74,222,128,0.08);
          --red:#f87171;
          --red2:rgba(248,113,113,0.08);
          --blue:#60a5fa;
        }

        html,body{background:var(--bg);color:var(--white);font-family:'Space Grotesk',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;}
        .mono{font-family:'IBM Plex Mono',monospace;}
        a{color:inherit;text-decoration:none;}
        button{font-family:'Space Grotesk',sans-serif;cursor:pointer;}

        /* NAV */
        nav{
          position:fixed;top:0;left:0;right:0;z-index:300;
          height:56px;
          display:flex;align-items:center;justify-content:space-between;
          padding:0 32px;
          background:rgba(8,8,10,0.85);
          backdrop-filter:blur(24px);
          border-bottom:1px solid var(--line);
        }
        .nav-left{display:flex;align-items:center;gap:28px;}
        .nav-logo{display:flex;align-items:center;gap:9px;cursor:pointer;}
        .logo-f{
          width:26px;height:26px;background:var(--white);
          display:flex;align-items:center;justify-content:center;
          font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;
          color:var(--bg);border-radius:4px;
        }
        .logo-name{font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;}
        .nav-links{display:flex;align-items:center;}
        .nav-link{padding:5px 12px;font-size:13px;font-weight:500;color:var(--muted);cursor:pointer;border:none;background:none;transition:color .15s;border-radius:6px;}
        .nav-link:hover{color:var(--white);}
        .nav-link.active{color:var(--white);background:var(--surface2);}
        .nav-right{display:flex;align-items:center;gap:8px;}
        .chain-badge{
          font-family:'IBM Plex Mono',monospace;font-size:10px;
          color:var(--muted);background:var(--surface2);
          padding:4px 10px;border-radius:20px;
          display:flex;align-items:center;gap:5px;
        }
        .live-dot{width:5px;height:5px;border-radius:50%;background:var(--green);animation:blink 2s infinite;}
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0.3;}}
        .addr-badge{
          font-family:'IBM Plex Mono',monospace;font-size:10px;
          color:var(--accent);background:var(--accent2);
          padding:5px 12px;border-radius:20px;cursor:pointer;
        }
        .btn-connect{
          background:var(--white);color:var(--bg);
          border:none;padding:7px 18px;border-radius:20px;
          font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;
          transition:background .15s;
        }
        .btn-connect:hover{background:var(--accent);}
        .btn-disconnect{
          background:none;color:var(--muted);
          border:1px solid var(--muted2);padding:5px 12px;border-radius:20px;
          font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;
          transition:all .15s;
        }
        .btn-disconnect:hover{color:var(--red);border-color:var(--red);}

        .page{padding-top:56px;}

        /* HERO */
        .hero{min-height:calc(100vh - 56px);display:grid;grid-template-rows:1fr auto;position:relative;overflow:hidden;}
        .hero-glow{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 65% 40%,rgba(196,169,107,0.04) 0%,transparent 65%);pointer-events:none;}
        .hero-content{display:flex;flex-direction:column;justify-content:center;padding:80px 64px 60px;position:relative;z-index:1;}
        .hero-tag{
          font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;
          color:var(--accent);margin-bottom:28px;
          display:inline-flex;align-items:center;gap:10px;
        }
        .hero-h1{
          font-size:clamp(56px,8vw,108px);font-weight:700;
          line-height:0.92;letter-spacing:-0.04em;margin-bottom:32px;
        }
        .hero-h1 .ghost{
          -webkit-text-stroke:1px rgba(242,240,236,0.25);
          color:transparent;
        }
        .hero-p{font-size:17px;line-height:1.8;color:var(--muted);max-width:480px;margin-bottom:44px;font-weight:400;}
        .hero-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
        .btn-primary{
          background:var(--white);color:var(--bg);
          border:none;padding:14px 32px;border-radius:8px;
          font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;
          transition:background .15s;
        }
        .btn-primary:hover{background:var(--accent);}
        .btn-secondary{
          background:var(--surface2);color:var(--white);
          border:none;padding:14px 32px;border-radius:8px;
          font-size:13px;font-weight:500;letter-spacing:0.04em;
          transition:background .15s;
        }
        .btn-secondary:hover{background:var(--surface3);}
        .built-on{margin-top:44px;display:flex;align-items:center;gap:12px;}
        .built-label{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);}
        .initia-chip{
          display:flex;align-items:center;gap:7px;
          background:var(--surface2);padding:6px 14px;border-radius:20px;
          font-size:12px;font-weight:600;letter-spacing:0.04em;
        }
        .i-dot{width:16px;height:16px;background:var(--white);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:8px;font-weight:700;color:var(--bg);}

        .metrics{border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(4,1fr);}
        .metric{padding:28px 40px;}
        .metric-n{font-size:32px;font-weight:700;letter-spacing:-0.02em;margin-bottom:4px;}
        .metric-l{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);}

        /* LAYOUT */
        .wrap{max-width:1100px;margin:0 auto;padding:72px 40px;}
        .pg-head{margin-bottom:56px;}
        .pg-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent);margin-bottom:12px;}
        .pg-title{font-size:clamp(32px,4vw,48px);font-weight:700;letter-spacing:-0.025em;line-height:1.05;}
        .pg-sub{font-size:15px;line-height:1.75;color:var(--muted);margin-top:12px;max-width:560px;}

        /* CARD */
        .card{background:var(--surface);border-radius:12px;padding:28px;}
        .card-sm{background:var(--surface2);border-radius:8px;padding:20px;}

        /* HOW */
        .steps{display:flex;flex-direction:column;gap:0;}
        .step{display:grid;grid-template-columns:64px 1fr 1.2fr;align-items:start;padding:32px 0;border-top:1px solid var(--line);transition:background .15s;}
        .step:first-child{border-top:none;}
        .s-n{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.15em;color:var(--accent);padding-top:3px;}
        .s-title{font-size:17px;font-weight:600;letter-spacing:-0.01em;padding-right:40px;line-height:1.4;}
        .s-body{font-size:14px;line-height:1.8;color:var(--muted);}
        .s-body strong{color:var(--white);font-weight:600;}
        .faq{margin-top:56px;}
        .faq-q{font-size:15px;font-weight:600;margin-bottom:8px;padding-top:20px;}
        .faq-a{font-size:14px;line-height:1.75;color:var(--muted);}
        .divider{height:1px;background:var(--line);margin:0;}

        /* BRIDGE */
        .bridge-layout{display:grid;grid-template-columns:1fr 340px;gap:32px;align-items:start;}
        .route{display:flex;align-items:center;margin:24px 0;}
        .route-box{flex:1;background:var(--surface2);border-radius:8px;padding:16px;text-align:center;}
        .route-name{font-size:14px;font-weight:600;margin-bottom:3px;}
        .route-sub{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);}
        .route-arr{padding:0 12px;color:var(--accent);font-size:16px;}
        .bridge-steps{display:flex;flex-direction:column;gap:12px;margin-top:16px;}
        .bs{display:flex;gap:14px;align-items:flex-start;}
        .bs-n{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--accent);flex-shrink:0;margin-top:2px;}
        .bs-t{font-size:14px;line-height:1.65;color:var(--muted);}
        .bs-t strong{color:var(--white);}
        .bridge-links{display:flex;flex-direction:column;gap:2px;margin-top:16px;}
        .blink{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid var(--line);}
        .blink:first-child{border-top:none;}
        .blink-name{font-size:13px;font-weight:600;}
        .blink-desc{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);}
        .blink-arrow{font-size:16px;color:var(--muted);}

        /* VAULT */
        .vault-layout{display:grid;grid-template-columns:1fr 340px;min-height:calc(100vh - 56px);gap:0;}
        .vault-main{padding:48px;display:flex;flex-direction:column;gap:36px;border-right:1px solid var(--line);}
        .vault-side{padding:36px;display:flex;flex-direction:column;gap:20px;background:var(--surface);}
        .sec-label{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-bottom:14px;}
        .bal-card{background:var(--surface);border-radius:12px;overflow:hidden;}
        .bal-top{padding:28px 28px 20px;}
        .bal-live{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.12em;color:var(--muted);display:flex;align-items:center;gap:6px;margin-bottom:14px;}
        .bal-num{font-size:52px;font-weight:700;letter-spacing:-0.04em;line-height:1;}
        .bal-num small{font-size:18px;font-weight:400;color:var(--muted);margin-left:6px;}
        .bal-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--surface2);border-radius:0 0 12px 12px;margin-top:2px;}
        .bs-item{padding:14px 18px;}
        .bs-l{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;}
        .bs-v{font-size:14px;font-weight:600;}
        .bs-v.g{color:var(--green);}
        .bs-v.gold{color:var(--accent);}

        .tx-list{display:flex;flex-direction:column;}
        .tx-head-row{display:grid;grid-template-columns:80px 1fr 1fr 80px;padding:10px 16px;background:var(--surface);border-radius:8px 8px 0 0;}
        .tx-h{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);}
        .tx-item{display:grid;grid-template-columns:80px 1fr 1fr 80px;padding:13px 16px;border-top:1px solid var(--line);}
        .tx-item:nth-child(odd){background:var(--surface);}
        .tx-item:nth-child(even){background:var(--surface2);}
        .tx-cell{font-size:12px;color:var(--muted);}
        .tx-cell.mono{font-family:'IBM Plex Mono',monospace;font-size:11px;}
        .tx-cell.g{color:var(--green);}
        .tx-cell.gold{color:var(--accent);}
        .empty-state{padding:40px 16px;text-align:center;color:var(--muted);font-size:13px;}

        .action-card{background:var(--bg);border-radius:12px;padding:22px;}
        .f-label{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:6px;}
        .f-hint{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--accent);margin-bottom:8px;display:block;}
        .f-input{
          width:100%;background:var(--surface2);border:none;
          padding:12px 14px;color:var(--white);
          font-family:'IBM Plex Mono',monospace;font-size:15px;
          outline:none;margin-bottom:12px;border-radius:8px;
          transition:background .15s;
        }
        .f-input:focus{background:var(--surface3);}
        .f-input::placeholder{color:var(--muted2);}
        .btn-dep{
          width:100%;background:var(--white);color:var(--bg);
          border:none;padding:13px;border-radius:8px;margin-bottom:8px;
          font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
          transition:background .15s;
        }
        .btn-dep:hover:not(:disabled){background:var(--accent);}
        .btn-dep:disabled{opacity:0.3;cursor:not-allowed;}
        .btn-wth{
          width:100%;background:var(--surface2);color:var(--white);
          border:none;padding:13px;border-radius:8px;
          font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;
          transition:background .15s;
        }
        .btn-wth:hover:not(:disabled){background:var(--surface3);}
        .btn-wth:disabled{opacity:0.3;cursor:not-allowed;}

        .status-bar{margin-top:10px;padding:11px 14px;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;}
        .status-bar.ok{background:var(--green2);color:var(--green);}
        .status-bar.err{background:var(--red2);color:var(--red);}
        .status-bar.info{background:var(--accent2);color:var(--accent);}

        .vault-details{display:flex;flex-direction:column;gap:0;}
        .vd-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--line);}
        .vd-row:first-child{border-top:none;}
        .vd-k{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);}
        .vd-v{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--white);}

        .connect-wall{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - 120px);gap:16px;text-align:center;padding:40px;}
        .connect-wall h2{font-size:24px;font-weight:700;letter-spacing:-0.02em;}
        .connect-wall p{font-size:14px;color:var(--muted);max-width:320px;line-height:1.7;}

        /* FAUCET */
        .faucet-layout{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;}
        .faucet-info{display:flex;flex-direction:column;gap:16px;}
        .info-item{background:var(--surface2);border-radius:8px;padding:18px 20px;display:flex;gap:14px;align-items:flex-start;}
        .info-icon{font-size:18px;flex-shrink:0;}
        .info-text{font-size:14px;line-height:1.7;color:var(--muted);}
        .info-text strong{color:var(--white);}

        /* TOOLS */
        .tools-layout{display:grid;grid-template-columns:180px 1fr;min-height:calc(100vh - 56px);}
        .tools-nav{padding:28px 0;background:var(--surface);}
        .tn-label{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted);padding:12px 20px 8px;display:block;}
        .tn-item{display:block;width:100%;padding:10px 20px;font-size:13px;font-weight:500;color:var(--muted);cursor:pointer;border:none;background:none;text-align:left;transition:all .15s;border-left:2px solid transparent;border-radius:0;}
        .tn-item:hover{color:var(--white);background:var(--surface2);}
        .tn-item.active{color:var(--accent);border-left-color:var(--accent);background:var(--surface2);}
        .tools-body{padding:48px;}

        .ai-wrap{max-width:640px;}
        .ai-key-row{display:flex;gap:8px;margin-bottom:6px;}
        .ai-key-inp{flex:1;background:var(--surface2);border:none;padding:10px 13px;color:var(--white);font-family:'IBM Plex Mono',monospace;font-size:13px;outline:none;border-radius:8px;}
        .btn-save{background:var(--accent2);color:var(--accent);border:none;padding:10px 14px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;transition:all .15s;white-space:nowrap;}
        .btn-save:hover{background:rgba(196,169,107,0.2);}
        .btn-remove{background:var(--red2);color:var(--red);border:none;padding:10px 14px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;transition:all .15s;white-space:nowrap;}
        .btn-remove:hover{background:rgba(248,113,113,0.15);}
        .ai-quick{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px;}
        .ai-chip{background:var(--surface2);color:var(--muted);border:none;padding:6px 12px;border-radius:20px;font-size:12px;font-family:'Space Grotesk',sans-serif;cursor:pointer;transition:all .15s;}
        .ai-chip:hover{background:var(--surface3);color:var(--white);}
        .ai-ta{width:100%;background:var(--surface2);border:none;padding:13px 14px;color:var(--white);font-size:14px;line-height:1.6;outline:none;resize:vertical;min-height:80px;margin-bottom:12px;border-radius:8px;font-family:'Space Grotesk',sans-serif;}
        .ai-ta:focus{background:var(--surface3);}
        .ai-ta::placeholder{color:var(--muted2);}
        .btn-ask{background:var(--white);color:var(--bg);border:none;padding:11px 24px;border-radius:8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;transition:background .15s;}
        .btn-ask:hover:not(:disabled){background:var(--accent);}
        .btn-ask:disabled{opacity:0.3;cursor:not-allowed;}
        .ai-resp{margin-top:20px;padding:20px;background:var(--surface2);border-radius:10px;font-size:15px;line-height:1.8;color:var(--white);}
        .ai-resp-label{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--accent);margin-bottom:10px;}

        .sim-controls{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px;}
        .sim-label{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:7px;}
        .sim-input{width:100%;background:var(--surface2);border:none;padding:11px 14px;color:var(--white);font-family:'IBM Plex Mono',monospace;font-size:16px;outline:none;border-radius:8px;}
        .sim-range{width:100%;margin-top:8px;accent-color:var(--accent);}
        .sim-results{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:28px;}
        .sim-r{background:var(--surface2);border-radius:8px;padding:20px;}
        .sim-r-l{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
        .sim-r-v{font-size:22px;font-weight:700;letter-spacing:-0.02em;}
        .sim-r-v.gold{color:var(--accent);}
        .sim-r-v.green{color:var(--green);}

        .lb-head{display:grid;grid-template-columns:44px 1fr 1fr 1fr;padding:10px 16px;background:var(--surface);border-radius:8px 8px 0 0;}
        .lb-th{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);}
        .lb-item{display:grid;grid-template-columns:44px 1fr 1fr 1fr;padding:14px 16px;border-top:1px solid var(--line);align-items:center;transition:background .15s;}
        .lb-item:hover{background:var(--surface2);}
        .lb-rank{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:500;}
        .lb-rank.gold{color:var(--accent);}
        .lb-rank.silver{color:#aaa;}
        .lb-rank.bronze{color:#cd7f32;}
        .lb-cell{font-size:13px;color:var(--muted);}
        .lb-cell.mono{font-family:'IBM Plex Mono',monospace;font-size:11px;}
        .lb-cell.g{color:var(--green);}
        .lb-foot{padding:13px 16px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);background:var(--surface);border-radius:0 0 8px 8px;}

        .hist-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;}
        .hist-card{background:var(--surface2);border-radius:8px;padding:18px 20px;}
        .hist-l{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
        .hist-v{font-size:18px;font-weight:600;}
        .hist-v.g{color:var(--green);}

        /* ABOUT */
        .about-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .about-cell{background:var(--surface);border-radius:12px;padding:40px 36px;}
        .a-tag{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:var(--accent);margin-bottom:14px;}
        .a-h{font-size:20px;font-weight:600;letter-spacing:-0.02em;margin-bottom:13px;line-height:1.3;}
        .a-p{font-size:14px;line-height:1.8;color:var(--muted);}
        .a-p strong{color:var(--white);}
        .tech-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px;}
        .tech-cell{background:var(--surface2);border-radius:8px;padding:18px 20px;}
        .tech-n{font-size:14px;font-weight:600;margin-bottom:3px;}
        .tech-d{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);}

        /* FOOTER */
        footer{padding:20px 32px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;}
        .foot-l{display:flex;align-items:center;gap:20px;flex-wrap:wrap;}
        .foot-copy{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);}
        .foot-a{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);cursor:pointer;border:none;background:none;transition:color .15s;text-decoration:none;}
        .foot-a:hover{color:var(--white);}
        .social-row{display:flex;align-items:center;gap:8px;}
        .social-btn{
          font-family:'IBM Plex Mono',monospace;font-size:11px;
          color:var(--muted);background:var(--surface2);
          border:none;padding:5px 13px;border-radius:20px;
          text-decoration:none;transition:all .15s;
        }
        .social-btn:hover{background:var(--surface3);color:var(--white);}
        .foot-tags{display:flex;align-items:center;gap:6px;}
        .foot-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);background:var(--surface2);padding:4px 10px;border-radius:20px;}

        @media(max-width:900px){
          .hero-content{padding:60px 24px 48px;}
          .metrics{grid-template-columns:1fr 1fr;}
          .bridge-layout,.vault-layout,.faucet-layout,.about-grid,.tech-grid{grid-template-columns:1fr;}
          .vault-main{border-right:none;}
          .step{grid-template-columns:52px 1fr;}
          .s-title{padding-right:0;padding-bottom:8px;}
          .s-body{padding-top:8px;}
          .sim-controls{grid-template-columns:1fr;}
          .sim-results{grid-template-columns:1fr 1fr;}
          .wrap{padding:48px 20px;}
          nav{padding:0 16px;}
          .nav-links{display:none;}
          footer{padding:16px 20px;}
          .tools-layout{grid-template-columns:1fr;}
          .tools-nav{border-right:none;}
          .hist-cards{grid-template-columns:1fr 1fr;}
          .bal-stats{grid-template-columns:1fr 1fr;}
        }
      `}</style>

      {/* NAV */}
      <nav>
        <div className="nav-left">
          <div className="nav-logo" onClick={() => setSection("home")}>
            <div className="logo-f">F</div>
            <span className="logo-name">Fortress</span>
          </div>
          <div className="nav-links">
            {navItems.map(n => (
              <button key={n.id} className={`nav-link${section === n.id ? " active" : ""}`}
                onClick={() => { if (n.id === "vault" && !address) connect(); else setSection(n.id); }}>
                {n.label}
              </button>
            ))}
          </div>
        </div>
        <div className="nav-right">
          <div className="chain-badge"><span className="live-dot" />Snow Chain</div>
          {address ? (
            <>
              <div className="addr-badge" onClick={() => setSection("vault")}>{shortAddr}</div>
              <button className="btn-disconnect" onClick={disconnect}>Disconnect</button>
            </>
          ) : (
            <button className="btn-connect" onClick={connect}>Connect</button>
          )}
        </div>
      </nav>

      <div className="page">

        {/* HOME */}
{section === "home" && (
  <div className="hero" style={{ display: "grid", gridTemplateRows: "1fr auto" }}>
    <div className="hero-glow" />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", position: "relative", zIndex: 1 }}>
      <div className="hero-content" style={{ padding: "80px 64px 60px" }}>
        <div className="hero-tag">Yield Vault on Snow Chain</div>
        <h1 className="hero-h1">Your assets.<br /><span className="ghost">Working.</span></h1>
        <p className="hero-p">Put your tokens in Fortress, earn yield while you sleep, take them back whenever you want. Built on Snow Chain, powered by Initia.</p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={connect}>Open Vault</button>
          <button className="btn-secondary" onClick={() => setSection("how")}>How it works</button>
        </div>
        <div className="built-on">
          <span className="built-label">Powered by</span>
          <div className="initia-chip"><div className="i-dot">I</div>Initia Network</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 40px 40px 0" }}>
  <canvas id="hero-canvas" style={{ width: "100%", height: "480px", display: "block" }} />
</div>
    </div>
    <div className="metrics">
      <div className="metric"><div className="metric-n">5%</div><div className="metric-l">Annual yield</div></div>
      <div className="metric"><div className="metric-n">100ms</div><div className="metric-l">Block time</div></div>
      <div className="metric"><div className="metric-n">0 days</div><div className="metric-l">Lock-up period</div></div>
      <div className="metric"><div className="metric-n">SNW</div><div className="metric-l">Native token</div></div>
    </div>
    <HeroCanvas />
  </div>
)}

        {/* HOW IT WORKS */}
        {section === "how" && (
          <div className="wrap">
            <div className="pg-head">
              <div className="pg-tag">How it works</div>
              <div className="pg-title">Simple from start to finish</div>
              <div className="pg-sub">Fortress was built for people who want to earn yield without sitting through a tutorial.</div>
            </div>
            <div className="steps">
              {[
                { n: "01", title: "Connect your wallet", body: <>Click Connect and Snow Chain is added to MetaMask automatically. Your existing wallet works here.</> },
                { n: "02", title: "Get SNW onto Snow Chain", body: <>Use the Bridge tab to move assets from Initia L1, or use the Faucet to get testnet SNW directly.</> },
                { n: "03", title: "Deposit into the vault", body: <>Type how much to deposit and confirm. Your tokens go into the Fortress contract. Only you can withdraw.</> },
                { n: "04", title: "Yield builds every second", body: <><strong>5% APY accrues automatically</strong> from the moment your deposit confirms. Watch it grow in real time.</> },
                { n: "05", title: "Withdraw whenever you want", body: <>One transaction sends back your principal plus all earned yield. No waiting period. No fees.</> },
              ].map(s => (
                <div className="step" key={s.n}>
                  <div className="s-n mono">{s.n}</div>
                  <div className="s-title">{s.title}</div>
                  <div className="s-body">{s.body}</div>
                </div>
              ))}
            </div>
            <div className="faq" style={{ marginTop: 56 }}>
              <div className="pg-tag">Questions</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "12px 0 28px" }}>Things people ask</div>
              {[
                { q: "Is my money safe here?", a: "The contract holds your tokens, not a company or team. Only your wallet can withdraw. The code is publicly verifiable on Snow Chain." },
                { q: "Where does the yield come from?", a: "Yield is paid from the vault reserve at 5% per year, calculated per second. Future versions will use live DeFi strategies." },
                { q: "What is Snow Chain?", a: "Snow Chain is an EVM rollup on Initia. 100ms blocks, SNW as native token, connected to Initia L1 through the Interwoven Bridge." },
                { q: "Are there any fees?", a: "Fortress takes no protocol fee. You only pay standard Snow Chain gas, which is very low." },
              ].map((f, i) => (
                <div key={f.q}>
                  {i > 0 && <div className="divider" />}
                  <div className="faq-q">{f.q}</div>
                  <div className="faq-a">{f.a}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BRIDGE */}
        {section === "bridge" && (
          <div className="wrap">
            <div className="pg-head">
              <div className="pg-tag">Bridge</div>
              <div className="pg-title">Bring your tokens to Snow Chain</div>
              <div className="pg-sub">The Interwoven Bridge is Initia's native cross-chain protocol. Fortress is built to work with it when deployed on a live network.</div>
            </div>
            <div className="bridge-layout">
              <div>
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="sec-label">Transfer path</div>
                  <div className="route">
                    <div className="route-box"><div className="route-name">Initia L1</div><div className="route-sub mono">initiation-2</div></div>
                    <div className="route-arr">→</div>
                    <div className="route-box"><div className="route-name">Snow Chain</div><div className="route-sub mono">EVM appchain</div></div>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.75 }}>Tokens move through the Interwoven Bridge. Once confirmed on L1, they appear on Snow Chain within seconds.</p>
                </div>
                <div className="card">
                  <div className="sec-label">Steps</div>
                  <div className="bridge-steps">
                    {[
                      { n: "01", t: <><strong>Interwoven Bridge</strong> is Initia's native protocol for moving assets between L1 and any appchain like Base, Op, Arb, Snow Chain.</> },
{ n: "02", t: <><strong>No third party bridges needed.</strong> Assets move directly through the Initia protocol, fast and cheap.</> },
{ n: "03", t: <><strong>Snow Chain connects natively.</strong> As an EVM rollup on Initia, Snow Chain inherits the full bridge infrastructure automatically.</> },
                    ].map(s => (
                      <div className="bs" key={s.n}>
                        <span className="bs-n mono">{s.n}</span>
                        <span className="bs-t">{s.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="card">
                  <div className="sec-label">Quick links</div>
                  <div className="bridge-links">
                    {[
                      { name: "Initia Faucet ↗", href: "https://app.testnet.initia.xyz/faucet", desc: "Get free testnet INIT" },
                      { name: "Interwoven Bridge ↗", href: "https://bridge.testnet.initia.xyz", desc: "Bridge INIT to Snow Chain" },
                      { name: "Initia Scan ↗", href: "https://scan.testnet.initia.xyz", desc: "Track L1 transactions" },
                      { name: "Initia Docs ↗", href: "https://docs.initia.xyz", desc: "Full documentation" },
                    ].map(l => (
                      <a key={l.name} className="blink" href={l.href} target="_blank" rel="noreferrer">
                        <div>
                          <div className="blink-name">{l.name}</div>
                          <div className="blink-desc">{l.desc}</div>
                        </div>
                        <div className="blink-arrow">↗</div>
                      </a>
                    ))}
                  </div>
                  <button className="btn-primary" style={{ width: "100%", marginTop: 20, borderRadius: 8 }} onClick={() => { if (address) setSection("vault"); else connect(); }}>
                    {address ? "Go to Vault" : "Connect Wallet"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VAULT */}
        {section === "vault" && (
          !address ? (
            <div className="connect-wall">
              <div style={{ width: 48, height: 48, background: "var(--surface2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 8 }}>⬡</div>
              <h2>Connect to open the vault</h2>
              <p>Snow Chain gets added to MetaMask automatically when you connect.</p>
              <button className="btn-primary" onClick={connect}>Connect Wallet</button>
            </div>
          ) : (
            <div className="vault-layout">
              <div className="vault-main">
                <div>
                  <div className="sec-label">Portfolio overview</div>
                  <div className="bal-card">
                    <div className="bal-top">
                      <div className="bal-live"><span className="live-dot" />Vault balance · live</div>
                      <div className="bal-num">{balance}<small>SNW</small></div>
                    </div>
                    <div className="bal-stats">
                      <div className="bs-item"><div className="bs-l">Yield earned</div><div className="bs-v g">+{yieldEarned}</div></div>
                      <div className="bs-item"><div className="bs-l">APY</div><div className="bs-v">5.00%</div></div>
                      <div className="bs-item"><div className="bs-l">Wallet</div><div className="bs-v gold">{walletBalance} SNW</div></div>
                      <div className="bs-item"><div className="bs-l">Lock-up</div><div className="bs-v">None</div></div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="sec-label">Transaction history</div>
                  <div className="tx-list">
                    <div className="tx-head-row">
                      <span className="tx-h">Type</span>
                      <span className="tx-h">Amount</span>
                      <span className="tx-h">Hash</span>
                      <span className="tx-h">Status</span>
                    </div>
                    {txHistory.length > 0 ? txHistory.slice(0, 8).map((tx, i) => (
                      <div className="tx-item" key={i}>
                        <span className={`tx-cell mono ${tx.type === "Deposit" ? "gold" : "g"}`}>{tx.type}</span>
                        <span className="tx-cell">{tx.amount}</span>
                        <span className="tx-cell mono">{tx.hash.slice(0, 8)}...{tx.hash.slice(-4)}</span>
                        <span className="tx-cell g">{tx.status}</span>
                      </div>
                    )) : <div className="empty-state">No transactions yet. Make a deposit to get started.</div>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn-secondary" style={{ padding: "9px 16px", fontSize: 12, borderRadius: 8 }} onClick={() => setSection("tools")}>AI Advisor</button>
                  <button className="btn-secondary" style={{ padding: "9px 16px", fontSize: 12, borderRadius: 8 }} onClick={() => { setSection("tools"); setActiveTool("simulator"); }}>Yield Simulator</button>
                  <button className="btn-secondary" style={{ padding: "9px 16px", fontSize: 12, borderRadius: 8 }} onClick={() => { setSection("tools"); setActiveTool("history"); }}>Portfolio History</button>
                </div>
              </div>

              <div className="vault-side">
                <div>
                  <div className="sec-label">Actions</div>
                  <div className="action-card">
                    <label className="f-label">Deposit amount</label>
                    <span className="f-hint">Available: {walletBalance} SNW in wallet</span>
                    <input type="number" className="f-input" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)} />
                    <button className="btn-dep" onClick={deposit} disabled={loading || !amount}>{loading ? "Confirming..." : "Deposit into Vault"}</button>
                    <div style={{ height: 12 }} />
                    <label className="f-label">Withdraw</label>
                    <span className="f-hint">In vault: {balance} SNW + {yieldEarned} yield</span>
                    <button className="btn-wth" onClick={withdraw} disabled={loading || !amount}>{loading ? "Confirming..." : "Withdraw and Collect Yield"}</button>
                    {status && <div className={`status-bar ${status.type}`}>{status.msg}</div>}
                  </div>
                </div>
                <div>
                  <div className="sec-label">Vault details</div>
                  <div className="vault-details">
                    {[
                      { k: "Contract", v: "0xbEB95...0D08" },
                      { k: "Network", v: "Snow Chain" },
                      { k: "Token", v: "SNW" },
                      { k: "Yield rate", v: "5% per year" },
                      { k: "Custody", v: "Non-custodial" },
                      { k: "Lock-up", v: "None" },
                      { k: "Protocol fee", v: "0%" },
                    ].map(d => (
                      <div className="vd-row" key={d.k}>
                        <span className="vd-k">{d.k}</span>
                        <span className="vd-v">{d.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* FAUCET */}
        {section === "faucet" && (
          <div className="wrap">
            <div className="pg-head">
              <div className="pg-tag">Faucet</div>
              <div className="pg-title">Get SNW tokens</div>
              <div className="pg-sub">SNW is the native token of Snow Chain. Use it to pay for transactions and deposit into the Fortress vault.</div>
            </div>
            <div className="faucet-layout">
              <div>
                <div className="card">
                  <div className="sec-label">Request tokens</div>
                  <label className="f-label" style={{ marginTop: 4 }}>Your Snow Chain wallet address</label>
                  <input
                    type="text"
                    className="f-input"
                    placeholder="0x..."
                    value={faucetAddr}
                    onChange={e => setFaucetAddr(e.target.value)}
                  />
                  <label className="f-label">Amount (SNW)</label>
                  <input
                    type="number"
                    className="f-input"
                    value={faucetAmount}
                    onChange={e => setFaucetAmount(e.target.value)}
                    max="1000"
                  />
                  <button
                    className="btn-primary"
                    style={{ width: "100%", borderRadius: 8 }}
                    onClick={requestFaucet}
                    disabled={faucetLoading || !faucetAddr}
                  >
                    {faucetLoading ? "Sending..." : "Request SNW"}
                  </button>
                  {faucetStatus && <div className={`status-bar ${faucetStatus.type}`} style={{ marginTop: 12 }}>{faucetStatus.msg}</div>}
                </div>
              </div>
              <div className="faucet-info">
                <div className="info-item">
                  <div className="info-icon">⬡</div>
                  <div className="info-text"><strong>What is SNW?</strong> SNW is the native token of Snow Chain. It pays for gas on every transaction, including deposits and withdrawals in Fortress.</div>
                </div>
                <div className="info-item">
                  <div className="info-icon">🏦</div>
                  <div className="info-text"><strong>What can I do with SNW?</strong> Deposit it into Fortress to earn 5% APY. Use it to pay for transactions on Snow Chain. More apps will be built on Snow Chain over time.</div>
                </div>
                <div className="info-item">
                  <div className="info-icon">🔗</div>
                  <div className="info-text"><strong>Need INIT instead?</strong> If you want to bridge from Initia L1, get testnet token to bridge to any EVM chain. <a href="https://app.testnet.initia.xyz/faucet" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>app.testnet.initia.xyz/faucet</a> instead.</div>
                </div>
                {address && (
                  <button className="btn-primary" style={{ borderRadius: 8 }} onClick={() => setFaucetAddr(address)}>
                    Use my connected address
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TOOLS */}
        {section === "tools" && (
          <div className="tools-layout">
            <div className="tools-nav">
              <span className="tn-label">DeFi Tools</span>
              {toolItems.map(t => (
                <button key={t.id} className={`tn-item${activeTool === t.id ? " active" : ""}`} onClick={() => setActiveTool(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="tools-body">

              {activeTool === "advisor" && (
                <div className="ai-wrap">
                  <div className="pg-tag">AI Advisor</div>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "12px 0 12px" }}>Ask anything</div>
                  <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24, lineHeight: 1.7 }}>
                    Get answers about your vault, yield strategy, Snow Chain, or Initia.
                    {address && <> Your balance: <strong style={{ color: "var(--white)" }}>{balance} SNW</strong> · Yield: <strong style={{ color: "var(--green)" }}>+{yieldEarned}</strong></>}
                  </p>
                  <div style={{ height: 16 }} />
                  <div className="f-label" style={{ marginBottom: 8 }}>Quick questions</div>
                  <div className="ai-quick">
                    {["When should I withdraw?", "How much will I earn in 30 days?", "What is Snow Chain?", "How does the bridge work?", "What can I do with SNW?", "Is 5% APY good?"].map(q => (
                      <button key={q} className="ai-chip" onClick={() => setAiInput(q)}>{q}</button>
                    ))}
                  </div>
                  <textarea className="ai-ta" placeholder="Ask anything about Fortress, Snow Chain, or Initia..." value={aiInput} onChange={e => setAiInput(e.target.value)} />
                  <button className="btn-ask" onClick={askAI} disabled={aiLoading || !aiInput.trim()}>
                    {aiLoading ? "Thinking..." : "Get Answer"}
                  </button>
                  {aiResponse && (
                    <div className="ai-resp">
                      <div className="ai-resp-label">Fortress AI</div>
                      {aiResponse}
                    </div>
                  )}
                </div>
              )}

              {activeTool === "simulator" && (
                <div>
                  <div className="pg-tag">Yield Simulator</div>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "12px 0 28px" }}>See what you could earn</div>
                  <div className="sim-controls">
                    <div>
                      <label className="sim-label">Deposit amount (SNW)</label>
                      <input type="number" className="sim-input" value={simAmount} onChange={e => setSimAmount(e.target.value)} placeholder="1000" />
                    </div>
                    <div>
                      <label className="sim-label">Time period: {simDays} days</label>
                      <input type="range" className="sim-range" min={1} max={730} value={simDays} onChange={e => setSimDays(parseInt(e.target.value))} />
                    </div>
                  </div>
                  <div className="sim-results">
                    <div className="sim-r">
                      <div className="sim-r-l">You deposit</div>
                      <div className="sim-r-v">{parseFloat(simAmount || "0").toFixed(2)}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "IBM Plex Mono", marginTop: 4 }}>SNW</div>
                    </div>
                    <div className="sim-r">
                      <div className="sim-r-l">Yield earned</div>
                      <div className="sim-r-v gold">+{simYield(parseFloat(simAmount || "0"), simDays).toFixed(4)}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "IBM Plex Mono", marginTop: 4 }}>SNW</div>
                    </div>
                    <div className="sim-r">
                      <div className="sim-r-l">Total after {simDays}d</div>
                      <div className="sim-r-v green">{simTotal(parseFloat(simAmount || "0"), simDays).toFixed(4)}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "IBM Plex Mono", marginTop: 4 }}>SNW</div>
                    </div>
                  </div>
                  <div className="sec-label" style={{ marginBottom: 10 }}>Earnings over time</div>
                  <SimChart />
                  <p style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", fontFamily: "IBM Plex Mono" }}>5% APY, continuous. No lock-up. Withdraw anytime.</p>
                </div>
              )}

              {activeTool === "leaderboard" && (
                <div>
                  <div className="pg-tag">Leaderboard</div>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "12px 0 28px" }}>Top depositors on Snow Chain</div>
                  <div style={{ borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
                    <div className="lb-head">
                      <span className="lb-th">#</span>
                      <span className="lb-th">Address</span>
                      <span className="lb-th">Deposited</span>
                      <span className="lb-th">Yield earned</span>
                    </div>
                    {lbData.length > 0 ? lbData.map((r, i) => (
                      <div className="lb-item" key={i} style={{ background: address && r.fullAddr.toLowerCase() === address.toLowerCase() ? "var(--accent2)" : undefined }}>
                        <span className={`lb-rank${i === 0 ? " gold" : i === 1 ? " silver" : i === 2 ? " bronze" : ""}`}>{i + 1}</span>
                        <span className="lb-cell mono">{r.addr}{address && r.fullAddr.toLowerCase() === address.toLowerCase() ? " · you" : ""}</span>
                        <span className="lb-cell">{r.deposited} SNW</span>
                        <span className="lb-cell g">+{r.earned}</span>
                      </div>
                    )) : <div className="empty-state">Loading from Snow Chain...</div>}
                    <div className="lb-foot">Live contract data · Snow Chain · snow-1</div>
                  </div>
                  <button className="btn-secondary" style={{ marginTop: 14, padding: "10px 20px", fontSize: 12, borderRadius: 8 }} onClick={fetchLeaderboard}>Refresh</button>
                </div>
              )}

              {activeTool === "history" && (
                <div>
                  <div className="pg-tag">Portfolio History</div>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "12px 0 20px" }}>Your balance over time</div>
                  <div className="hist-cards">
                    <div className="hist-card"><div className="hist-l">Vault balance</div><div className="hist-v">{balance} SNW</div></div>
                    <div className="hist-card"><div className="hist-l">Total yield</div><div className="hist-v g">+{yieldEarned}</div></div>
                    <div className="hist-card"><div className="hist-l">Data points</div><div className="hist-v">{history.length}</div></div>
                  </div>
                  <div className="sec-label" style={{ marginBottom: 10 }}>Balance history</div>
                  <HistoryChart />
                  <p style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", fontFamily: "IBM Plex Mono" }}>Tracked locally · Updates every 3 seconds</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABOUT */}
        {section === "about" && (
          <div className="wrap">
            <div className="pg-head">
              <div className="pg-tag">About</div>
              <div className="pg-title">What is Fortress</div>
              <div className="pg-sub">A yield vault that anyone can use. Built on Snow Chain, connected to Initia's cross-chain infrastructure.</div>
            </div>
            <div className="about-grid">
              <div className="about-cell">
  <div className="a-tag">Why we built this</div>
  <h3 className="a-h">DeFi should take 30 seconds, not 30 minutes</h3>
  <p className="a-p">Most yield products bury you in steps before you earn a single cent. Fortress strips it down to the minimum — connect, deposit, collect. That's it.</p>
</div>
<div className="about-cell">
  <div className="a-tag">How it works</div>
  <h3 className="a-h">Your money works while you don't</h3>
  <p className="a-p">Every second your SNW sits in the vault, it earns. No lock-up. No approval windows. When you want out, one transaction sends everything back — principal and yield together.</p>
</div>
<div className="about-cell">
  <div className="a-tag">The infrastructure</div>
  <h3 className="a-h">Built on Snow Chain, settled on Initia</h3>
  <p className="a-p">Snow Chain is an EVM rollup on Initia with 100ms blocks and near-zero fees. Fortress is the first app deployed on it — fast enough that yield updates feel instant.</p>
</div>
<div className="about-cell">
  <div className="a-tag">What's coming</div>
  <h3 className="a-h">Version 1 is the foundation</h3>
  <p className="a-p">Fixed 5% APY is just the start. Next: live yield strategies routing into real protocols, auto-compounding so earnings stack automatically, and session keys so you never see a wallet popup again.</p>
</div>
            </div>
            <div className="tech-grid">
              {[
                { name: "Solidity", desc: "Smart contract" },
                { name: "Initia EVM", desc: "Snow Chain" },
                { name: "Interwoven Bridge", desc: "L1 bridging" },
                { name: "Next.js 16", desc: "Frontend" },
                { name: "Ethers.js v6", desc: "Wallet & contract" },
                { name: "Claude AI", desc: "AI advisor" },
              ].map(t => (
                <div className="tech-cell" key={t.name}>
                  <div className="tech-n">{t.name}</div>
                  <div className="tech-d">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <footer>
          <div className="foot-l">
            <span className="foot-copy">© 2026 Fortress</span>
            <button className="foot-a" onClick={() => setSection("how")}>How it works</button>
            <button className="foot-a" onClick={() => setSection("bridge")}>Bridge</button>
            <button className="foot-a" onClick={() => setSection("faucet")}>Faucet</button>
            <button className="foot-a" onClick={() => setSection("tools")}>Tools</button>
            <button className="foot-a" onClick={() => setSection("about")}>About</button>
            <a className="foot-a" href="https://docs.initia.xyz" target="_blank" rel="noreferrer">Initia ↗</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="social-row">
              <a className="social-btn" href="https://twitter.com/snowfi_" target="_blank" rel="noreferrer">𝕏 Twitter</a>
              <a className="social-btn" href="https://t.me/snow_fi" target="_blank" rel="noreferrer">✈️ Telegram</a>
            </div>
            <div className="foot-tags">
              <span className="foot-tag">Snow Chain</span>
              <span className="foot-tag">SNW</span>
              <span className="foot-tag">Initia EVM</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
