import { createNetlifyHandler } from "../../_server/netlify-adapter.mjs";

// Native Netlify Request/Response API, not the Lambda compatibility handler.
// Keep paid HTML in server environment configuration; never import it as an asset.
// Every hosted function is production code; a separate test site must explicitly
// opt in with PAYSTACK_ALLOW_TEST_MODE, regardless of provider NODE_ENV defaults.
export default createNetlifyHandler({ env: { ...process.env, NODE_ENV: "production" } });
export const config = { path: "/api/commerce" };
