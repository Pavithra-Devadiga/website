/**
 * Simplifier Service
 * Comprehensive Plain-Language Document Simplification Engine.
 *
 * Translates complex, repetitive legal, banking, government, academic, and administrative
 * jargon into concise, clear, human-understandable explanations while strictly preserving
 * critical dates, monetary amounts, names, requirements, deadlines, and reference numbers.
 */

// Domain classification indicators
const DOCUMENT_TYPES = {
  BANKING: {
    name: 'Banking & Financial Document',
    keywords: ['bank', 'account', 'balance', 'deposit', 'loan', 'ifsc', 'branch', 'interest', 'debit', 'credit', 'statement', 'penalty', 'quarterly', 'collateral', 'disbursement', 'overdraft', 'emi'],
    guidance: 'This document explains banking terms, account rules, fees, or loan requirements.'
  },
  GOVERNMENT: {
    name: 'Government Notice & Scheme',
    keywords: ['government', 'ministry', 'scheme', 'circular', 'gazette', 'statutory', 'aadhaar', 'pan card', 'portal', 'guidelines', 'beneficiary', 'affidavit', 'domicile', 'authority', 'official'],
    guidance: 'This document contains official government instructions, eligibility rules, or scheme guidelines.'
  },
  ACADEMIC: {
    name: 'College & Academic Notice',
    keywords: ['admission', 'university', 'college', 'examination', 'semester', 'syllabus', 'candidate', 'student', 'degree', 'course', 'tuition', 'enrollment', 'attendance', 'hall ticket'],
    guidance: 'This document contains college rules, admission details, or exam instructions.'
  },
  LEGAL: {
    name: 'Legal Agreement & Contract',
    keywords: ['agreement', 'clause', 'indemnify', 'jurisdiction', 'parties', 'covenant', 'liability', 'termination', 'hereby', 'forthwith', 'covenants', 'dispute', 'arbitration', 'null and void'],
    guidance: 'This document is a formal agreement specifying legal obligations, rules, and penalties.'
  },
  BILLING: {
    name: 'Bill & Payment Notice',
    keywords: ['invoice', 'billing', 'tariff', 'due date', 'payable', 'meter', 'consumption', 'units', 'charges', 'surcharge', 'late fee'],
    guidance: 'This document details payment amounts, charges, and payment due dates.'
  }
};

// Sentence-level boilerplate replacements (verbose passive bureaucratese -> direct active English)
const BOILERPLATE_TRANSFORMS = [
  {
    regex: /The account holder shall (?:be liable for|pay) applicable charges arising from non-maintenance of the minimum quarterly average balance\.?/gi,
    simple: 'You must maintain the required minimum balance in your account, otherwise the bank will charge a fee.'
  },
  {
    regex: /The account holder shall maintain the (?:prescribed )?minimum quarterly average balance\.?/gi,
    simple: 'You must keep at least the required amount of money in your account during each quarter.'
  },
  {
    regex: /In the event of default in payment,?\s*penal interest shall be levied forthwith\.?/gi,
    simple: 'If payments are missed or late, extra penalty charges will be applied immediately.'
  },
  {
    regex: /The applicant shall furnish the necessary documentation and supporting evidence in accordance with the applicable provisions\.?/gi,
    simple: 'You need to provide the required documents and proof.'
  },
  {
    regex: /It is hereby notified for the information of all concerned that\.?/gi,
    simple: 'Please note that:'
  },
  {
    regex: /With reference to the subject (?:cited|mentioned) above,?\s*(?:it is informed that)?/gi,
    simple: 'Regarding this matter:'
  },
  {
    regex: /Failure to comply with the terms and conditions herein may result in immediate termination of services?\.?/gi,
    simple: 'If you do not follow these rules, your service may be cancelled immediately.'
  },
  {
    regex: /All disputes shall be subject to the exclusive jurisdiction of the competent courts?\.?/gi,
    simple: 'Any legal disagreement must be handled by the local court.'
  },
  {
    regex: /The borrower covenants and agrees to indemnify the lender against any liabilities or losses\.?/gi,
    simple: 'The borrower agrees to compensate the lender for any financial losses.'
  },
  {
    regex: /The beneficiary must provide documentation for identity verification and authorization prior to disbursement of collateral\.?/gi,
    simple: 'The receiver must provide proof of identity and approval before any security money is released.'
  },
  {
    regex: /The prescribed fee shall be remitted prior to the stipulated date\.?/gi,
    simple: 'You must pay the required fee before the deadline.'
  },
  {
    regex: /No extension of time shall be granted under any circumstances\.?/gi,
    simple: 'The deadline cannot be extended for any reason.'
  },
  {
    regex: /Subject to the verification of original documents and credentials\.?/gi,
    simple: 'Subject to checking your original documents.'
  }
];

