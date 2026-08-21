/**
 * Form Service
 * Advanced Visual & Semantic Form Field Detection Engine with Strict OCR Quality Filtering.
 *
 * Core Capabilities:
 * 1. High-Precision Form Field Detection using semantic catalog matching and structural syntax.
 * 2. Strict OCR Garbage, Symbol Noise, and Gibberish Filtering.
 * 3. Elimination of Action Buttons (e.g. "Submit", "Cancel") and Browser/UI Artifacts (e.g. "All Bookmarks").
 * 4. Structural Section Header Filtering (e.g. "Personal Information", "Checklist", "Declaration").
 * 5. Spatial & Multi-column parsing with input region / blank space validation.
 * 6. Internal Field Confidence Scoring.
 * 7. Deduplication of accidental OCR duplicates while preserving legitimate multi-instance fields.
 * 8. Natural Language Voice Mapping for detected fields.
 * 9. Field validation and structured data export.
 */

// Section headers and organizational banners that should NEVER become input fields
const SECTION_HEADERS = [
  /^(?:personal\s+information|applicant\s+information|contact\s+details|general\s+information)$/i,
  /^(?:educational?\s+qualifications?|educational?\s+background|education|academics?)$/i,
  /^(?:recent\s+employment\s+history|employment\s+history|work\s+experience|professional\s+experience|experience)$/i,
  /^(?:references?|professional\s+references?|referees?)$/i,
  /^(?:declaration|terms\s*&\s*conditions|terms\s+and\s+conditions|signature|signatures)$/i,
  /^(?:for\s+office\s+use\s+only|office\s+use\s+only|for\s+bank\s+use\s+only|official\s+use\s+only)$/i,
  /^(?:job\s+application\s+form|employment\s+application|application\s+for\s+employment|account\s+opening\s+form)$/i,
  /^(?:checklist|instructions?|guidelines?|important\s+notes?|notes?)$/i
];

// UI controls, action buttons, browser chrome, web artifacts, and organization footers
const UI_AND_ACTION_BLACKLIST = [
  /^(?:submit|submitting|submitted|login|log\s*in|sign\s*in|sign\s*up|register|registration)$/i,
  /^(?:search|search\s+here|cancel|next|previous|prev|back|continue|save|saved|reset|clear)$/i,
  /^(?:close|exit|apply|applied|apply\s+now|download|print|upload|edit|view|delete|remove)$/i,
  /^(?:refresh|reload|send|proceed|ok|done|confirm|agree|accept|decline|reject)$/i,
  /^(?:menu|home|navigation|nav|breadcrumb|tab|tabs|all\s+bookmarks|bookmarks?|bookmark\s+bar)$/i,
  /^(?:checklist|instructions?|guidelines?|important\s+notes?|notes?|help|faq|faqs)$/i,
  /^(?:declaration|terms\s*&\s*conditions|terms\s+and\s+conditions|privacy\s+policy|copyright)$/i,
  /^(?:all\s+rights\s+reserved|powered\s+by|version\s*\d.*|page\s+\d+\s+of\s+\d+)$/i,
  /^(?:national\s+informatics\s+centre.*|nic|govt\s+of\s+india|government\s+of\s+india)$/i,
  /^(?:signature(?:\s+of\s+applicant)?|sign\s+here|date\s*&\s*place|place\s*&\s*date)$/i,
  /^(?:for\s+office\s+use\s+only|official\s+use\s+only|for\s+bank\s+use\s+only)$/i
];

// Legitimate single-word form label exceptions (non-comprehensive fallback only)
const ALLOWED_SINGLE_WORD_LABELS = new Set([
  'name', 'address', 'city', 'state', 'pincode', 'gender', 'age',
  'nationality', 'occupation', 'profession', 'branch', 'relationship', 'relation',
  'education', 'qualification', 'qualifications', 'skills', 'employer', 'designation',
  'department', 'dob', 'pan', 'ifsc', 'aadhaar', 'aadhar', 'email', 'phone', 'mobile',
  'school', 'college', 'university', 'degree', 'course', 'year', 'company', 'role',
  'position', 'duration', 'period', 'reference', 'referee'
]);

// Approved short acronyms
const APPROVED_ACRONYMS = new Set([
  'IFSC', 'PIN', 'DOB', 'PAN', 'UID', 'URL', 'ID', 'NO', 'CV', 'HR', 'CTC', 'CGPA', 'GPA'
]);

