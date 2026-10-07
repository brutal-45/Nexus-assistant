# Nexus Model Lineup & Publishing

This directory holds model files to be published as **GitHub Release assets**
by the `Model Release` workflow (`.github/workflows/model-release.yml`).

## The Nexus Lineup (in-app catalog)

The Nexus app ships a device-tier-aware catalog. Models are automatically
recommended per RAM tier; the version names below are what users see:

| Nexus name (in-app) | Underlying model | Quant | Size | Recommended for |
|---|---|---|---|---|
| Nexus 1.0 Nano | LFM2.5 350M | Q4_K_M | ~230 MB | 3-4 GB RAM |
| Nexus 1.0 | Qwen3 0.6B | Q4_K_M | ~480 MB | 4 GB RAM |
| Nexus 1.1 | Gemma 3 1B | Q4_K_M | ~800 MB | 4-6 GB RAM |
| Nexus 1.2 | LFM2.5 1.2B | Q4_K_M | ~730 MB | 4-6 GB RAM |
| Nexus 1.2 Vision | LFM2-VL 1.6B | Q4_0 | ~700 MB | 6 GB RAM (image input) |
| Nexus 1.3 | Qwen3 1.7B | Q4_K_M | ~1.3 GB | 6 GB RAM |
| Nexus 1.4 | Qwen3.5 2B | Q4_K_M | ~1.4 GB | 6-8 GB RAM |
| Nexus 1.5 | LFM2 2.6B | Q4_K_M | ~1.6 GB | 8 GB RAM |
| Nexus 1.6 | SmolLM3 3B | Q4_K_M | ~1.8 GB | 8 GB RAM |
| Nexus 1.7 | Ministral 3 3B | Q4 | ~2.0 GB | 8 GB RAM |
| Nexus 1.8 | Phi-4 Mini | Q4_0 | ~2.3 GB | 8 GB RAM |
| Nexus 1.9 | Qwen3.5 4B | Q4_K_M | ~2.7 GB | 8-12 GB RAM |
| Nexus 2.0 | Gemma 3 4B | Q4 | ~2.4-3 GB | 8-12 GB RAM |
| Nexus 2.1 | Gemma 4 E2B | Q4 | ~3 GB | 12 GB RAM |
| Nexus 2.5 | Gemma 4 E4B | Q4 | ~4.8 GB | 12 GB+ RAM |
| Nexus 3.0 | LFM2.5 8B-A1B (MoE) | Q4 | ~4.8 GB | 12 GB+ RAM |
| Nexus 3.1 | Mistral 7B Instruct v0.3 | Q4_K_M | ~4.37 GB | 8-12 GB+ RAM (fast instruction following & tasks) |
| Nexus 3.2 Pro | Qwen2.5 7B Instruct | Q4_K_M | ~4.68 GB | 8-12 GB+ RAM (universal problem solver: math, code, reasoning) |
| Nexus 3.3 Max | Meta Llama 3.1 8B Instruct | Q4_K_M | ~4.92 GB | 12 GB+ RAM (broad world knowledge & versatile chat) |
| Nexus 3.4 Coder | Qwen2.5 Coder 7B Instruct | Q4_K_M | ~4.68 GB | 12 GB+ RAM (expert offline coding, refactoring & debug) |
| Nexus 3.5 Reasoner | DeepSeek R1 Distill Qwen 7B | Q4_K_M | ~4.68 GB | 8-12 GB+ RAM (deep chain-of-thought math & logic solver) |

Naming/versioning lives in `src/store/bundledDeviceRules/rules.<platform>.json`
(`display_name` per candidate). Underlying weights are Apache-2.0 / Gemma-terms
open models so the catalog works out of the box; swap any `hf_repo`/`hf_filename`
to serve your own weights.

## Publishing a model version to GitHub Releases

1. Add quantized files here, named like the app expects:
   ```
   models/nexus-1.1-q4_k_m.gguf
   models/nexus-2.0-q4_0.gguf
   ```
2. Go to **Actions -> Model Release -> Run workflow**, enter version
   `models-v1.0` (and optional title / pre-release flag).
3. The workflow validates sizes (max 2 GiB per asset) and publishes:
   ```
   https://github.com/<your-org>/<your-repo>/releases/download/models-v1.0/nexus-1.1-q4_k_m.gguf
   ```
4. Share the URL - or let users add it through the app's model-add flow.

> **Note:** files committed to `models/` should use Git LFS (`git lfs track
> "*.gguf"`) since they exceed GitHub's normal file limits.

## Building your own GGUF from a fine-tune

```bash
git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp
pip install -r requirements.txt
python convert_hf_to_gguf.py /path/to/your-tune --outfile nexus-custom-f16.gguf
./llama-quantize nexus-custom-f16.gguf nexus-1.2-q4_k_m.gguf Q4_K_M
```