// Terminology replacements
const PHRASE_DICTIONARY = [
  { term: 'minimum quarterly average balance', simple: 'minimum required bank balance over 3 months' },
  { term: 'non-maintenance of the minimum balance', simple: 'not keeping the required minimum balance' },
  { term: 'annual maintenance charges?', simple: 'yearly service fee' },
  { term: 'annual percentage rate', simple: 'yearly interest rate' },
  { term: 'terms and conditions', simple: 'rules and terms' },
  { term: 'applicable charges', simple: 'extra fees' },
  { term: 'processing fee', simple: 'service fee' },
  { term: 'penal interest', simple: 'penalty interest' },
  { term: 'insufficient funds', simple: 'not enough balance in your account' },
  { term: 'null and void', simple: 'invalid and cancelled' },
  { term: 'in accordance with', simple: 'following' },
  { term: 'pursuant to', simple: 'under' },
  { term: 'shall constitute', simple: 'will count as' },
  { term: 'shall be liable', simple: 'will be responsible to pay' },
  { term: 'shall be deemed', simple: 'will be considered' },
  { term: 'levied forthwith', simple: 'charged immediately' },
  { term: 'prior to', simple: 'before' },
  { term: 'subsequent to', simple: 'after' },
  { term: 'at the discretion of', simple: 'decided by' },
  { term: 'without prejudice to', simple: 'without affecting' },
  { term: 'grievance redressal', simple: 'complaint resolution' },
  { term: 'statutory obligation', simple: 'legal duty' },
  { term: 'beneficiary', simple: 'receiver / person getting the benefit' },
  { term: 'collateral', simple: 'security deposit / pledged asset' },
  { term: 'indemnify', simple: 'compensate for losses' },
  { term: 'jurisdiction', simple: 'official legal authority' },
  { term: 'disbursement', simple: 'payout / release of money' },
  { term: 'remittance', simple: 'money transfer' },
  { term: 'amortization', simple: 'loan repayment schedule' },
  { term: 'documentation', simple: 'documents and proof' },
  { term: 'verification', simple: 'document check' },
  { term: 'authorization', simple: 'official approval' },
  { term: 'utilize[ds]?', simple: 'use' },
  { term: 'facilitate[ds]?', simple: 'help' },
  { term: 'commence[ds]?', simple: 'start' },
  { term: 'terminate[ds]?', simple: 'end' },
  { term: 'disclose[ds]?', simple: 'share' },
  { term: 'retain[ds]?', simple: 'keep' },
  { term: 'mandatory', simple: 'required' },
  { term: 'stipulated', simple: 'stated' },
  { term: 'hereby', simple: 'by this notice' },
  { term: 'forthwith', simple: 'immediately' }
];

class SimplifierService {
  /**
   * Detect the most likely document domain
   */
  detectDocumentType(text) {
    const lower = text.toLowerCase();
    let bestType = null;
    let maxMatches = 0;

    for (const [key, typeInfo] of Object.entries(DOCUMENT_TYPES)) {
      let matches = 0;
      for (const kw of typeInfo.keywords) {
        if (lower.includes(kw)) matches++;
      }
      if (matches > maxMatches) {
        maxMatches = matches;
        bestType = { key, ...typeInfo };
      }
    }

    return bestType || {
      key: 'GENERAL',
      name: 'Official Document',
      guidance: 'This document contains official information and instructions.'
    };
  }

