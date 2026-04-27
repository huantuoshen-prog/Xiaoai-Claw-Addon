#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const DEFAULT_PACKAGE_NAME = "openclaw-plugin-xiaoai-cloud";
const DEFAULT_DISPLAY_NAME = "XiaoAI Cloud Plugin";
const DEFAULT_SOURCE_REPO = "ZhengXieGang/Xiaoai-Claw-Addon";

function run(command, args, options = {}) {
    return spawnSync(command, args, {
        encoding: "utf8",
        stdio: options.stdio || ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
    });
}

function readGit(args) {
    const result = run("git", args);
    if (result.error || (result.status ?? 1) !== 0) {
        return "";
    }
    return String(result.stdout || "").trim();
}

function hasOption(args, optionName) {
    return args.some((arg) => arg === optionName || arg.startsWith(`${optionName}=`));
}

function consumePackagePath(argv) {
    const [first, ...rest] = argv;
    if (!first || first.startsWith("-")) {
        return { packagePath: ".", extraArgs: argv };
    }
    return { packagePath: first, extraArgs: rest };
}

function fail(message) {
    console.error(message);
    process.exit(1);
}

const { packagePath, extraArgs } = consumePackagePath(process.argv.slice(2));
const isHelp = extraArgs.includes("--help") || extraArgs.includes("-h");
const sourceRepo = process.env.CLAWHUB_SOURCE_REPO || DEFAULT_SOURCE_REPO;
const sourceCommit =
    process.env.CLAWHUB_SOURCE_COMMIT ||
    process.env.GITHUB_SHA ||
    readGit(["rev-parse", "HEAD"]);
const sourceRef =
    process.env.CLAWHUB_SOURCE_REF ||
    process.env.GITHUB_REF_NAME ||
    readGit(["rev-parse", "--abbrev-ref", "HEAD"]);

if (!isHelp && !hasOption(extraArgs, "--source-commit") && !sourceCommit) {
    fail(
        "Missing ClawHub source commit. Run from a git checkout, or set CLAWHUB_SOURCE_COMMIT."
    );
}

const args = [
    "--yes",
    "clawhub",
    "package",
    "publish",
    packagePath,
];

function addDefault(optionName, value) {
    if (value && !hasOption(extraArgs, optionName)) {
        args.push(optionName, value);
    }
}

addDefault("--family", "code-plugin");
addDefault("--name", DEFAULT_PACKAGE_NAME);
addDefault("--display-name", DEFAULT_DISPLAY_NAME);
addDefault("--source-repo", sourceRepo);
addDefault("--source-commit", sourceCommit);
addDefault("--source-ref", sourceRef);

args.push(...extraArgs);

const result = run("npx", args, { stdio: "inherit" });
if (result.error) {
    fail(result.error.message);
}
process.exit(result.status ?? 1);
