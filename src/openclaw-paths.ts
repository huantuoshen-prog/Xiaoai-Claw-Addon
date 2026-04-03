import os from "os";
import path from "path";

export const XIAOAI_CLOUD_PLUGIN_SUBDIR = path.join("plugins", "xiaoai-cloud");

function readString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

function expandHomePath(value: string) {
    if (!value.startsWith("~")) {
        return value;
    }
    const homeDir =
        readString(process.env.HOME) ||
        readString(process.env.USERPROFILE) ||
        os.homedir() ||
        process.cwd();
    if (value === "~") {
        return homeDir;
    }
    if (value.startsWith("~/") || value.startsWith("~\\")) {
        return path.join(homeDir, value.slice(2));
    }
    return value;
}

function resolveOpenclawHomeRoot() {
    const configuredHome = readString(process.env.OPENCLAW_HOME);
    if (configuredHome) {
        return path.resolve(expandHomePath(configuredHome));
    }
    return (
        readString(process.env.HOME) ||
        readString(process.env.USERPROFILE) ||
        os.homedir() ||
        process.cwd()
    );
}

export function fallbackOpenclawStateDir() {
    return path.join(resolveOpenclawHomeRoot(), ".openclaw");
}

export function resolveActiveOpenclawStateDir(options?: {
    api?: any;
    serviceStateDir?: string;
}) {
    const resolvedRuntimeStateDir =
        typeof options?.api?.runtime?.state?.resolveStateDir === "function"
            ? options.api.runtime.state.resolveStateDir()
            : undefined;
    const runtimeStateDir =
        typeof resolvedRuntimeStateDir === "string"
            ? readString(resolvedRuntimeStateDir)
            : undefined;
    return (
        readString(options?.serviceStateDir) ||
        runtimeStateDir ||
        readString(process.env.OPENCLAW_STATE_DIR) ||
        fallbackOpenclawStateDir()
    );
}

export function resolveOpenclawConfigPath(options?: {
    api?: any;
    serviceStateDir?: string;
}) {
    return (
        readString(process.env.OPENCLAW_CONFIG_PATH) ||
        path.join(resolveActiveOpenclawStateDir(options), "openclaw.json")
    );
}

export function resolvePluginStorageDir(options?: {
    api?: any;
    serviceStateDir?: string;
}) {
    return path.join(
        resolveActiveOpenclawStateDir(options),
        XIAOAI_CLOUD_PLUGIN_SUBDIR
    );
}

export function defaultPluginStorageDir(baseStorageDir?: string) {
    return readString(baseStorageDir) || resolvePluginStorageDir();
}
