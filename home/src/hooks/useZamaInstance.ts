import { useState, useEffect } from "react";
import { createInstance, initSDK, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";

type ZamaInstance = Awaited<ReturnType<typeof createInstance>>;

const TFHE_WASM_PATH = "/tfhe_bg.wasm";
const KMS_WASM_PATH = "/kms_lib_bg.wasm";

export function useZamaInstance() {
  const [instance, setInstance] = useState<ZamaInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initZama = async () => {
      try {
        setIsLoading(true);
        setError(null);

        await initSDK({
          tfheParams: TFHE_WASM_PATH,
          kmsParams: KMS_WASM_PATH,
        });

        const config = {
          ...SepoliaConfig,
          network: window.ethereum ?? SepoliaConfig.network,
        };

        const zamaInstance = await createInstance(config);

        if (mounted) {
          setInstance(zamaInstance);
        }
      } catch (err) {
        console.error("Failed to initialize Zama instance:", err);
        if (mounted) {
          setError("Failed to initialize encryption service");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initZama();

    return () => {
      mounted = false;
    };
  }, []);

  return { instance, isLoading, error };
}
