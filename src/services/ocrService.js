/**
 * OCR Service
 * Handles optical character recognition from uploaded images and multi-page PDF documents
 * using Tesseract.js and Mozilla's PDF.js (pdfjs-dist).
 *
 * Includes conservative image preprocessing (grayscale, contrast normalization, resolution scaling)
 * and smart post-processing cleanup to enhance OCR accuracy without rewriting document facts.
 */
import Tesseract from 'tesseract.js';

export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/bmp'
];

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit

class OCRService {
  /**
   * Validates whether a file is valid for OCR
   */
  validateFile(file) {
    if (!file) {
      return { valid: false, error: 'No file was provided.' };
    }

    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

    if (!isPdf && !isImage) {
      return {
        valid: false,
        error: `Unsupported file format (${file.type || 'unknown'}). Please upload a JPG, PNG, JPEG, or PDF document.`
      };
    }

    if (file.size === 0) {
      return { valid: false, error: 'The uploaded file is empty (0 bytes).' };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File size (${sizeMB} MB) exceeds the maximum allowed limit of 15 MB.`
      };
    }

    return { valid: true };
  }

  /**
   * Helper to check if a file is a PDF
   */
  isPdfFile(file) {
    if (!file) return false;
    return file.type === 'application/pdf' || (typeof file.name === 'string' && file.name.toLowerCase().endsWith('.pdf'));
  }

  /**
   * Main entry point to extract text from an image or PDF
   * @param {File|Blob|string} fileOrSource
   * @param {Object} options
   * @param {Function} [options.onProgress]
   * @param {string} [options.lang]
   * @returns {Promise<{ text: string, confidence: number, charCount: number, wordCount: number, isPdf?: boolean, totalPages?: number }>}
   */
  async extractText(fileOrSource, options = {}) {
    if (!fileOrSource) {
      throw new Error('Please select or upload a document first.');
    }

    if (this.isPdfFile(fileOrSource)) {
      return this.extractTextFromPdf(fileOrSource, options);
    }

    return this.extractTextFromImage(fileOrSource, options);
  }

  /**
   * Performs conservative image preprocessing using an in-memory canvas
   * (Grayscale, contrast enhancement, resolution normalization)
   */
  async preprocessImage(imageSource) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return imageSource;
    }

    try {
      // Load image into an Image element
      const img = new Image();
      const imgLoaded = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for preprocessing.'));
      });

      if (imageSource instanceof Blob || imageSource instanceof File) {
        img.src = URL.createObjectURL(imageSource);
      } else if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else {
        return imageSource;
      }

      await imgLoaded;

      // Clean up object URL if created
      if (imageSource instanceof Blob || imageSource instanceof File) {
        URL.revokeObjectURL(img.src);
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return imageSource;

      // Upscale low-resolution images conservatively to improve OCR glyph recognition
      let scale = 1.0;
      if (img.width < 1200 && img.height < 1200) {
        scale = Math.min(2.0, 1500 / Math.max(img.width, img.height));
      }

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Extract pixel data for grayscale conversion & contrast normalization
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const len = data.length;

      // Find min and max luminance for adaptive contrast stretching
      let minL = 255;
      let maxL = 0;

      for (let i = 0; i < len; i += 4) {
        // Luminance calculation
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < minL) minL = lum;
        if (lum > maxL) maxL = lum;
      }

      const range = maxL - minL || 1;

      // Apply grayscale and contrast stretch
      for (let i = 0; i < len; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Normalized stretched luminance
        let stretched = ((lum - minL) / range) * 255;

        // Mild S-curve contrast boost to separate text from background without harsh threshold clipping
        if (stretched > 180) {
          stretched = Math.min(255, stretched * 1.05);
        } else if (stretched < 80) {
          stretched = Math.max(0, stretched * 0.9);
        }

        data[i] = stretched;
        data[i + 1] = stretched;
        data[i + 2] = stretched;
      }

      ctx.putImageData(imageData, 0, 0);

      // Convert preprocessed canvas to Blob
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      // Free canvas bitmap resources
      canvas.width = 0;
      canvas.height = 0;

      return blob || imageSource;
    } catch (e) {
      console.warn('Preprocessing skipped (using original source):', e);
      return imageSource;
    }
  }

  /**
   * Performs OCR on an image file or URL with preprocessing and post-processing
   */
  async extractTextFromImage(imageSource, options = {}) {
    const { onProgress, lang = 'eng' } = options;

    try {
      if (onProgress) {
        onProgress({ progress: 5, status: 'Preprocessing document for optimal clarity...' });
      }

      // Step 1: Preprocess image
      const processedSource = await this.preprocessImage(imageSource);

      if (onProgress) {
        onProgress({ progress: 15, status: 'Initializing OCR engine...' });
      }

      // Step 2: Tesseract Recognition
      const result = await Tesseract.recognize(
        processedSource,
        lang,
        {
          logger: (message) => {
            if (onProgress && message) {
              const statusName = message.status || '';

              if (statusName === 'loading tesseract core') {
                const percentage = 15 + Math.round((message.progress || 0) * 15);
                onProgress({ progress: percentage, status: 'Loading OCR engine...' });
              } else if (statusName === 'initializing tesseract' || statusName === 'loading language traineddata') {
                const percentage = 30 + Math.round((message.progress || 0) * 20);
                onProgress({ progress: percentage, status: 'Loading language dictionary...' });
              } else if (statusName === 'recognizing text') {
                const percentage = 50 + Math.round((message.progress || 0) * 45);
                onProgress({ progress: percentage, status: `Reading document... ${percentage}%` });
              } else {
                onProgress({ progress: 95, status: 'Cleaning and finalizing extracted text...' });
              }
            }
          }
        }
      );

      const rawText = result?.data?.text || '';
      const confidence = result?.data?.confidence || 0;
      const lines = result?.data?.lines || [];
      const words = result?.data?.words || [];
      const blocks = result?.data?.blocks || [];

      // Step 3: Post-processing artifact cleanup
      const cleanedText = this.cleanExtractedText(rawText);

      if (onProgress) {
        onProgress({ progress: 100, status: 'Text extracted successfully!' });
      }

      const trimmed = cleanedText.trim();
      const charCount = trimmed.length;
      const wordCount = trimmed === '' ? 0 : trimmed.split(/\s+/).filter(Boolean).length;

      return {
        text: cleanedText,
        confidence: Math.round(confidence),
        charCount,
        wordCount,
        isPdf: false,
        ocrData: {
          lines: lines.map((l) => ({ text: l.text?.trim(), bbox: l.bbox, confidence: l.confidence })),
          words: words.map((w) => ({ text: w.text?.trim(), bbox: w.bbox, confidence: w.confidence })),
          blocks: blocks.map((b) => ({ text: b.text?.trim(), bbox: b.bbox }))
        }
      };
    } catch (err) {
      console.error('Image OCR Error:', err);
      throw new Error(
        err?.message || 'Failed to read text from the image. Please try a clearer document.',
        { cause: err }
      );
    }
  }

  /**
   * Performs multi-page PDF rendering, canvas preprocessing, and OCR extraction
   * @param {File|Blob|ArrayBuffer} pdfFile
   * @param {Object} options
   * @returns {Promise<{ text: string, confidence: number, charCount: number, wordCount: number, isPdf: boolean, totalPages: number }>}
   */
  async extractTextFromPdf(pdfFile, options = {}) {
    const { onProgress, lang = 'eng' } = options;

    try {
      if (onProgress) {
        onProgress({ progress: 5, status: 'Loading PDF library...' });
      }

      // Dynamically load PDF.js for optimal performance & code-splitting
      const pdfjsLib = await import('pdfjs-dist');

      if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
          ).toString();
        } catch {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.2.108'}/build/pdf.worker.min.mjs`;
        }
      }

