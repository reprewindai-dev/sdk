# Veklom SDK Inventory and Migration Map

Phase 0 deliverable for the Veklom Governed Unified SDK + GraphQL milestone.

Scope inspected:

- `veklom-byos-backend/sdk/typescript` (`@veklom/sdk` 0.1.0)
- `veklom-byos-backend/sdks/javascript` (`@veklom/sdk` 0.1.0 — duplicate package identity)
- `veklom-byos-backend/sdk/python` (`veklom` 1.1.0)
- `veklom-byos-backend/sdks/python` (`veklom` 0.1.0 — duplicate package identity)
- VNP SDK surfaces (`veklom-vnp` demo runtime SDK selection, `sdk/python/veklom/vnp_client.py`)
- `interlink-cAPI` mcpapi runtime layers (mirrored into `sdk/typescript/src/mcpapi-*.ts`)
- Frontend clients (`veklom-FRONTEND/lib/api.ts`, `veklom-control-plane`)

## 1. Existing SDK surfaces

### 1.1 `veklom-byos-backend/sdk/python` — `veklom` 1.1.0 (httpx)

| Method | Route | Behaviour | Status | New Connection SDK equivalent | Migration | Deprecation |
|---|---|---|---|---|---|---|
| `VeklomClient.complete()` | `POST /ai/complete` | One-shot completion, bearer token | Real (live route) | Lane 3 `connection.external_api.invoke` (capability `ai.complete`) | Compatibility adapter over `invokeCapability` | Deprecate after adapter ships |
| `VeklomClient.complete_stream()` | `POST /ai/inference` (SSE) | Streaming completion | Real | Lane 3 invoke + `connectionEvents` subscription | Adapter; streaming moves to event surface | Deprecate |
| `VeklomClient.chat()` | `POST /ai/chat` | Redis session chat | Real | Lane 3 invoke (capability `ai.chat`) | Adapter | Deprecate |
| `VeklomClient.inference()` | `POST /ai/inference` | Cached inference | Real | Lane 3 invoke | Adapter | Deprecate |
| `VeklomClient.models()` / `providers()` | `GET /ai/models`, `/ai/providers` | Catalog reads | Real | Lane 1 persisted query | Adapter | Deprecate |
| `VeklomClient.health()` | `GET /health` | Unauthenticated ping | Real | Keep as transport-level health probe | Keep | Keep |
| `client.vnp` (`VNPRouter`) | `GET /beacon/routes/resolve`, VNP ingest batch | Route discovery + usage telemetry | **Partially real, unsafe**: hardcoded `default-project` / `default-customer` / `default-policy`; telemetry signed with `"alg": "none"`, `key_id: "unsigned"`; emission errors swallowed (fire-and-forget) | Lane 1 `measurements(connectionId)` + server-side VNP measurement in Lane 3 receipts | **Remove**: unsigned telemetry and hardcoded identities are prohibited (Phase 9 removal list) | Remove |

### 1.2 `veklom-byos-backend/sdk/typescript` — `@veklom/sdk` 0.1.0

| Method | Route | Behaviour | Status | New equivalent | Migration | Deprecation |
|---|---|---|---|---|---|---|
| `VeklomClient.complete()` | `POST /ai/complete` | Parses OpenAI-style `choices`; default model `gpt-4o-mini` differs from Python default `llama3.2:latest` | Real but response-shape drift vs Python SDK | Lane 3 invoke | Adapter over generated client | Deprecate |
| `mcpapi-runtime.ts`, `mcpapi-enhanced-runtime.ts`, `mcpapi-governance-layer.ts`, `mcpapi-intelligence-layer.ts`, `mcpapi-safety-layer.ts`, `mcpapi-veklom-integration.ts` (~5,700 LOC) | in-process | Copied Interlink/MCPAPI runtime layers duplicated from `interlink-cAPI` | Duplicated client implementations (Phase 9 removal list) | Interlink semantics live server-side behind Lane 3 | Do not port; Lane 3 passes through Interlink cAPI on the server | Remove from SDK package |

### 1.3 `veklom-byos-backend/sdks/javascript` — duplicate `@veklom/sdk` 0.1.0

Single method `complete()` posting to `https://api.veklom.com/api/v1/ai/complete`, parsing `response_text`. Conflicts with `sdk/typescript` (same npm name, different base URL default and response parsing). **Consolidate into one package identity in this repo; both legacy copies become adapters.**

### 1.4 `veklom-byos-backend/sdks/python` — duplicate `veklom` 0.1.0 (requests)

Single `complete()` returning a Pydantic `Response`. Same PyPI name as `sdk/python` 1.1.0. Inconsistent base URLs (`https://api.veklom.com/api/v1` vs `https://veklom.com/api/v1`) — Phase 9 removal list item. Consolidate.

### 1.5 VNP SDK templates (`veklom-vnp`)

Demo runtime contains SDK snippet selection (JS/Python templates) — demo-only, gated behind `VNP_ALLOW_DEMO_DATA`. No production SDK exists in `veklom-vnp`. New SDK exposes VNP truth via Lane 1 `measurements(connectionId)` query only.

### 1.6 Frontend manual clients

- `veklom-FRONTEND/lib/api.ts`: same-origin fetch wrapper; pages call REST routes (connection, VNP, benchmarks, x402, CAPPO status) directly. Frontend migration to the generated TS SDK is a later milestone; not blocked by V1.
- `veklom-control-plane`: independent Next.js client with its own fetch wrappers; same treatment.

## 2. Known defects to eliminate (Phase 9 removal list, confirmed present)

1. Unsigned telemetry: `vnp_client.py` emits `{"alg": "none", "key_id": "unsigned"}` signatures.
2. Hardcoded default project/customer/policy identities in both sync and async VNP routers.
3. Swallowed evidence errors: telemetry emission is fire-and-forget with bare `except`.
4. Duplicated client implementations: two `@veklom/sdk` packages, two `veklom` packages.
5. Inconsistent Veklom base URLs across the four packages.
6. Direct provider execution without Connection/CAPPO authority: all `ai.*` calls bypass connection contracts entirely (bearer token only).
7. Response-shape drift between TS (`choices[0].message.content`) and JS (`response_text`) and Python parsers.

## 3. Target mapping summary

| Legacy surface | Fate |
|---|---|
| `complete()` / `chat()` / `inference()` | Compatibility adapters over `invokeCapability` (Lane 3) |
| `models()` / `providers()` | Lane 1 persisted queries |
| `vnp.dispatch()` / VNPRouter | Removed; measurement is server-owned; reads via `measurements` query |
| mcpapi-* layers in SDK | Removed from SDK; Interlink stays server-side |
| Duplicate packages | Single `@veklom/sdk` (TS) and `veklom` (Python) published from this repository |

Old SDK directories are not deleted in this phase; they are frozen and adapted in Phase 9.
