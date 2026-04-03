import { spawn } from "child_process";

function normalizeLines(text: string) {
    return text
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => line !== "No reply from agent.");
}

function summarizeJsonOutput(stdout: string) {
    const parsed = JSON.parse(stdout);
    const payloads = parsed?.result?.payloads;
    if (Array.isArray(payloads)) {
        const text = payloads
            .map((payload) => (typeof payload?.text === "string" ? payload.text.trim() : ""))
            .filter(Boolean)
            .join(" / ");
        if (text) {
            return text;
        }
    }

    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
    return summary || "completed";
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        process.stderr.write("Missing OpenClaw CLI arguments.\n");
        process.exit(1);
        return;
    }

    const child = spawn(args[0], args.slice(1), {
        stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
        stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
        stderr += chunk;
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code) => resolve(code ?? 1));
    });

    const cleanedStderr = normalizeLines(stderr);
    if (exitCode !== 0) {
        const errorOutput =
            cleanedStderr.join("\n") ||
            normalizeLines(stdout).join("\n") ||
            `OpenClaw CLI exited with code ${exitCode}`;
        process.stderr.write(`${errorOutput}\n`);
        process.exit(exitCode);
        return;
    }

    if (cleanedStderr.length > 0) {
        process.stderr.write(`${cleanedStderr.join("\n")}\n`);
    }

    const trimmedStdout = stdout.trim();
    if (!trimmedStdout) {
        process.stdout.write("completed\n");
        return;
    }

    try {
        process.stdout.write(`${summarizeJsonOutput(trimmedStdout)}\n`);
        return;
    } catch {
        const cleanedStdout = normalizeLines(trimmedStdout);
        process.stdout.write(`${cleanedStdout.join("\n") || "completed"}\n`);
    }
}

void main();
