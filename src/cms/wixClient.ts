import { createClient, OAuthStrategy } from "@wix/sdk";
import { items } from "@wix/data";
import wixConfig from "../../wix.config.json";

export const wixClient = createClient({
  modules: { items },
  auth: OAuthStrategy({
    clientId: wixConfig.appId,
  }),
});