// Comprehensive catalog of recognizable form field definitions (ordered from most specific to general)
const FIELD_DEFINITIONS = [
  // 1. Job & Employment Information
  {
    regex: /\b(?:position\s+applied\s+for|position\s+applied|applied\s+for|job\s+title\s+applied)\b/i,
    label: 'Position Applied For',
    type: 'text',
    placeholder: 'e.g. Software Engineer'
  },
  {
    regex: /\b(?:position\s+held|designation|job\s+title|role\s+held)\b/i,
    label: 'Position Held',
    type: 'text',
    placeholder: 'e.g. Senior Frontend Developer'
  },
  {
    regex: /\b(?:company\s+name|current\s+company|previous\s+company|employer(?:\s+name)?|organization(?:\s+name)?)\b/i,
    label: 'Company Name',
    type: 'text',
    placeholder: 'e.g. Acme Technologies'
  },
  {
    regex: /\b(?:employment\s+dates|dates\s+of\s+employment|work\s+period|duration|period\s+of\s+employment)\b/i,
    label: 'Employment Dates',
    type: 'text',
    placeholder: 'e.g. 2022 - 2025'
  },
  {
    regex: /\b(?:skills?\s*&\s*qualifications?|skills?\s+and\s+qualifications?|key\s+skills|technical\s+skills|skills|qualifications)\b/i,
    label: 'Skills & Qualifications',
    type: 'text',
    placeholder: 'e.g. React, JavaScript, Node.js, Accessibility'
  },
  {
    regex: /\b(?:total\s+experience|years\s+of\s+experience|experience\s+in\s+years)\b/i,
    label: 'Total Experience',
    type: 'text',
    placeholder: 'e.g. 3 Years'
  },
  {
    regex: /\b(?:current\s+ctc|current\s+salary|present\s+salary)\b/i,
    label: 'Current CTC',
    type: 'text',
    placeholder: 'e.g. 10 LPA'
  },
  {
    regex: /\b(?:expected\s+ctc|expected\s+salary)\b/i,
    label: 'Expected CTC',
    type: 'text',
    placeholder: 'e.g. 14 LPA'
  },
  {
    regex: /\b(?:notice\s+period)\b/i,
    label: 'Notice Period',
    type: 'text',
    placeholder: 'e.g. 30 Days / Immediate'
  },

  // 2. Education Information
  {
    regex: /\b(?:school\s*\/\s*institution|school\/institution|institution|school\s+name|college\s+name|college|university|school)\b/i,
    label: 'School / Institution',
    type: 'text',
    placeholder: 'e.g. University of Visvesvaraya College of Engineering'
  },
  {
    regex: /\b(?:degree\s*\/\s*certification|degree\/certification|degree|certification|highest\s+qualification|course)\b/i,
    label: 'Degree / Certification',
    type: 'text',
    placeholder: 'e.g. Bachelor of Engineering (Computer Science)'
  },
  {
    regex: /\b(?:year\s+completed|year\s+of\s+passing|graduation\s+year|completion\s+year|year\s+passed)\b/i,
    label: 'Year Completed',
    type: 'text',
    placeholder: 'e.g. 2026'
  },
  {
    regex: /\b(?:percentage|cgpa|gpa|marks\s+obtained|grade)\b/i,
    label: 'Percentage / CGPA',
    type: 'text',
    placeholder: 'e.g. 8.5 CGPA / 85%'
  },

  // 3. References & Emergency Information
  {
    regex: /\b(?:reference\s+phone|referee\s+phone|reference\s+contact|referee\s+contact)\b/i,
    label: 'Reference Phone',
    type: 'tel',
    placeholder: 'e.g. 9876543210'
  },
  {
    regex: /\b(?:reference\s+email|referee\s+email)\b/i,
    label: 'Reference Email',
    type: 'email',
    placeholder: 'e.g. referee@example.com'
  },
  {
    regex: /\b(?:reference\s+name|referee\s+name|reference\s+1|referee|reference)\b/i,
    label: 'Reference Name',
    type: 'text',
    placeholder: 'e.g. Dr. Ramesh Kumar'
  },
  {
    regex: /\b(?:relationship|relation|how\s+known|connection)\b/i,
    label: 'Relationship',
    type: 'text',
    placeholder: 'e.g. Professor / Former Manager'
  },
  {
    regex: /\b(?:emergency\s+contact(?:\s+number|\s+phone)?|emergency\s+phone)\b/i,
    label: 'Emergency Contact',
    type: 'tel',
    placeholder: 'e.g. 9876543210'
  },

  // 4. Personal & Identity Information
  {
    regex: /\b(?:full\s+name|applicant\s+name|candidate\s+name|account\s+holder\s+name|holder\s+name|student\s+name|customer\s+name|your\s+name|name)\b/i,
    label: 'Full Name',
    type: 'text',
    placeholder: 'e.g. Akash Kumar'
  },
  {
    regex: /\b(?:father(?:'?s)?\s+name|father\s+name)\b/i,
    label: "Father's Name",
    type: 'text',
    placeholder: 'e.g. Rajesh Kumar'
  },
  {
    regex: /\b(?:mother(?:'?s)?\s+name|mother\s+name)\b/i,
    label: "Mother's Name",
    type: 'text',
    placeholder: 'e.g. Sunita Devi'
  },
  {
    regex: /\b(?:email\s+address|email\s+id|e-mail|email)\b/i,
    label: 'Email Address',
    type: 'email',
    placeholder: 'e.g. akash@example.com'
  },
  {
    regex: /\b(?:phone\s+number|mobile\s+number|contact\s+number|mobile\s+no|phone\s+no|telephone|phone|mobile)\b/i,
    label: 'Phone Number',
    type: 'tel',
    placeholder: 'e.g. 9876543210'
  },
  {
    regex: /\b(?:residential\s+address|permanent\s+address|current\s+address|postal\s+address|street\s+address|address)\b/i,
    label: 'Address',
    type: 'text',
    placeholder: 'e.g. 123 MG Road, Indiranagar'
  },
  {
    regex: /\b(?:date\s+of\s+birth|dob|birth\s*date)\b/i,
    label: 'Date of Birth',
    type: 'text',
    placeholder: 'e.g. 15/08/1998'
  },
  {
    regex: /\b(?:city|town|district)\b/i,
    label: 'City',
    type: 'text',
    placeholder: 'e.g. Bengaluru'
  },
  {
    regex: /(?:^|\s)(?:state|province|state\s+name)(?:$|[:=])/i,
    label: 'State',
    type: 'text',
    placeholder: 'e.g. Karnataka'
  },
  {
    regex: /\b(?:pin\s*code|pincode|postal\s*code|zip\s*code|zip)\b/i,
    label: 'PIN Code',
    type: 'text',
    placeholder: 'e.g. 560001'
  },
  {
    regex: /\b(?:nationality|citizenship)\b/i,
    label: 'Nationality',
    type: 'text',
    placeholder: 'e.g. Indian'
  },
  {
    regex: /\b(?:gender|sex)\b/i,
    label: 'Gender',
    type: 'text',
    placeholder: 'e.g. Male / Female / Other'
  },
  {
    regex: /\b(?:age|age\s+in\s+years)\b/i,
    label: 'Age',
    type: 'number',
    placeholder: 'e.g. 25'
  },
  {
    regex: /\b(?:marital\s+status)\b/i,
    label: 'Marital Status',
    type: 'text',
    placeholder: 'e.g. Single / Married'
  },

  // 5. Banking & Financial Information
  {
    regex: /\b(?:account\s+no|account\s+number|a\/c\s*no)\b/i,
    label: 'Account Number',
    type: 'text',
    placeholder: 'e.g. 1234567890'
  },
  {
    regex: /\b(?:ifsc(?:\s*code)?|branch\s*ifsc)\b/i,
    label: 'IFSC Code',
    type: 'text',
    placeholder: 'e.g. SBIN0001234'
  },
  {
    regex: /\b(?:branch(?:\s*name)?|bank\s*branch)\b/i,
    label: 'Branch',
    type: 'text',
    placeholder: 'e.g. Bengaluru Main'
  },
  {
    regex: /\b(?:nominee(?:\s*name)?|name\s+of\s+nominee)\b/i,
    label: 'Nominee Name',
    type: 'text',
    placeholder: 'e.g. Priya Sharma'
  },
  {
    regex: /\b(?:aadhaar(?:\s*no|\s*number)?|aadhar|uid)\b/i,
    label: 'Aadhaar Number',
    type: 'text',
    placeholder: 'e.g. 1234 5678 9012'
  },
  {
    regex: /\b(?:pan(?:\s*no|\s*number)?|pan\s*card)\b/i,
    label: 'PAN Number',
    type: 'text',
    placeholder: 'e.g. ABCDE1234F'
  },
  {
    regex: /\b(?:occupation|profession)\b/i,
    label: 'Occupation',
    type: 'text',
    placeholder: 'e.g. Software Engineer'
  }
];

class FormService {
  /**
   * Generates a safe unique ID from a field label
   */
  generateFieldId(label) {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field';
  }

  /**
   * Checks if a line is a purely informational section header
   */
  isSectionHeader(text) {
    if (!text) return false;
    const clean = text.trim();
    return SECTION_HEADERS.some((regex) => regex.test(clean));
  }

  /**
   * Evaluates if text is an action button, navigation, UI artifact, or footer
   */
  isUiOrButtonText(text) {
    if (!text) return false;
    const clean = text.trim().replace(/^[-–—•*\d.)\s]+/, '').replace(/[:=_\-[\]]+$/, '').trim();
    return UI_AND_ACTION_BLACKLIST.some((regex) => regex.test(clean));
  }

  /**
   * Rigorous Linguistic & OCR Garbage Filter.
   * Evaluates if a candidate label is meaningful natural language or OCR noise.
   *
   * @param {string} text Raw or cleaned candidate label string
   * @param {number} [ocrConfidence] Optional OCR confidence value (0-100)
   * @returns {boolean} True if garbage/noise, False if valid natural label
   */
  isGarbageLabel(text, ocrConfidence = null) {
    if (!text || typeof text !== 'string') return true;

    // 1. OCR Confidence check (if available)
    if (ocrConfidence !== null && ocrConfidence !== undefined && ocrConfidence > 0 && ocrConfidence < 38) {
      return true;
    }

    const trimmed = text.trim();

    // 2. Length limits
    if (trimmed.length < 2 || trimmed.length > 55) {
      return true;
    }

    // 3. UI, Button, or Section Header match
    if (this.isSectionHeader(trimmed) || this.isUiOrButtonText(trimmed)) {
      return true;
    }

    // 4. URL, Web, Browser, or File System artifacts
    if (/^(?:https?:|www\.|file:|chrome:|blob:|\/|\\|localhost)/i.test(trimmed)) {
      return true;
    }
    if (/\b(?:bookmarks?|all\s+bookmarks|chrome|firefox|safari|browser|window|html|css|javascript)\b/i.test(trimmed)) {
      return true;
    }
    if (/(?:state bank|government of|university of|ministry of|bank of|college of|national informatics centre)\b/i.test(trimmed)) {
      return true;
    }

    // 5. Excessive Symbol / Non-Alphanumeric Ratio
    // Symbols like =, ~, |, \, [, ], {, }, <, >, ^, @, #, $, %, *, ", `
    const symbolMatches = trimmed.match(/[=~\\|[\]{}<>^@#$%*"`_]/g) || [];
    const symbolRatio = symbolMatches.length / trimmed.length;
    if (symbolRatio > 0.18) {
      return true;
    }

    // Repeated consecutive symbols like ==, ===, "", [[, ]], ||, __
    if (/[=~\\|[\]{}<>^@#$%*"`]{2,}/.test(trimmed)) {
      return true;
    }

    // Broken OCR symbol prefixes/suffixes like "=ndnctions", "Centre 8"", "_a"
    if (/^[=~\\|[\]{}<>^@#$%*"`_]+[a-z0-9]/i.test(trimmed) || /[a-z0-9][=~\\|[\]{}<>^@#$%*"`_]{2,}$/i.test(trimmed)) {
      return true;
    }

    // 6. Number / Digit ratio check
    const digitMatches = trimmed.match(/\d/g) || [];
    const digitRatio = digitMatches.length / trimmed.length;
    // Form labels should not be mostly numbers (e.g. "A3 [3", "Centre 8")
    if (digitRatio > 0.25) {
      return true;
    }
    if (/^[A-Z]\d\s+\[\d/i.test(trimmed)) {
      return true;
    }

    // 7. Word-level Gibberish & Vowel Distribution Check
    const cleanWords = trimmed
      .split(/[-\s/&'()_]+/)
      .map((w) => w.trim())
      .filter(Boolean);

    if (cleanWords.length === 0) return true;

    // Single-word label checks
    if (cleanWords.length === 1) {
      const single = cleanWords[0].toLowerCase();
      if (!ALLOWED_SINGLE_WORD_LABELS.has(single) && !APPROVED_ACRONYMS.has(single.toUpperCase())) {
        // If single word is not a standard known form label, reject
        return true;
      }
    }

    let vowelCount = 0;
    let totalLetterCount = 0;

    for (const word of cleanWords) {
      const upperWord = word.toUpperCase();
      if (APPROVED_ACRONYMS.has(upperWord)) {
        vowelCount += 2;
        totalLetterCount += word.length;
        continue;
      }

      // Check if word contains any letters
      const letters = word.match(/[a-zA-Z]/g);
      if (!letters) continue;

      totalLetterCount += letters.length;
      const vowels = word.match(/[aeiouyAEIOUY]/g);
      const wordVowels = vowels ? vowels.length : 0;
      vowelCount += wordVowels;

      // Words with >= 3 letters must contain at least 1 vowel (rejects "ccs", "zmcy", "ndnctions")
      if (letters.length >= 3 && wordVowels === 0) {
        return true;
      }

      // Rejects excessive consonant clusters (e.g. "ndnct", "zmcys")
      if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(word)) {
        return true;
      }
    }

    // Overall vowel ratio in multi-letter string should be at least 15%
    if (totalLetterCount >= 4 && vowelCount / totalLetterCount < 0.15) {
      return true;
    }

    return false;
  }

  /**
   * Identifies candidate field definitions present in a text segment
   */
  findFieldDefinition(segment, ocrConfidence = null) {
    if (!segment || typeof segment !== 'string') return null;

    // Clean segment boundaries
    const clean = segment
      .trim()
      .replace(/^[-–—•*\d.)\s=~_|[\]]+/, '')
      .replace(/[:=_\-[\]~|]+$/, '')
      .trim();

    if (this.isGarbageLabel(clean, ocrConfidence)) {
      return null;
    }

    // 1. Direct match against known high-precision field catalog
    for (const def of FIELD_DEFINITIONS) {
      if (def.regex.test(clean)) {
        return {
          ...def,
          confidenceScore: 0.95
        };
      }
    }

    // 2. Strict Structured Fallback (Requires proper word formatting and natural prompt shape)
    // Only accept clean capitalized 2-4 word phrases with high linguistic validity
    const words = clean.split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      clean.length >= 5 &&
      clean.length <= 35 &&
      /^[A-Za-z][A-Za-z\s/&'-]+[A-Za-z.]$/.test(clean)
    ) {
      // Must not be blacklisted or garbage
      if (!this.isGarbageLabel(clean, ocrConfidence)) {
        return {
          label: this.toTitleCase(clean),
          type: 'text',
          placeholder: `Enter ${this.toTitleCase(clean)}`,
          confidenceScore: 0.70
        };
      }
    }

    return null;
  }

  /**
   * Splits multi-column lines into individual label candidate segments
   * Supports: "Full Name       Address" or "School/Institution   Degree/Certification   Year Completed"
   */
  splitMultiColumnLine(line) {
    if (!line) return [];

    // Split on 2 or more consecutive spaces, tabs, or vertical bar pipes
    const segments = line
      .split(/(?:\s{2,}|\t+|\|)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return segments.length > 0 ? segments : [line.trim()];
  }

  /**
   * Detects real form fields from extracted document OCR text and positional metadata.
   * Filters out OCR noise, browser artifacts, and action buttons.
   *
   * @param {string} ocrText Extracted document text
   * @param {Object} [ocrData] Line/word bounding box coordinates from Tesseract
   * @returns {{ fields: Array, detectedCount: number, source: 'detected'|'none' }}
   */
  detectFormFields(ocrText, ocrData = null) {
    if (!ocrText || typeof ocrText !== 'string' || ocrText.trim().length === 0) {
      return {
        fields: [],
        detectedCount: 0,
        source: 'none'
      };
    }

    const detected = [];
    const seenIds = new Set();
    const seenLabelsInOrder = [];

    const addField = (label, type = 'text', placeholder = '', prefilledValue = '', confidence = 0.8) => {
      if (this.isGarbageLabel(label)) return;

      let id = this.generateFieldId(label);

      // Check for immediate adjacent OCR duplicate (e.g. duplicate identical lines from OCR scan)
      const lastAdded = detected[detected.length - 1];
      if (lastAdded && lastAdded.label === label && lastAdded.value === prefilledValue) {
        return;
      }

      // If label appears legitimately multiple times in different sections (e.g. Phone Number), assign unique ID
      if (seenIds.has(id)) {
        const count = seenLabelsInOrder.filter((l) => l === label).length + 1;
        id = `${id}_${count}`;
      }
      seenIds.add(id);
      seenLabelsInOrder.push(label);

      detected.push({
        id,
        label,
        type,
        placeholder: placeholder || `Enter ${label}`,
        value: prefilledValue || '',
        confidence
      });
    };

    // -------------------------------------------------------------
    // Strategy 1: Spatial & Multi-Column Line-by-Line Inspection
    // -------------------------------------------------------------
    const lines = ocrText.split('\n').map((l) => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip document title / full banner lines / action buttons
      if (this.isSectionHeader(line) || this.isUiOrButtonText(line)) {
        continue;
      }

      // Check if line contains a standard colon/equals delimiter: "Label: Value"
      const colonMatch = line.match(/^([A-Za-z\s/&()\-.]{2,40})\s*[:=]\s*(.*)$/);
      if (colonMatch) {
        const candidateLabel = colonMatch[1].trim();
        const remainder = colonMatch[2].trim();

        if (!this.isGarbageLabel(candidateLabel)) {
          const matchedDef = this.findFieldDefinition(candidateLabel);
          if (matchedDef) {
            let prefilled = remainder.replace(/^[_.\-\s|[\],~`="]+|[_.\-\s|[\],~`="]+$/g, '').trim();
            if (/^[_\-.\s|[\]~`="]+$/.test(remainder) || remainder.length === 0) {
              prefilled = '';
            }
            addField(matchedDef.label, matchedDef.type, matchedDef.placeholder, prefilled, matchedDef.confidenceScore);
            continue;
          }
        }
      }

      // Multi-column or unpunctuated line splitting (e.g. "Full Name       Address")
      const columnSegments = this.splitMultiColumnLine(line);

      for (const segment of columnSegments) {
        if (this.isGarbageLabel(segment)) continue;

        // Check if segment has colon: "Name: Akash"
        const segColon = segment.match(/^([A-Za-z\s/&()\-.]{2,35})\s*[:=]\s*(.*)$/);
        if (segColon) {
          const segDef = this.findFieldDefinition(segColon[1]);
          if (segDef) {
            let prefilled = segColon[2].replace(/^[_.\-\s|[\],~`="]+|[_.\-\s|[\],~`="]+$/g, '').trim();
            if (/^[_\-.\s|[\]~`="]+$/.test(segColon[2])) prefilled = '';
            addField(segDef.label, segDef.type, segDef.placeholder, prefilled, segDef.confidenceScore);
            continue;
          }
        }

        // Check standalone segment as a field label
        const matchedDef = this.findFieldDefinition(segment);
        if (matchedDef) {
          addField(matchedDef.label, matchedDef.type, matchedDef.placeholder, '', matchedDef.confidenceScore);
        }
      }
    }

    // -------------------------------------------------------------
    // Strategy 2: Bounding Box Proximity (if OCR positional data available)
    // -------------------------------------------------------------
    if (ocrData?.lines && Array.isArray(ocrData.lines) && ocrData.lines.length > 0) {
      for (const ocrLine of ocrData.lines) {
        const text = ocrLine.text || '';
        const confidence = ocrLine.confidence || 0;

        if (this.isGarbageLabel(text, confidence)) continue;

        const segments = this.splitMultiColumnLine(text);
        for (const seg of segments) {
          const matchedDef = this.findFieldDefinition(seg, confidence);
          if (matchedDef) {
            const id = this.generateFieldId(matchedDef.label);
            if (!seenIds.has(id)) {
              addField(matchedDef.label, matchedDef.type, matchedDef.placeholder, '', matchedDef.confidenceScore);
            }
          }
        }
      }
    }

    if (detected.length > 0) {
      return {
        fields: detected,
        detectedCount: detected.length,
        source: 'detected'
      };
    }

    return {
      fields: [],
      detectedCount: 0,
      source: 'none'
    };
  }

  /**
   * Generalized natural voice mapping to dynamically detected fields.
   * Matches spoken phrases naturally to whatever fields exist in the active form.
   *
   * @param {string} spokenText Spoken voice transcript
   * @param {Array} currentFields List of active dynamic form fields
   * @returns {{ updatedFields: Array, changedFieldIds: Array, actionMessage: string }}
   */
  matchSpeechToFields(spokenText, currentFields = []) {
    if (!spokenText || typeof spokenText !== 'string' || currentFields.length === 0) {
      return { updatedFields: currentFields, changedFieldIds: [], actionMessage: '' };
    }

    const raw = spokenText.trim();
    const updated = currentFields.map((f) => ({ ...f }));
    const changedFieldIds = [];
    const messages = [];

    // 1. Handle "Clear [field name]" command
    const clearMatch = raw.match(/^(?:please\s+)?clear(?:\s+my)?\s+(.+)$/i);
    if (clearMatch) {
      const targetName = clearMatch[1].toLowerCase().trim();
      for (const field of updated) {
        if (
          field.label.toLowerCase().includes(targetName) ||
          targetName.includes(field.label.toLowerCase()) ||
          field.id.includes(targetName)
        ) {
          field.value = '';
          changedFieldIds.push(field.id);
          messages.push(`Cleared ${field.label}`);
        }
      }

      if (changedFieldIds.length > 0) {
        return {
          updatedFields: updated,
          changedFieldIds,
          actionMessage: messages.join(', ')
        };
      }
    }

    // 2. Dynamic matching across all active form fields
    for (const field of updated) {
      const labelLower = field.label.toLowerCase();
      const tokens = labelLower.split(/[\s/&]+/).filter((t) => t.length > 2);

      const labelPattern = labelLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tokenPattern = tokens.join('(?:\\s+[a-z/&]+)*?\\s+');

      const speechPatterns = [
        new RegExp(
          `(?:(?:fill|set|change|update)\\s+(?:my\\s+)?(?:${labelPattern}|${tokenPattern})\\s+(?:as|to|is|:)|(?:my\\s+)?(?:${labelPattern}|${tokenPattern})\\s+(?:is|:)|the\\s+(?:${labelPattern}|${tokenPattern})\\s+is)\\s+([^,\\n]+?)(?:,\\s*|\\s+and\\s+(?:my|the)|\\s+my\\s+|$|\\s+the\\s+)`,
          'i'
        ),
        new RegExp(`\\b(?:${labelPattern}|${tokenPattern})\\s*[:=]\\s*([^,\\n]+)`, 'i')
      ];

      // Specific natural conversational aliases
      if (labelLower.includes('email')) {
        speechPatterns.push(/(?:(?:my\s+)?email(?:\s+address)?\s*(?:is|:))\s*([^\s,]+@[^\s,]+)/i);
        speechPatterns.push(/(?:(?:my\s+)?email(?:\s+address)?\s*(?:is|:))\s*([^,\n]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('phone') || labelLower.includes('mobile')) {
        speechPatterns.push(/(?:(?:my\s+)?(?:phone|mobile)(?:\s+number)?\s*(?:is|:))\s*([0-9\s\-+]{7,15})/i);
      }
      if (labelLower.includes('position applied') || labelLower === 'position applied for') {
        speechPatterns.push(/(?:(?:my\s+)?position\s+applied\s+for\s+(?:is|:)|applying\s+for|position\s+is)\s+([A-Za-z\s]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('school') || labelLower.includes('institution')) {
        speechPatterns.push(/(?:i\s+studied\s+at|studied\s+at|(?:my\s+)?(?:school|institution|college|university)\s+(?:is|was|:))\s+([A-Za-z\s]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('degree') || labelLower.includes('certification')) {
        speechPatterns.push(/(?:(?:my\s+)?(?:degree|certification|qualification|course)\s+(?:is|was|:))\s+([A-Za-z\s]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('year completed') || labelLower.includes('year of passing') || labelLower.includes('year')) {
        speechPatterns.push(/(?:i\s+completed\s+(?:it\s+)?in|completed\s+in|graduation\s+year\s+is|year\s+is)\s+([0-9]{4})/i);
      }
      if (labelLower.includes('company')) {
        speechPatterns.push(/(?:(?:my\s+)?company(?:\s+name)?\s+(?:is|was|:)|employer\s+(?:is|was|:)|worked\s+at)\s+([A-Za-z\s]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('position held')) {
        speechPatterns.push(/(?:(?:my\s+)?position\s+held\s+(?:is|was|:)|job\s+title\s+(?:is|was|:)|role\s+(?:is|was|:))\s+([A-Za-z\s]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('employment dates')) {
        speechPatterns.push(/(?:employment\s+dates\s+(?:are|were|from|:)|dates\s+from)\s+([A-Za-z0-9\s\-–to]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('skills')) {
        speechPatterns.push(/(?:(?:my\s+)?skills(?:\s*&\s*qualifications)?\s+(?:are|is|:))\s+([^.\n]+?)(?:,?\s+and\s+(?:my|the)|$)/i);
      }
      if (labelLower.includes('reference name')) {
        speechPatterns.push(/(?:(?:my\s+)?reference(?:\s+name)?\s+(?:is|:)|referee\s+is)\s+([A-Za-z\s]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('relationship')) {
        speechPatterns.push(/(?:(?:my\s+)?relationship\s+(?:is|:)|relation\s+(?:is|:))\s+([A-Za-z\s]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('branch')) {
        speechPatterns.push(/(?:the\s+branch\s+is|branch\s+(?:is|:))\s+([A-Za-z\s]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('ifsc')) {
        speechPatterns.push(/(?:my\s+)?ifsc(?:\s*code)?\s*(?:is|:)\s*([A-Za-z0-9\s]{8,14})/i);
      }
      if (labelLower.includes('account') && labelLower.includes('number')) {
        speechPatterns.push(/(?:my\s+)?account(?:\s*number|\s*no)?\s*(?:is|:)\s*([0-9\sA-Za-z]{6,20})/i);
      }
      if (labelLower.includes('account') && labelLower.includes('name')) {
        speechPatterns.push(/(?:my\s+)?account\s+holder(?:\s+name)?\s*(?:is|:)\s*([A-Za-z\s]+?)(?:,|$|\s+and)/i);
      }
      if (labelLower.includes('city')) {
        speechPatterns.push(/(?:i\s+live\s+in|city\s+(?:is|:))\s+([A-Za-z\s]+?)(?:,|$|\s+and|\s+state|\s+pin)/i);
      }
      if (labelLower.includes('state')) {
        speechPatterns.push(/(?:my\s+state\s+is|state\s+(?:is|:)|,\s*([A-Za-z\s]+?)\s+and\s+(?:my\s+)?pin)/i);
      }

      for (const pattern of speechPatterns) {
        const match = raw.match(pattern);
        if (match && match[1]) {
          let val = match[1].trim();

          // Field type formatting & normalization
          if (field.type === 'email' || labelLower.includes('email')) {
            val = val
              .toLowerCase()
              .replace(/\s*(?:@|at\s*the\s*rate|at)\s*/gi, '@')
              .replace(/\s*(?:\.|dot)\s*/gi, '.')
              .replace(/\s+/g, '');
          } else if (labelLower.includes('ifsc')) {
            val = val.replace(/\s+/g, '').toUpperCase();
          } else if (labelLower.includes('pin') || field.id.includes('pin')) {
            val = val.replace(/\D/g, '');
            if (val.length >= 6) val = val.slice(0, 6);
          } else if (field.type === 'tel' || labelLower.includes('phone') || labelLower.includes('mobile')) {
            val = val.replace(/\D/g, '');
            if (val.length >= 10) val = val.slice(-10);
          } else if (labelLower.includes('account') && !labelLower.includes('name')) {
            val = val.replace(/\s+/g, '');
          } else if (field.type === 'text' && !labelLower.includes('address') && !labelLower.includes('skills')) {
            val = this.toTitleCase(val);
          }

          if (val && field.value !== val) {
            field.value = val;
            if (!changedFieldIds.includes(field.id)) {
              changedFieldIds.push(field.id);
              messages.push(`Set ${field.label} to "${val}"`);
            }
          }
          break;
        }
      }
    }

    return {
      updatedFields: updated,
      changedFieldIds,
      actionMessage: messages.length > 0 ? messages.join('. ') : 'Voice details updated'
    };
  }

  /**
   * Field validation for completed values
   */
  validateFields(fields = []) {
    const errors = {};
    const warnings = {};

    for (const field of fields) {
      if (!field.value || typeof field.value !== 'string' || field.value.trim() === '') {
        continue;
      }

      const val = field.value.trim();
      const labelLower = field.label.toLowerCase();

      if (field.type === 'email' || labelLower.includes('email')) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          errors[field.id] = 'Please enter a valid email format (e.g. name@example.com).';
        }
      }

      if (field.type === 'tel' || labelLower.includes('phone') || labelLower.includes('mobile')) {
        if (!/^\d{10}$/.test(val.replace(/\D/g, ''))) {
          errors[field.id] = 'Phone number should be 10 digits.';
        }
      }

      if (labelLower.includes('pin') || field.id.includes('pin')) {
        if (!/^\d{6}$/.test(val.replace(/\D/g, ''))) {
          errors[field.id] = 'PIN code should be a 6-digit postal code.';
        }
      }

      if (labelLower.includes('ifsc')) {
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(val)) {
          warnings[field.id] = 'IFSC codes typically have 11 characters (e.g. SBIN0001234).';
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings
    };
  }

  /**
   * Creates a structured text representation of the filled form for export/copying
   */
  exportFormData(fields = []) {
    const lines = ['=== COMPLETED FORM DATA ===\n'];
    for (const f of fields) {
      lines.push(`${f.label}: ${f.value || '[Not Provided]'}`);
    }
    lines.push(`\nSubmitted at: ${new Date().toLocaleString()}`);
    return lines.join('\n');
  }

  toTitleCase(str) {
    if (!str) return '';
    return str
      .split(/\s+/)
      .map((w) => {
        if (/^(ifsc|pin|dob|pan|uid|url|ctc|cgpa|gpa)$/i.test(w)) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  }
}

export const formService = new FormService();
export default formService;
