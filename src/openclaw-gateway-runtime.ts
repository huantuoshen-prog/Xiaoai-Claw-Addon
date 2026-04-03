import path from "path";
import { access, readFile, realpath } from "fs/promises";
import { pathToFileURL } from "url";

type GatewayClientOptions = {
    url?: string;
    token?: string;
    password?: string;
    clientName?: string;
    clientDisplayName?: string;
    clientVersion?: string;
    platform?: string;
    deviceFamily?: string;
    mode?: string;
    role?: string;
    scopes?: string[];
    requestTimeoutMs?: number;
    onHelloOk?: (hello: unknown) => void;
    onConnectError?: (error: Error) => void;
    onClose?: (code: number, reason: string) => void;
};

export interface GatewayClientLike {
    start(): void;
    stopAndWait(opts?: { timeoutMs?: number }): Promise<void>;
    request<T = Record<string, unknown>>(
        method: string,
        params?: unknown,
        opts?: { expectFinal?: boolean; timeoutMs?: number | null }
    ): Promise<T>;
}

export type GatewayClientCtor = new (options: GatewayClientOptions) => GatewayClientLike;

function readString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

async function pathExists(targetPath: string) {
    try {
        await access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function isOpenclawPackageRoot(targetDir: string) {
    const packageJsonPath = path.join(targetDir, "package.json");
    const gatewayRuntimePath = path.join(
        targetDir,
        "dist",
        "plugin-sdk",
        "gateway-runtime.js"
    );
    if (!(await pathExists(packageJsonPath)) || !(await pathExists(gatewayRuntimePath))) {
        return false;
    }
    try {
        const parsed = JSON.parse(await readFile(packageJsonPath, "utf8"));
        return readString(parsed?.name) === "openclaw";
    } catch {
        return false;
    }
}

async function findPackageRootFromEntry(entryPath: string) {
    let current = path.dirname(await realpath(entryPath).catch(() => entryPath));
    while (true) {
        if (await isOpenclawPackageRoot(current)) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return undefined;
        }
        current = parent;
    }
}

async function findExecutableInPath(executableName: string) {
    const pathEntries = readString(process.env.PATH)?.split(path.delimiter) || [];
    const extensions =
        process.platform === "win32"
            ? (readString(process.env.PATHEXT)?.split(";") || [".EXE", ".CMD", ".BAT", ".COM"])
            : [""];

    for (const entry of pathEntries) {
        const baseDir = readString(entry);
        if (!baseDir) {
            continue;
        }
        for (const extension of extensions) {
            const candidate = path.join(baseDir, `${executableName}${extension}`);
            if (await pathExists(candidate)) {
                return candidate;
            }
        }
    }
    return undefined;
}

async function resolveInstalledOpenclawPackageRoot(options?: { openclawCliPath?: string }) {
    const directRootCandidates = [
        readString(process.env.OPENCLAW_PACKAGE_ROOT),
        "/usr/lib/node_modules/openclaw",
        "/usr/local/lib/node_modules/openclaw",
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of directRootCandidates) {
        if (await isOpenclawPackageRoot(candidate)) {
            return candidate;
        }
    }

    const entryCandidates = new Set<string>();
    const runtimeArgv = readString(process.argv?.[1]);
    if (runtimeArgv) {
        entryCandidates.add(runtimeArgv);
    }

    const cliPath = readString(options?.openclawCliPath);
    if (cliPath) {
        if (path.isAbsolute(cliPath)) {
            entryCandidates.add(cliPath);
        } else {
            const resolvedCliPath = await findExecutableInPath(cliPath);
            if (resolvedCliPath) {
                entryCandidates.add(resolvedCliPath);
            }
        }
    }

    for (const entryPath of entryCandidates) {
        const packageRoot = await findPackageRootFromEntry(entryPath);
        if (packageRoot) {
            return packageRoot;
        }
    }

    throw new Error("无法定位 OpenClaw 安装目录，暂时不能直连 Gateway SDK。");
}

let cachedGatewayClientCtorPromise: Promise<GatewayClientCtor> | undefined;

export async function loadGatewayClientCtor(options?: { openclawCliPath?: string }) {
    if (!cachedGatewayClientCtorPromise) {
        cachedGatewayClientCtorPromise = (async () => {
            const packageRoot = await resolveInstalledOpenclawPackageRoot(options);
            const gatewayRuntimePath = path.join(
                packageRoot,
                "dist",
                "plugin-sdk",
                "gateway-runtime.js"
            );
            const moduleUrl = pathToFileURL(gatewayRuntimePath).href;
            const loaded = (await import(moduleUrl)) as {
                GatewayClient?: GatewayClientCtor;
            };
            if (typeof loaded.GatewayClient !== "function") {
                throw new Error("OpenClaw 官方 GatewayClient 未导出。");
            }
            return loaded.GatewayClient;
        })().catch((error) => {
            cachedGatewayClientCtorPromise = undefined;
            throw error;
        });
    }
    return cachedGatewayClientCtorPromise;
}
