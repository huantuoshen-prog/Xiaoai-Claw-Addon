import { createXiaoaiCloudPlugin } from "./src/provider.js";

const pluginEntry = {
    id: "openclaw-plugin-xiaoai-cloud",
    name: "Xiaoai Speaker Cloud Plugin",
    register(api: any) {
        const plugin = createXiaoaiCloudPlugin(api);
        plugin.registerTools();
        plugin.start();
        api.registerService({
            id: "xiaoai-cloud-listener",
            start: async (ctx: any) => {
                await plugin.startService(ctx);
            },
            stop: async () => {
                await plugin.stopService();
            }
        });
    }
};

export default pluginEntry;
