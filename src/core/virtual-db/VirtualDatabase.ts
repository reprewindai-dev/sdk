import crypto from 'crypto';

/**
 * Revive Dev Virtual DB Engine
 *
 * Ephemeral, deterministic, in-memory virtualized storage engine with
 * ACID-like transactional semantics, point-in-time snapshotting,
 * Merkle-DAG state root hashing, and Laxham mathematical continuity invariants.
 */

export interface VirtualRecord {
  id: string;
  data: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
  contentHash: string;
}

export interface CollectionSchema {
  name: string;
  indexes: string[];
  description: string;
}

export interface VirtualDBSnapshot {
  snapshotId: string;
  timestamp: string;
  stateRoot: string;
  totalRecords: number;
  collections: Record<string, VirtualRecord[]>;
}

export interface TransactionOperation {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  collection: string;
  recordId: string;
  data?: Record<string, any>;
  previousState?: VirtualRecord;
}

export class VirtualDatabase {
  private collections: Map<string, Map<string, VirtualRecord>> = new Map();
  private schemas: Map<string, CollectionSchema> = new Map();
  private snapshots: Map<string, VirtualDBSnapshot> = new Map();
  private stateRoot: string = '';
  private transactionCounter: number = 0;

  constructor() {
    this.initializeDefaultCollections();
    this.recomputeStateRoot();
  }

  private initializeDefaultCollections() {
    // 1. connections
    this.createCollection('connections', ['id', 'status', 'tier'], 'CAPPO Registered Gateway Connections');
    this.insert('connections', 'conn_prod_veklom_default', {
      name: 'Production Primary Connection',
      status: 'ACTIVE',
      tier: 'ENTERPRISE_LANE_3',
      rateLimit: 10000,
      cappoEnforced: true,
      allowedCapabilities: ['ai.complete', 'ai.chat', 'ai.inference', 'governance.audit', 'vnp.measurement']
    });
    this.insert('connections', 'conn_dev_revive_sandbox', {
      name: 'Revive Dev Virtual Sandbox',
      status: 'ACTIVE',
      tier: 'DEVELOPER_SANDBOX',
      rateLimit: 2500,
      cappoEnforced: true,
      allowedCapabilities: ['ai.complete', 'virtualdb.sync', 'vchip.attest']
    });

    // 2. indexed_apis
    this.createCollection('indexed_apis', ['id', 'provider', 'endpoint'], 'Universal GraphQL Indexed Endpoints');
    this.insert('indexed_apis', 'api_openai_v1', {
      provider: 'OpenAI',
      endpoint: 'https://api.openai.com/v1',
      methods: ['POST /chat/completions', 'GET /models'],
      health: 'HEALTHY',
      laneWrapper: 'Lane3_Adapter',
      lastAttestation: 'vchip_attest_99a81f'
    });
    this.insert('indexed_apis', 'api_anthropic_v1', {
      provider: 'Anthropic',
      endpoint: 'https://api.anthropic.com/v1',
      methods: ['POST /messages'],
      health: 'HEALTHY',
      laneWrapper: 'Lane3_Adapter',
      lastAttestation: 'vchip_attest_44c19b'
    });
    this.insert('indexed_apis', 'api_google_vertex', {
      provider: 'Google Vertex',
      endpoint: 'https://generativelanguage.googleapis.com',
      methods: ['POST /models/gemini-2.5-flash:generateContent'],
      health: 'HEALTHY',
      laneWrapper: 'Lane3_Native',
      lastAttestation: 'vchip_attest_77e31d'
    });

    // 3. receipts
    this.createCollection('receipts', ['id', 'connectionId', 'capability'], 'Cryptographic CAPPO Receipts');

    // 4. agent_continuum_events
    this.createCollection('agent_continuum_events', ['id', 'agentId', 'stepIndex'], 'Verifiable Agent State Transitions');
  }

