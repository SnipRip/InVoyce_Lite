import { describe, expect, it } from 'vitest';
import { gstinCheckChar } from '../common/gst/gstin.js';
import { branchProblem, gstinStateClash, licenceProblem, msmeProtected, settleBranch } from './party-branch-rules.js';

const gstin = (first14: string) => first14 + gstinCheckChar(first14);

// Prasad Traders: main GSTIN in Bihar (10), a branch in Jharkhand (20), same PAN.
const owner = { treatment: 'REGISTERED' as const, gstin: gstin('10AABCP1234C1Z'), pan: 'AABCP1234C' };
const branch = { kind: 'BRANCH' as const, name: 'Ranchi', treatment: null, gstin: gstin('20AABCP1234C1Z'), placeOfSupply: null };

describe('party branches', () => {
  it('takes the state from the GSTIN and the treatment from the party', () => {
    const settled = settleBranch(branch, owner);
    expect(settled.placeOfSupply).toBe('20');
    expect(settled.treatment).toBe('REGISTERED');
  });

  it('keeps GST details off a delivery address', () => {
    const settled = settleBranch({ ...branch, kind: 'SHIP_TO', placeOfSupply: '19' }, owner);
    expect(settled.gstin).toBeNull();
    expect(settled.treatment).toBeNull();
    expect(branchProblem(settled, owner)).toBeNull();
  });

  it('refuses a GSTIN under another PAN: that is another business', () => {
    const other = settleBranch({ ...branch, gstin: gstin('20AAACX9999C1Z') }, owner);
    expect(branchProblem(other, owner)).toMatch(/different business/);
  });

  it('needs a state and a name', () => {
    expect(branchProblem({ ...branch, kind: 'SHIP_TO', placeOfSupply: null }, owner)).toMatch(/state/);
    expect(branchProblem({ ...branch, name: ' ', placeOfSupply: '20' }, owner)).toMatch(/name/);
  });

  it('lets one GSTIN cover places in its own state only', () => {
    const same = [
      { name: 'Main', gstin: owner.gstin, placeOfSupply: '10' },
      { name: 'Godown', gstin: owner.gstin, placeOfSupply: '10' },
    ];
    expect(gstinStateClash(same)).toBeNull();
    expect(gstinStateClash([...same, { name: 'Ranchi', gstin: owner.gstin, placeOfSupply: '20' }])).toMatch(/another state/);
  });
});

describe('MSME 45-day rule', () => {
  const udyam = 'UDYAM-BR-01-0000001';
  it('covers micro and small manufacturers and service providers', () => {
    expect(msmeProtected({ udyamNumber: udyam, msmeCategory: 'MICRO', msmeActivity: 'SERVICES' })).toBe(true);
    expect(msmeProtected({ udyamNumber: udyam, msmeCategory: null, msmeActivity: null })).toBe(true);
  });
  it('leaves out medium enterprises, traders and parties without Udyam', () => {
    expect(msmeProtected({ udyamNumber: udyam, msmeCategory: 'MEDIUM', msmeActivity: 'MANUFACTURING' })).toBe(false);
    expect(msmeProtected({ udyamNumber: udyam, msmeCategory: 'MICRO', msmeActivity: 'TRADING' })).toBe(false);
    expect(msmeProtected({ udyamNumber: null })).toBe(false);
  });
});

describe('licences', () => {
  it('checks FSSAI and names other licences', () => {
    expect(licenceProblem({ kind: 'FSSAI', label: null, number: '12345678901234' })).toBeNull();
    expect(licenceProblem({ kind: 'FSSAI', label: null, number: '1234' })).toMatch(/14 digits/);
    expect(licenceProblem({ kind: 'OTHER', label: null, number: 'X1' })).toMatch(/what/);
  });
});
