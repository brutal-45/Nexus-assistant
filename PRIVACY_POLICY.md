# Nexus Privacy Policy

_Last updated: 2026-09-17_

Nexus is a private AI assistant that runs entirely on your device. This policy describes, in plain terms, what the app does and does not do with your data.

## The short version

- **Your conversations never leave your phone.** All AI inference happens locally, on your device's CPU/GPU/NPU. There is no Nexus server, no account, and no cloud round-trip for chats.
- **We do not collect, store, or sell personal data.** There is no analytics SDK and no advertising SDK in the app.
- **You are in control of every optional network feature.** Anything below that touches the network is off until you explicitly turn it on, and each one is explained before first use.

## What is processed on-device

- Chat messages, prompts, and model responses — processed by the language model running locally on your device.
- Images and videos you select for analysis — processed locally by on-device models; never uploaded.
- Microphone input for voice features — processed on-device by the speech engine you selected.

## Optional features that use the network

These are only active after you enable or use them:

| Feature | What is sent | To whom |
|---|---|---|
| Model downloads | Model search/download requests (including a `Nexus/<version>` user agent) | Hugging Face |
| Remote servers you add | Prompts and parameters for the servers *you* configure (e.g. Ollama, LM Studio) | Only the endpoints you enter |
| Web search for Pals | Search queries, using the API key *you* provide | The search provider you choose |
| Optional error reports | The details you review and approve in the crash-report sheet; any item can be deselected | The project's error-report endpoint |
| Optional benchmark sharing | Benchmark numbers, only with your explicit consent | Hugging Face Spaces via Firebase App Check |
| PalsHub (if enabled) | Account/checkout interactions for the Pals marketplace | palshub.ai |

## Permissions

- **Camera / photo library** — used only to pick media for local AI analysis.
- **Microphone** — used only for on-device voice input.
- **Notifications** — only if you enable them (e.g. download progress).

Nexus never requests your location.

## Children's privacy

Nexus does not collect data from anyone, including children.

## Changes

If this policy changes, the updated version ships with the app and is dated above.

## Contact

Questions? Open an issue on the [Nexus repository](https://github.com/brutal-45/Nexus-assistant).