      let arrayBuffer;
      if (pdfFile instanceof ArrayBuffer) {
        arrayBuffer = pdfFile;
      } else if (pdfFile instanceof Blob || pdfFile instanceof File) {
        arrayBuffer = await pdfFile.arrayBuffer();
      } else {
        throw new Error('Invalid PDF data format provided.');
      }

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('The PDF document is empty (0 bytes).');
      }

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      if (numPages === 0) {
        throw new Error('The PDF document does not contain any pages.');
      }

      if (onProgress) {
        onProgress({
          progress: 10,
          status: `PDF loaded (${numPages} page${numPages > 1 ? 's' : ''}). Preparing OCR...`
        });
      }

      const pageTexts = [];
      let totalConfidence = 0;

      // Process each page sequentially to preserve order and manage memory
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const pageStartPercent = 10 + Math.round(((pageNum - 1) / numPages) * 85);
        const pageEndPercent = 10 + Math.round((pageNum / numPages) * 85);

        if (onProgress) {
          onProgress({
            progress: pageStartPercent,
            status: numPages > 1
              ? `Rendering page ${pageNum} of ${numPages}...`
              : 'Rendering PDF page at high resolution...'
          });
        }

        const page = await pdfDoc.getPage(pageNum);
        // Render at scale 2.2 (~200 DPI) for crisp text recognition
        const viewport = page.getViewport({ scale: 2.2 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        await page.render(renderContext).promise;

        // Apply contrast normalization to canvas pixels for cleaner background
        try {
          const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = imgData.data;
          for (let p = 0; p < pixels.length; p += 4) {
            const lum = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
            // Crisp text background separation
            if (lum > 220) {
              pixels[p] = 255;
              pixels[p + 1] = 255;
              pixels[p + 2] = 255;
            } else if (lum < 60) {
              pixels[p] = 0;
              pixels[p + 1] = 0;
              pixels[p + 2] = 0;
            }
          }
          context.putImageData(imgData, 0, 0);
        } catch {
          // If canvas context manipulation is restricted, continue with normal render
        }

        // Convert canvas page to blob
        const pageBlob = await new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error(`Failed to render page ${pageNum} to image for OCR.`));
            }
          }, 'image/png');
        });

        // Free canvas bitmap resources
        canvas.width = 0;
        canvas.height = 0;

        // Perform OCR on this rendered page
        const pageResult = await Tesseract.recognize(pageBlob, lang, {
          logger: (message) => {
            if (onProgress && message && message.status === 'recognizing text') {
              const currentStep = pageStartPercent + Math.round((message.progress || 0) * (pageEndPercent - pageStartPercent));
              onProgress({
                progress: Math.min(95, currentStep),
                status: numPages > 1
                  ? `OCR page ${pageNum} of ${numPages}... ${Math.round((message.progress || 0) * 100)}%`
                  : `Reading document... ${Math.round((message.progress || 0) * 100)}%`
              });
            }
          }
        });

        const rawPageText = pageResult?.data?.text || '';
        const pageConfidence = pageResult?.data?.confidence || 0;
        const pageLines = pageResult?.data?.lines || [];
        const pageWords = pageResult?.data?.words || [];
        const cleanedPageText = this.cleanExtractedText(rawPageText);

        totalConfidence += pageConfidence;
        pageTexts.push({
          pageNum,
          text: cleanedPageText,
          lines: pageLines.map((l) => ({ text: l.text?.trim(), bbox: l.bbox, confidence: l.confidence, pageNum })),
          words: pageWords.map((w) => ({ text: w.text?.trim(), bbox: w.bbox, confidence: w.confidence, pageNum }))
        });

        // Release page resources
        page.cleanup();
      }

      // Combine extracted text across pages
      let combinedText = '';
      const combinedLines = [];
      const combinedWords = [];

      if (numPages === 1) {
        combinedText = pageTexts[0]?.text || '';
        combinedLines.push(...(pageTexts[0]?.lines || []));
        combinedWords.push(...(pageTexts[0]?.words || []));
      } else {
        combinedText = pageTexts
          .map((p) => `--- Page ${p.pageNum} ---\n\n${p.text}`)
          .join('\n\n');
        for (const pt of pageTexts) {
          combinedLines.push(...(pt.lines || []));
          combinedWords.push(...(pt.words || []));
        }
      }

      const trimmed = combinedText.trim();
      const avgConfidence = Math.round(totalConfidence / numPages);
      const charCount = trimmed.length;
      const wordCount = trimmed === '' ? 0 : trimmed.split(/\s+/).filter(Boolean).length;

      if (onProgress) {
        onProgress({ progress: 100, status: 'Text extracted successfully!' });
      }

      return {
        text: combinedText,
        confidence: avgConfidence,
        charCount,
        wordCount,
        isPdf: true,
        totalPages: numPages,
        ocrData: {
          lines: combinedLines,
          words: combinedWords
        }
      };
    } catch (err) {
      console.error('PDF OCR Error:', err);
      throw new Error(
        err?.message || 'Failed to process and read text from the PDF. Please check if the file is valid and readable.',
        { cause: err }
      );
    }
  }

  /**
   * Conservative OCR post-processing cleanup.
   * Removes obvious noise patterns and artifact lines without changing document meaning,
   * preserving legitimate punctuation, numbers, names, URLs, and addresses.
   */
  cleanExtractedText(text) {
    if (!text || typeof text !== 'string') return '';

    return text
      .replace(/\r\n/g, '\n')
      .replace(/\f/g, '\n')
      // Remove meaningless repeated symbol lines (e.g. "||||||", "_____", "~~~~~~", "......")
      .replace(/^[\s|_~=.-]{4,}$/gm, '')
      // Remove common single stray broken symbol lines while preserving single valid words/letters
      .replace(/^[^\w\s\d₹$€@#%&()'".,-]$/gm, '')
      // Clean isolated OCR artifacts like stray single tildes or backticks
      .replace(/(^|\n)[`~§±©®]{1,2}(\n|$)/g, '$1$2')
      // Fix excessive spaces within lines
      .replace(/[ \t]+/g, ' ')
      // Normalize multiple blank lines to at most 2
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export const ocrService = new OCRService();
export default ocrService;
