"use client";
import { useState, useEffect } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InterwovenKitProvider, TESTNET, injectStyles } from "@initia/interwovenkit-react";
import InterwovenKitStyles from "@initia/interwovenkit-react/styles.js";

const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
});

const snowChain = {
  chain_id: "snow-1",
  chain_name: "snow-1",
  pretty_name: "Snow Chain",
  network_type: "testnet",
  bech32_prefix: "init",
  logo_URIs: { png: "https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.png" },
  apis: {
    rpc: [{ address: "http://localhost:26657" }],
    rest: [{ address: "http://localhost:1317" }],
    indexer: [{ address: "http://localhost:8080" }],
    "json-rpc": [{ address: "http://localhost:8545" }],
  },
  fees: { fee_tokens: [{ denom: "usnw", fixed_min_gas_price: 0, low_gas_price: 0, average_gas_price: 0, high_gas_price: 0 }] },
  staking: { staking_tokens: [{ denom: "usnw" }] },
  metadata: { is_l1: false, minitia: { type: "minievm" } },
  native_assets: [{ denom: "usnw", name: "Snow", symbol: "SNW", decimals: 18 }],
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    injectStyles(InterwovenKitStyles);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <InterwovenKitProvider
          {...TESTNET}
          defaultChainId="snow-1"
          // @ts-ignore
          customChain={snowChain}
          // @ts-ignore
          customChains={[snowChain]}
        >
          {children}
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}