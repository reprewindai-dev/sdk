import { VChipEngine } from '../src/core/vchip/VChipEngine';

export function runVChipCryptographyTests(): { suite: string; passed: number; failed: number; tests: Array<{ name: string; status: 'PASS' | 'FAIL'; latencyMs: number; details?: string }> } {
  const tests: Array<{ name: string; status: 'PASS' | 'FAIL'; latencyMs: number; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  // TEST 1: Monotonicity of Continuum Clock
  {
    const start = performance.now();
    try {
      const vchip = new VChipEngine();
      let prevClock = vchip.getRegisters().CR1_CONTINUUM_CLOCK;
      let monotonic = true;

      for (let i = 0; i < 20; i++) {
        const nextClock = vchip.tickCycle(2);
        if (nextClock <= prevClock) {
          monotonic = false;
          break;
        }
        prevClock = nextClock;
      }

      if (monotonic) {
        passed++;
        tests.push({ name: 'Continuum Clock Strict Monotonicity (dC/dt > 0)', status: 'PASS', latencyMs: performance.now() - start });
      } else {
        failed++;
        tests.push({ name: 'Continuum Clock Strict Monotonicity', status: 'FAIL', latencyMs: performance.now() - start, details: 'Clock tick regression detected' });
      }
    } catch (e: any) {
      failed++;
      tests.push({ name: 'Continuum Clock Strict Monotonicity', status: 'FAIL', latencyMs: performance.now() - start, details: e.message });
    }
  }

  // TEST 2: Cryptographic Tamper Detection & Non-Repudiation
  {
    const start = performance.now();
    try {
      const vchip = new VChipEngine();
      const payloadOriginal = { amount: 500, recipient: '0xabc123' };
      const attestation = vchip.attest(payloadOriginal, 'conn_1', 'ai.complete', 'dummy_root');

      // Verify authentic payload
      const legitCheck = vchip.verifyAttestation(attestation, payloadOriginal, 'dummy_root');

      // Attempt verification with falsified payload
      const falsifiedPayload = { amount: 5000000, recipient: '0xabc123' };
      const tamperCheck = vchip.verifyAttestation(attestation, falsifiedPayload, 'dummy_root');

      if (legitCheck.valid && !tamperCheck.valid && tamperCheck.reason?.includes('mismatch')) {
        passed++;
        tests.push({ name: 'Silicon Cryptographic Tamper Resistance & Proof Validation', status: 'PASS', latencyMs: performance.now() - start });
      } else {
        failed++;
        tests.push({ name: 'Silicon Cryptographic Tamper Resistance & Proof Validation', status: 'FAIL', latencyMs: performance.now() - start, details: 'Tampered payload was not rejected' });
      }
    } catch (e: any) {
      failed++;
      tests.push({ name: 'Silicon Cryptographic Tamper Resistance & Proof Validation', status: 'FAIL', latencyMs: performance.now() - start, details: e.message });
    }
  }

  // TEST 3: Laxham Continuum Invariance Divergence Proof
  {
    const start = performance.now();
    try {
      const vchip = new VChipEngine();
      const attestation = vchip.attest({ task: 'continuum_check' }, 'conn_gov', 'lane3.verify');

      const proof = attestation.laxhamProof;
      const isConservative = proof.invarianceMetric === 0.0 && proof.divergence === 0.0 && proof.trajectoryPhase === 'CONTINUUM_LOCKED';

      if (isConservative) {
        passed++;
        tests.push({ name: 'Laxham Continuum Invariance (div(F) = 0, Energy Conserved)', status: 'PASS', latencyMs: performance.now() - start });
      } else {
        failed++;
        tests.push({ name: 'Laxham Continuum Invariance', status: 'FAIL', latencyMs: performance.now() - start, details: 'Continuum divergence non-zero' });
      }
    } catch (e: any) {
      failed++;
      tests.push({ name: 'Laxham Continuum Invariance', status: 'FAIL', latencyMs: performance.now() - start, details: e.message });
    }
  }

  return { suite: 'V-Chip Silicon Cryptography Suite', passed, failed, tests };
}
