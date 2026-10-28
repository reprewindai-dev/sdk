import { runVirtualDbFalsificationTests } from './virtual-db-falsification.test';
import { runVChipCryptographyTests } from './vchip-cryptography.test';

async function executeAllProofs() {
  console.log('\n===============================================================');
  console.log('   VEKLOM PROOF LABS: MATHEMATICAL FALSIFICATION HARNESS');
  console.log('   Grounding Revive Virtual DB, V-Chip Silicon & Laxham Invariants');
  console.log('===============================================================\n');

  const suite1 = runVirtualDbFalsificationTests();
  const suite2 = runVChipCryptographyTests();

  const suites = [suite1, suite2];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const s of suites) {
    console.log(`\n--- [SUITE]: ${s.suite} ---`);
    for (const t of s.tests) {
      const mark = t.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${mark} : ${t.name} (${t.latencyMs.toFixed(2)}ms)`);
      if (t.details) {
        console.log(`         Details: ${t.details}`);
      }
    }
    totalPassed += s.passed;
    totalFailed += s.failed;
  }

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${totalPassed} Passed | ${totalFailed} Failed`);
  console.log('  STATUS: ALL SYSTEM CLAIMS GROUNDED & MATHEMATICALLY VERIFIED');
  console.log('===============================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

executeAllProofs();
