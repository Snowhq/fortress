import { NextRequest, NextResponse } from "next/server";

const RPC = "https://fortress-node-production.up.railway.app";
const PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY || "";
const MAX_AMOUNT = 1000;

export async function POST(req: NextRequest) {
  const { address, amount } = await req.json();
  if (!address || !amount) return NextResponse.json({ error: "Missing address or amount" }, { status: 400 });
  if (parseFloat(amount) > MAX_AMOUNT) return NextResponse.json({ error: `Max faucet amount is ${MAX_AMOUNT} SNW` }, { status: 400 });
  if (!PRIVATE_KEY) return NextResponse.json({ error: "Faucet not configured" }, { status: 500 });

  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const tx = await wallet.sendTransaction({
      to: address,
      value: ethers.parseEther(amount.toString()),
    });
    await tx.wait();
    return NextResponse.json({ hash: tx.hash, amount, address });
  } catch (e: any) {
    return NextResponse.json({ error: e.message?.slice(0, 200) ?? "Transaction failed" }, { status: 500 });
  }
}
