// Simple TF-IDF Vectorizer and Cosine Similarity for RAG in the browser
export class RAGEngine {
    constructor() {
        this.chunks = []; // Array of { text, filename, chunkIndex, vector? }
        this.vocabulary = new Set();
        this.idf = {};
    }

    reset() {
        this.chunks = [];
        this.vocabulary = new Set();
        this.idf = {};
    }

    addChunks(newChunks) {
        this.chunks.push(...newChunks);
        this._updateVocabulary();
        this._computeVectors();
    }

    _updateVocabulary() {
        this.vocabulary = new Set();
        this.chunks.forEach(chunk => {
            const terms = this._tokenize(chunk.text);
            terms.forEach(term => this.vocabulary.add(term));
        });

        // Compute IDF (Inverse Document Frequency)
        const numDocs = this.chunks.length;
        this.idf = {};
        this.vocabulary.forEach(term => {
            const docsWithTerm = this.chunks.filter(c => this._tokenize(c.text).has(term)).length;
            // Add-one smoothing to avoid division by zero
            this.idf[term] = Math.log(numDocs / (1 + docsWithTerm)) + 1;
        });
    }

    _tokenize(text) {
        // Simple tokenizer: lowercase, remove non-alphas, split by whitespace, filter short words
        const terms = text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(t => t.length > 2);
        return new Set(terms);
    }

    _getTermFrequencies(text) {
        const terms = text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(t => t.length > 2);
        const tf = {};
        terms.forEach(t => tf[t] = (tf[t] || 0) + 1);
        return tf;
    }

    _computeVectors() {
        this.chunks.forEach(chunk => {
            chunk.vector = this._createVector(chunk.text);
        });
    }

    _createVector(text) {
        const tf = this._getTermFrequencies(text);
        const vector = {};
        Object.entries(tf).forEach(([term, count]) => {
            if (this.idf[term]) {
                // TF-IDF = Term Frequency * Inverse Document Frequency
                vector[term] = count * this.idf[term];
            }
        });
        return vector;
    }

    _cosineSimilarity(vecA, vecB) {
        const termsA = Object.keys(vecA);
        const termsB = Object.keys(vecB);
        if (termsA.length === 0 || termsB.length === 0) return 0;

        const intersection = termsA.filter(t => termsB.includes(t));

        let dotProduct = 0;
        intersection.forEach(t => dotProduct += vecA[t] * vecB[t]);

        const magA = Math.sqrt(termsA.reduce((sum, t) => sum + vecA[t] ** 2, 0));
        const magB = Math.sqrt(termsB.reduce((sum, t) => sum + vecB[t] ** 2, 0));

        if (magA === 0 || magB === 0) return 0;
        return dotProduct / (magA * magB);
    }

    search(query, k = 3) {
        const queryVector = this._createVector(query);
        const scoredChunks = this.chunks.map(chunk => ({
            ...chunk,
            score: this._cosineSimilarity(queryVector, chunk.vector)
        }));

        return scoredChunks
            .sort((a, b) => b.score - a.score)
            .slice(0, k);
    }
}

export function chunkText(text, filename) {
    const chunkSize = 500;
    const overlap = 100;
    const chunks = [];

    let start = 0;
    let index = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const chunkContent = text.substring(start, end);
        chunks.push({
            text: chunkContent,
            filename: filename,
            chunkIndex: index++
        });
        start += (chunkSize - overlap);
        if (end >= text.length) break;
    }
    return chunks;
}
