// Constants
const DEFAULT_DELIMITERS = ' ';
const DEFAULT_WORD_FREQUENCY = 3;
const DEFAULT_WORD_PROPERTY = 'no';
const MIN_WORD_LENGTH = 1;

// Type Definitions (simplified)
export interface DictNode {
    [key: string]: DictNode | boolean | number | string | undefined;
    word_state?: boolean;
    word_frequency?: number;
    word_property?: string;
}

export type Dictionary = DictNode;

export interface SplitResult {
    content: string;
    start: number;
    end: number;
}

interface MatchResult {
    word: string;
    start: number;
    end: number;
}

interface DictionaryEntry {
    word: string;
    frequency: number;
    property: string;
}

// Utility Functions
function validateInput(text: unknown): text is string {
    return typeof text === 'string' && text.length > 0;
}

function createSplitResult(content: string, start: number, end: number): SplitResult {
    return { content, start, end };
}

function splitTextByDelimiters(text: string, delimiters: string): SplitResult[] {
    if (!validateInput(text)) {
        return [];
    }

    const result: SplitResult[] = [];
    const delimiterSet = new Set(delimiters);
    let currentStart = 0;

    for (let i = 0; i < text.length; i++) {
        if (delimiterSet.has(text[i])) {
            if (currentStart < i) {
                result.push(createSplitResult(
                    text.substring(currentStart, i),
                    currentStart,
                    i - 1
                ));
            }

            // Skip consecutive delimiters
            while (i < text.length && delimiterSet.has(text[i])) {
                i++;
            }
            currentStart = i;
        }
    }

    // Add the last segment if exists
    if (currentStart < text.length) {
        result.push(createSplitResult(
            text.substring(currentStart),
            currentStart,
            text.length - 1
        ));
    }

    return result;
}

// Dictionary Parser
class DictionaryParser {
    static parse(content: string): Dictionary {
        const dict: Dictionary = {};
        const lines = content.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        for (const line of lines) {
            const entry = this.parseLine(line);
            if (entry) {
                DictionaryBuilder.addWord(dict, entry);
            }
        }

        return dict;
    }

    private static parseLine(line: string): DictionaryEntry | null {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 0) {
            return null;
        }

        return {
            word: parts[0],
            frequency: parts[1] ? parseInt(parts[1], 10) : DEFAULT_WORD_FREQUENCY,
            property: parts[2] || DEFAULT_WORD_PROPERTY
        };
    }
}

// Dictionary Builder
class DictionaryBuilder {
    static addWord(dict: Dictionary, entry: DictionaryEntry): void {
        let current = dict;

        for (let i = 0; i < entry.word.length; i++) {
            const char = entry.word[i];
            const isLastChar = i === entry.word.length - 1;

            if (!current[char]) {
                current[char] = {};
            }

            // Ensure we have a DictNode, not primitive values
            if (typeof current[char] !== 'object' || current[char] === null) {
                current[char] = {};
            }

            current = current[char] as DictNode;

            if (isLastChar) {
                current.word_state = true;
                current.word_frequency = entry.frequency;
                current.word_property = entry.property;
            }
        }
    }
}

// Text Segmenter
class TextSegmenter {
    constructor(private dictionary: Dictionary) { }

    segment(text: string, delimiters: string): SplitResult[] {
        if (!validateInput(text)) {
            return [];
        }

        const segments = splitTextByDelimiters(text, delimiters);
        const result: SplitResult[] = [];

        for (const segment of segments) {
            if (!segment.content.trim()) {
                continue;
            }

            const segmentedWords = this.segmentChineseText(segment.content);
            const hasValidWords = this.hasValidDictionaryWords(segmentedWords);

            if (hasValidWords) {
                this.addSegmentedWords(result, segmentedWords, segment.start);
            } else {
                this.addUnsegmentedWord(result, segment);
            }
        }

        return result;
    }

    private segmentChineseText(text: string): SplitResult[] {
        const result: SplitResult[] = [];
        const matches = this.findAllMatches(text);

        if (matches.length === 0) {
            result.push(createSplitResult(text, 0, text.length));
            return result;
        }

        this.buildResultFromMatches(result, matches, text);
        return result;
    }

    private findAllMatches(text: string): MatchResult[] {
        const matches: MatchResult[] = [];
        let position = 0;

        while (position < text.length) {
            const match = this.findLongestMatch(text, position);
            if (match.word.length > 0) {
                matches.push(match);
                position = match.end;
            } else {
                position++;
            }
        }

        return matches;
    }

    private findLongestMatch(text: string, position: number): MatchResult {
        let maxLength = 0;
        let matchedWord = '';

        const maxPossibleLength = text.length - position;
        for (let length = MIN_WORD_LENGTH; length <= maxPossibleLength; length++) {
            const candidate = text.substring(position, position + length);

            if (this.isWordInDictionary(candidate)) {
                maxLength = length;
                matchedWord = candidate;
            }
        }

        return {
            word: matchedWord,
            start: position,
            end: position + maxLength
        };
    }

    private buildResultFromMatches(result: SplitResult[], matches: MatchResult[], text: string): void {
        let lastEnd = 0;

        for (const match of matches) {
            // Add unmatched text before the match
            if (match.start > lastEnd) {
                const unmatchedText = text.substring(lastEnd, match.start);
                result.push(createSplitResult(unmatchedText, lastEnd, match.start));
            }

            // Add the matched word
            result.push(createSplitResult(match.word, match.start, match.end));
            lastEnd = match.end;
        }

        // Add remaining text after the last match
        if (lastEnd < text.length) {
            const remainingText = text.substring(lastEnd);
            result.push(createSplitResult(remainingText, lastEnd, text.length));
        }
    }

    private hasValidDictionaryWords(words: SplitResult[]): boolean {
        return words.some(word =>
            word.content.length > MIN_WORD_LENGTH && this.isWordInDictionary(word.content)
        );
    }

    private addSegmentedWords(result: SplitResult[], words: SplitResult[], offset: number): void {
        for (const word of words) {
            result.push(createSplitResult(
                word.content,
                offset + word.start,
                offset + word.end
            ));
        }
    }

    private addUnsegmentedWord(result: SplitResult[], segment: SplitResult): void {
        result.push(createSplitResult(
            segment.content,
            segment.start,
            segment.start + segment.content.length
        ));
    }

    private isWordInDictionary(word: string): boolean {
        if (!validateInput(word)) {
            return false;
        }

        let current: DictNode | boolean | number | string | undefined = this.dictionary;

        for (const char of word) {
            if (typeof current !== 'object' || current === null) {
                return false;
            }

            const node = current as DictNode;
            if (!node[char]) {
                return false;
            }
            current = node[char];
        }

        return typeof current === 'object' && current !== null &&
            (current as DictNode).word_state === true;
    }
}

// Main Cncut Class
export class Cncut {
    private dictionary: Dictionary;
    private delimiters: string;
    private segmenter: TextSegmenter;

    constructor(dictContent: string, delimiters: string = DEFAULT_DELIMITERS) {
        this.delimiters = delimiters;
        this.dictionary = DictionaryParser.parse(dictContent);
        this.segmenter = new TextSegmenter(this.dictionary);
    }

    public setDelimiters(delimiters: string): void {
        if (!validateInput(delimiters)) {
            throw new Error('Delimiters must be a non-empty string');
        }
        this.delimiters = delimiters;
    }

    public getDictionary(): Dictionary {
        return this.dictionary;
    }

    public cut(text: string): SplitResult[] {
        return this.segmenter.segment(text, this.delimiters);
    }
}

export default Cncut;