  /**
   * Extract dates, money amounts, and reference identifiers
   */
  extractKeyEntities(text) {
    const entities = {
      amounts: [],
      dates: [],
      referenceNumbers: []
    };

    // Extract monetary amounts (e.g. ₹5,000, Rs. 10,000, $500, 18% GST)
    const amountMatches = text.match(/(?:₹|Rs\.?|INR|\$)\s*[0-9,]+(?:\.[0-9]{2})?|\b[0-9]+(?:\.[0-9]+)?%/gi);
    if (amountMatches) {
      entities.amounts = [...new Set(amountMatches.map(a => a.trim()))];
    }

    // Extract dates (e.g. 31/03/2025, 15th August 2024, March 31, 2025)
    const dateMatches = text.match(/\b(?:[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|(?:[0-9]{1,2}(?:st|nd|rd|th)?\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+[0-9]{1,2}(?:st|nd|rd|th)?)?(?:,?\s+[0-9]{4})?)\b/gi);
    if (dateMatches) {
      entities.dates = [...new Set(dateMatches.map(d => d.trim()))].filter(d => d.length > 3);
    }

    // Extract Reference / Account / IFSC numbers
    const refMatches = text.match(/\b(?:Ref(?:\s*No|\.)?|Account\s*No|IFSC(?:\s*Code)?|PAN|Aadhaar|Application\s*No)[:\s]+[A-Za-z0-9\-_/]+/gi);
    if (refMatches) {
      entities.referenceNumbers = [...new Set(refMatches.map(r => r.trim()))];
    }

    return entities;
  }

  /**
   * Main entry point to simplify document text
   * @param {string} text Raw or OCR document text
   * @returns {Promise<{
   *   originalText: string,
   *   simplifiedText: string,
   *   replacedTermsCount: number,
   *   replacedTermsList: Array<{ term: string, simple: string }>,
   *   docType: Object,
   *   entities: Object
   * }>}
   */
  async simplifyText(text) {
    if (!text || typeof text !== 'string') {
      return {
        originalText: '',
        simplifiedText: '',
        replacedTermsCount: 0,
        replacedTermsList: [],
        docType: null,
        entities: {}
      };
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return {
        originalText: '',
        simplifiedText: '',
        replacedTermsCount: 0,
        replacedTermsList: [],
        docType: null,
        entities: {}
      };
    }

    const docType = this.detectDocumentType(trimmed);
    const entities = this.extractKeyEntities(trimmed);
    const replacedTermsList = [];

    // Step 1: Sentence boilerplate simplification
    let simplifiedContent = trimmed;

    for (const rule of BOILERPLATE_TRANSFORMS) {
      if (rule.regex.test(simplifiedContent)) {
        simplifiedContent = simplifiedContent.replace(rule.regex, rule.simple);
        replacedTermsList.push({
          term: 'Complex sentence structure',
          simple: rule.simple
        });
      }
    }

    // Step 2: Vocabulary & jargon replacement
    for (const entry of PHRASE_DICTIONARY) {
      const escapedTerm = entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');

      if (regex.test(simplifiedContent)) {
        simplifiedContent = simplifiedContent.replace(regex, (matched) => {
          if (matched[0] === matched[0].toUpperCase() && matched.length > 1 && matched[1] === matched[1].toLowerCase()) {
            return entry.simple.charAt(0).toUpperCase() + entry.simple.slice(1);
          }
          return entry.simple;
        });

        replacedTermsList.push({
          term: entry.term,
          simple: entry.simple
        });
      }
    }

    // Step 3: Polish sentence flow
    simplifiedContent = this.polishText(simplifiedContent);

    // Step 4: For longer / multi-sentence documents, structure the explanation cleanly
    let finalOutput;
    const sentences = simplifiedContent
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (sentences.length <= 2) {
      // Short document / single clause
      finalOutput = simplifiedContent;
    } else {
      // Multi-sentence document: Create an organized Plain-Language Breakdown
      const intro = `📄 **Document Type:** ${docType.name}\n${docType.guidance}\n\n`;

      const mainPoints = sentences
        .slice(0, Math.min(6, sentences.length))
        .map(s => `• ${s}`)
        .join('\n');

      let factsSection = '';
      if (entities.amounts.length > 0 || entities.dates.length > 0 || entities.referenceNumbers.length > 0) {
        factsSection = '\n\n📌 **Key Figures & Deadlines:**\n';
        if (entities.amounts.length > 0) factsSection += `• Amounts / Fees: ${entities.amounts.join(', ')}\n`;
        if (entities.dates.length > 0) factsSection += `• Dates / Deadlines: ${entities.dates.join(', ')}\n`;
        if (entities.referenceNumbers.length > 0) factsSection += `• Reference: ${entities.referenceNumbers.join(', ')}\n`;
      }

      finalOutput = `${intro}💡 **Simple Explanation:**\n${mainPoints}${factsSection}`.trim();
    }

    return {
      originalText: trimmed,
      simplifiedText: finalOutput,
      replacedTermsCount: replacedTermsList.length,
      replacedTermsList,
      docType,
      entities
    };
  }

  /**
   * Helper to polish spacing, line breaks, and punctuation
   */
  polishText(text) {
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/([.,;:!?])(?=[A-Za-z])/g, '$1 ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export const simplifierService = new SimplifierService();
export default simplifierService;
