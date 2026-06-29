import { Keypair } from "@stellar/stellar-sdk";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const WALLET_DIR = join(homedir(), ".iln", "wallets");
const WALLET_INDEX_FILE = join(WALLET_DIR, "index.json");

export interface WalletInfo {
  name: string;
  publicKey: string;
  createdAt: string;
}

export interface WalletIndex {
  wallets: WalletInfo[];
}

function ensureWalletDir(): void {
  if (!existsSync(WALLET_DIR)) {
    mkdirSync(WALLET_DIR, { recursive: true });
  }
}

function loadWalletIndex(): WalletIndex {
  ensureWalletDir();
  if (!existsSync(WALLET_INDEX_FILE)) {
    return { wallets: [] };
  }
  const content = readFileSync(WALLET_INDEX_FILE, "utf8");
  return JSON.parse(content) as WalletIndex;
}

function saveWalletIndex(index: WalletIndex): void {
  ensureWalletDir();
  writeFileSync(WALLET_INDEX_FILE, JSON.stringify(index, null, 2));
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return createHash("sha256")
    .update(Buffer.concat([salt, Buffer.from(password)]))
    .digest();
}

function encryptData(data: string, password: string): string {
  const salt = randomBytes(16);
  const key = deriveKey(password, salt);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  return `${salt.toString("hex")}:${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptData(encryptedData: string, password: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  const salt = Buffer.from(parts[0], "hex");
  const iv = Buffer.from(parts[1], "hex");
  const encrypted = Buffer.from(parts[2], "hex");
  const key = deriveKey(password, salt);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function createWallet(name: string, password: string): WalletInfo {
  const index = loadWalletIndex();

  if (index.wallets.some((w) => w.name === name)) {
    throw new Error(`Wallet '${name}' already exists.`);
  }

  const keypair = Keypair.random();
  const walletData = {
    secretKey: keypair.secret(),
    publicKey: keypair.publicKey(),
    createdAt: new Date().toISOString(),
  };

  const encryptedData = encryptData(JSON.stringify(walletData), password);
  const walletFile = join(WALLET_DIR, `${name}.enc`);
  writeFileSync(walletFile, encryptedData);

  const walletInfo: WalletInfo = {
    name,
    publicKey: keypair.publicKey(),
    createdAt: walletData.createdAt,
  };

  index.wallets.push(walletInfo);
  saveWalletIndex(index);

  return walletInfo;
}

export function importWallet(name: string, secretKey: string, password: string): WalletInfo {
  const index = loadWalletIndex();

  if (index.wallets.some((w) => w.name === name)) {
    throw new Error(`Wallet '${name}' already exists.`);
  }

  if (!secretKey.startsWith("S")) {
    throw new Error("Invalid Stellar secret key. Must start with 'S'.");
  }

  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(secretKey);
  } catch {
    throw new Error("Invalid Stellar secret key format.");
  }

  const walletData = {
    secretKey: keypair.secret(),
    publicKey: keypair.publicKey(),
    createdAt: new Date().toISOString(),
  };

  const encryptedData = encryptData(JSON.stringify(walletData), password);
  const walletFile = join(WALLET_DIR, `${name}.enc`);
  writeFileSync(walletFile, encryptedData);

  const walletInfo: WalletInfo = {
    name,
    publicKey: keypair.publicKey(),
    createdAt: walletData.createdAt,
  };

  index.wallets.push(walletInfo);
  saveWalletIndex(index);

  return walletInfo;
}

export function listWallets(): WalletInfo[] {
  const index = loadWalletIndex();
  return index.wallets;
}

export function getWalletSecret(name: string, password: string): string {
  const walletFile = join(WALLET_DIR, `${name}.enc`);
  if (!existsSync(walletFile)) {
    throw new Error(`Wallet '${name}' not found.`);
  }

  const encryptedData = readFileSync(walletFile, "utf8");
  const walletData = JSON.parse(decryptData(encryptedData, password));
  return walletData.secretKey;
}

export function getWalletKeypair(name: string, password: string): Keypair {
  const secretKey = getWalletSecret(name, password);
  return Keypair.fromSecret(secretKey);
}

export function deleteWallet(name: string): void {
  const index = loadWalletIndex();
  const walletIndex = index.wallets.findIndex((w) => w.name === name);

  if (walletIndex === -1) {
    throw new Error(`Wallet '${name}' not found.`);
  }

  const walletFile = join(WALLET_DIR, `${name}.enc`);
  if (existsSync(walletFile)) {
    const { unlinkSync } = require("node:fs");
    unlinkSync(walletFile);
  }

  index.wallets.splice(walletIndex, 1);
  saveWalletIndex(index);
}

export async function fundWalletFromFriendbot(
  publicKey: string,
  friendbotUrl: string = "https://friendbot.stellar.org"
): Promise<void> {
  const response = await fetch(`${friendbotUrl}?addr=${publicKey}`);
  if (!response.ok) {
    throw new Error(`Failed to fund account: ${response.statusText}`);
  }
}

export { WALLET_DIR };
