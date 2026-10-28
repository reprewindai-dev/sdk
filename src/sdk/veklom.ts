/**
 * Veklom Governed Unified SDK (TypeScript)
 * Package: @veklom/sdk (0.2.0-unified)
 *
 * Integrates:
 * - Lane 3 Capability Execution Gateway
 * - Lane 1 Universal GraphQL Schema & API Indexer
 * - Revive Dev Virtual DB (Merkle-DAG state root)
 * - V-Chip Silicon Cryptographic Co-Processor & Laxham Continuum Invariants
 * - Autonomous Multi-Agent Verifiable Continuum
 */

export interface GovernanceReceipt {
  receiptId: string;
  connectionId: string;
  capability: string;
  payloadHash: string;
  signature: string;
  keyId: string;
  continuumTick?: number;
  laxhamProof?: any;
  issuedAt: string;
  cappoAuthority: string;
  governanceStatus: string;
}

export interface CompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  response_text: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: CompletionUsage;
  governanceReceipt: GovernanceReceipt;
  lane: number;
  latencyMs: number;
}

export interface ChatResponse {
  sessionId: string;
  model: string;
  message: string;
  turnCount: number;
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }>;
  usage: CompletionUsage;
  governanceReceipt: GovernanceReceipt;
}

export interface Lane3InvocationResult<T = any> {
  status: 'SUCCESS' | 'POLICY_VIOLATION' | 'THROTTLED';
  connectionId: string;
  capability: string;
  result: T;
  governanceReceipt: GovernanceReceipt;
  latencyMs: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  defaultMaxTokens: number;
  pricing: { promptPer1k: number; completionPer1k: number };
  capabilities: string[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  status: string;
  modelsCount: number;
  latencyTier: string;
}

export interface ClientConfig {
  baseUrl?: string;
  connectionId?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
}

export class VeklomClient {
  public readonly baseUrl: string;
  public readonly connectionId: string;
  private apiKey?: string;
  private fetchFn: typeof fetch;

  constructor(config: ClientConfig = {}) {
    this.baseUrl = config.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    this.connectionId = config.connectionId || 'conn_prod_veklom_default';
    this.apiKey = config.apiKey;
    this.fetchFn = config.fetchFn || (typeof window !== 'undefined' ? window.fetch.bind(window) : fetch);
  }

  public async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Veklom-Connection-Id': this.connectionId,
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Veklom API Error (${res.status}): ${errBody.error || res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Health Probe
   */
  async health(): Promise<any> {
    return this.request('/health');
  }

  /**
   * Catalog Reads: Available AI Models
   */
  async models(): Promise<{ models: ModelInfo[]; count: number }> {
    return this.request('/ai/models');
  }

  /**
   * Catalog Reads: Available Providers
   */
  async providers(): Promise<{ providers: ProviderInfo[]; count: number }> {
    return this.request('/ai/providers');
  }

  /**
   * Unified AI Completion
   */
  async complete(params: {
    model?: string;
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<CompletionResponse> {
    return this.request<CompletionResponse>('/ai/complete', {
      method: 'POST',
      body: JSON.stringify({
        model: params.model || 'gpt-4o-mini',
        prompt: params.prompt,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 512,
        connection_id: this.connectionId,
      }),
    });
  }

  /**
   * Unified AI Chat
   */
  async chat(params: {
    sessionId?: string;
    message: string;
    model?: string;
  }): Promise<ChatResponse> {
    return this.request<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        session_id: params.sessionId,
        message: params.message,
        model: params.model || 'gpt-4o-mini',
        connection_id: this.connectionId,
      }),
    });
  }

  /**
   * Cached Inference
   */
  async inference(params: { prompt: string; model?: string }): Promise<any> {
    return this.request('/ai/inference', {
      method: 'POST',
      body: JSON.stringify({
        prompt: params.prompt,
        model: params.model,
        connection_id: this.connectionId,
      }),
    });
  }

  /**
   * Lane 3: connection.external_api.invoke
   */
  async invokeCapability<T = any>(
    capability: string,
    payload: Record<string, any> = {},
    options: Record<string, any> = {}
  ): Promise<Lane3InvocationResult<T>> {
    return this.request<Lane3InvocationResult<T>>('/lane3/invoke', {
      method: 'POST',
      body: JSON.stringify({
        connectionId: this.connectionId,
        capability,
        payload,
        options,
      }),
    });
  }

  /**
   * Universal GraphQL Query & Mutation Executor
   */
  async queryGraphQL<T = any>(query: string, operationName?: string, variables?: Record<string, any>): Promise<any> {
    return this.request('/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query,
        operationName,
        variables,
      }),
    });
  }

  /**
   * Revive Dev Virtual DB Client
   */
  public virtualDb = {
    getCollections: async () => this.request<any>('/api/vdb/collections'),
    getRecords: async (collection: string) => this.request<any>(`/api/vdb/records/${collection}`),
    insert: async (collection: string, id: string, data: any) =>
      this.request<any>('/api/vdb/records', {
        method: 'POST',
        body: JSON.stringify({ collection, id, data }),
      }),
    createSnapshot: async () =>
      this.request<any>('/api/vdb/snapshot', {
        method: 'POST',
      }),
    restoreSnapshot: async (snapshotId: string) =>
      this.request<any>('/api/vdb/restore', {
        method: 'POST',
        body: JSON.stringify({ snapshotId }),
      }),
  };

  /**
   * V-Chip Silicon Cryptographic Co-Processor
   */
  public vchip = {
    getRegisters: async () => this.request<any>('/api/vchip/registers'),
    attest: async (payload: any, capability?: string) =>
      this.request<any>('/api/vchip/attest', {
        method: 'POST',
        body: JSON.stringify({ payload, capability: capability || 'ai.complete', connectionId: this.connectionId }),
      }),
    verify: async (token: any, payload: any) =>
      this.request<any>('/api/vchip/verify', {
        method: 'POST',
        body: JSON.stringify({ token, payload }),
      }),
  };

  /**
   * Autonomous Agent Continuum
   */
  public agentContinuum = {
    listSessions: async () => this.request<any>('/api/agent-continuum/sessions'),
    createSession: async (agentName?: string, goal?: string) =>
      this.request<any>('/api/agent-continuum/create', {
        method: 'POST',
        body: JSON.stringify({ agentName, goal }),
      }),
    step: async (sessionId: string, action: string, input?: any, capability?: string) =>
      this.request<any>('/api/agent-continuum/step', {
        method: 'POST',
        body: JSON.stringify({ sessionId, action, input, capability }),
      }),
    rollback: async (sessionId: string) =>
      this.request<any>('/api/agent-continuum/rollback', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }),
  };
}

/**
 * Backward-Compatibility Adapter for Legacy SDK code (0.1.0)
 */
export class LegacyVeklomAdapter {
  private client: VeklomClient;

  constructor(apiKey?: string, baseUrl?: string) {
    this.client = new VeklomClient({ apiKey, baseUrl });
  }

  async complete(promptOrPayload: string | { prompt?: string; model?: string }) {
    console.warn('[Veklom Deprecation Warning]: Legacy complete() signature is deprecated.');
    if (typeof promptOrPayload === 'string') {
      return this.client.complete({ prompt: promptOrPayload });
    }
    return this.client.complete(promptOrPayload);
  }

  async chat(sessionId: string, message: string) {
    console.warn('[Veklom Deprecation Warning]: Legacy chat() signature is deprecated.');
    return this.client.chat({ sessionId, message });
  }

  async getModels() {
    return this.client.models();
  }
}
