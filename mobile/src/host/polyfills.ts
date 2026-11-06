// What the engine needs from the runtime that Hermes, React Native and Expo don't give: the
// system's secure random numbers as the web's `crypto.getRandomValues` (the engine's
// src/engine/platform/random.native.ts asks for it). Imported first, before anything loads the engine.
import { getRandomValues } from "expo-crypto";

const global = globalThis as { crypto?: { getRandomValues?: unknown } };
global.crypto ??= {};
global.crypto.getRandomValues ??= getRandomValues;
