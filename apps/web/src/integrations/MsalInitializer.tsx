import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";

/** Calls `initialize()` and handles redirect for embedded MSAL flows. */
export function MsalInitializer() {
  const { instance } = useMsal();
  useEffect(() => {
    void (async () => {
      try {
        await instance.initialize();
        await instance.handleRedirectPromise();
      } catch (e) {
        console.error(e);
      }
    })();
  }, [instance]);
  return null;
}