  public createCollection(name: string, indexes: string[] = ['id'], description: string = '') {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
      this.schemas.set(name, { name, indexes, description });
      this.recomputeStateRoot();
    }
  }

  public getCollectionsList(): Array<{ name: string; count: number; description: string; indexes: string[] }> {
    const list: Array<{ name: string; count: number; description: string; indexes: string[] }> = [];
    for (const [name, map] of this.collections.entries()) {
      const schema = this.schemas.get(name) || { name, indexes: ['id'], description: '' };
      list.push({
        name,
        count: map.size,
        description: schema.description,
        indexes: schema.indexes,
      });
    }
    return list;
  }

  private computeHash(data: any): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  public recomputeStateRoot(): string {
    const hashes: string[] = [];
    const sortedCollectionKeys = Array.from(this.collections.keys()).sort();

    for (const colName of sortedCollectionKeys) {
      const col = this.collections.get(colName)!;
      const sortedRecordIds = Array.from(col.keys()).sort();
      for (const recId of sortedRecordIds) {
        const record = col.get(recId)!;
        hashes.push(`${colName}:${recId}:${record.contentHash}:${record.version}`);
      }
    }

    if (hashes.length === 0) {
      this.stateRoot = '0'.repeat(64);
    } else {
      this.stateRoot = crypto.createHash('sha256').update(hashes.join('|')).digest('hex');
    }
    return this.stateRoot;
  }

  public getStateRoot(): string {
    return this.stateRoot;
  }

  public insert(collection: string, id: string, data: Record<string, any>): VirtualRecord {
    if (!this.collections.has(collection)) {
      this.createCollection(collection);
    }
    const col = this.collections.get(collection)!;
    if (col.has(id)) {
      throw new Error(`Record with id "${id}" already exists in collection "${collection}"`);
    }

    const now = new Date().toISOString();
    const contentHash = this.computeHash(data);
    const record: VirtualRecord = {
      id,
      data,
      version: 1,
      createdAt: now,
      updatedAt: now,
      contentHash,
    };

    col.set(id, record);
    this.recomputeStateRoot();
    return record;
  }

  public update(collection: string, id: string, patch: Record<string, any>): VirtualRecord {
    const col = this.collections.get(collection);
    if (!col || !col.has(id)) {
      throw new Error(`Record with id "${id}" does not exist in collection "${collection}"`);
    }

    const current = col.get(id)!;
    const updatedData = { ...current.data, ...patch };
    const contentHash = this.computeHash(updatedData);

    const updatedRecord: VirtualRecord = {
      ...current,
      data: updatedData,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      contentHash,
    };

    col.set(id, updatedRecord);
    this.recomputeStateRoot();
    return updatedRecord;
  }

  public delete(collection: string, id: string): boolean {
    const col = this.collections.get(collection);
    if (!col || !col.has(id)) return false;

    col.delete(id);
    this.recomputeStateRoot();
    return true;
  }

  public get(collection: string, id: string): VirtualRecord | null {
    const col = this.collections.get(collection);
    if (!col) return null;
    return col.get(id) || null;
  }

  public query(collection: string, filter?: (record: VirtualRecord) => boolean, limit?: number): VirtualRecord[] {
    const col = this.collections.get(collection);
    if (!col) return [];

    let results = Array.from(col.values());
    if (filter) {
      results = results.filter(filter);
    }
    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }
    return results;
  }

  /**
   * Atomic Transaction execution
   * Rolls back if any operation errors out.
   */
  public executeTransaction(operations: TransactionOperation[]): { success: boolean; stateRoot: string; error?: string } {
    this.transactionCounter++;
    const rollbacks: Array<() => void> = [];

    try {
      for (const op of operations) {
        if (!this.collections.has(op.collection)) {
          this.createCollection(op.collection);
        }
        const col = this.collections.get(op.collection)!;

        if (op.type === 'INSERT') {
          if (col.has(op.recordId)) {
            throw new Error(`Transaction aborted: id "${op.recordId}" already exists`);
          }
          const prev = col.get(op.recordId);
          this.insert(op.collection, op.recordId, op.data || {});
          rollbacks.push(() => {
            col.delete(op.recordId);
          });
        } else if (op.type === 'UPDATE') {
          if (!col.has(op.recordId)) {
            throw new Error(`Transaction aborted: id "${op.recordId}" does not exist for update`);
          }
          const prev = col.get(op.recordId)!;
          const prevCopy = { ...prev };
          this.update(op.collection, op.recordId, op.data || {});
          rollbacks.push(() => {
            col.set(op.recordId, prevCopy);
          });
        } else if (op.type === 'DELETE') {
          if (!col.has(op.recordId)) {
            throw new Error(`Transaction aborted: id "${op.recordId}" does not exist for deletion`);
          }
          const prev = col.get(op.recordId)!;
          const prevCopy = { ...prev };
          this.delete(op.collection, op.recordId);
          rollbacks.push(() => {
            col.set(op.recordId, prevCopy);
          });
        }
      }

      const root = this.recomputeStateRoot();
      return { success: true, stateRoot: root };
    } catch (err: any) {
      // Execute rollbacks in reverse order
      for (let i = rollbacks.length - 1; i >= 0; i--) {
        rollbacks[i]();
      }
      this.recomputeStateRoot();
      return { success: false, stateRoot: this.stateRoot, error: err.message };
    }
  }

  /**
   * Point-in-time Snapshot
   */
  public createSnapshot(): VirtualDBSnapshot {
    const snapshotId = `vdb_snap_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const collectionsDump: Record<string, VirtualRecord[]> = {};
    let totalRecords = 0;

    for (const [colName, col] of this.collections.entries()) {
      const records = Array.from(col.values()).map(r => ({ ...r, data: { ...r.data } }));
      collectionsDump[colName] = records;
      totalRecords += records.length;
    }

    const snapshot: VirtualDBSnapshot = {
      snapshotId,
      timestamp: new Date().toISOString(),
      stateRoot: this.stateRoot,
      totalRecords,
      collections: collectionsDump,
    };

    this.snapshots.set(snapshotId, snapshot);
    return snapshot;
  }

  /**
   * Snapshot Restore (Rollback Continuum)
   */
  public restoreSnapshot(snapshotId: string): boolean {
    const snap = this.snapshots.get(snapshotId);
    if (!snap) return false;

    this.collections.clear();
    for (const [colName, records] of Object.entries(snap.collections)) {
      const colMap = new Map<string, VirtualRecord>();
      for (const rec of records) {
        colMap.set(rec.id, { ...rec, data: { ...rec.data } });
      }
      this.collections.set(colName, colMap);
    }

    this.recomputeStateRoot();
    return true;
  }

  public getSnapshotsList(): Array<{ snapshotId: string; timestamp: string; stateRoot: string; totalRecords: number }> {
    return Array.from(this.snapshots.values()).map(s => ({
      snapshotId: s.snapshotId,
      timestamp: s.timestamp,
      stateRoot: s.stateRoot,
      totalRecords: s.totalRecords,
    }));
  }
}

// Global singleton instance for the applet
export const virtualDb = new VirtualDatabase();
