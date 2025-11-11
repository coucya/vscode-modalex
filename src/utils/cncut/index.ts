
export interface DictNode {
    [key: string]: DictNode | boolean | number | string | undefined;
    word_state?: boolean;
    word_frequency?: number;
    word_property?: string;
}

export type Dictionary = DictNode;

type SplitResult = {
    content: string;
    start: number; end: number;
}

function split(str: string, delimiters: string): SplitResult[] {
    const result: SplitResult[] = [];
    const delimiterSet = new Set(delimiters);

    let currentStart = 0;

    for (let i = 0; i < str.length; i++) {
        if (delimiterSet.has(str[i])) {
            if (currentStart < i) {
                result.push({
                    content: str.substring(currentStart, i),
                    start: currentStart,
                    end: i - 1,
                });
            }
            while (i < str.length && delimiterSet.has(str[i])) {
                i++;
            }
            currentStart = i;
        }
    }
    if (currentStart < str.length) {
        result.push({
            content: str.substring(currentStart),
            start: currentStart,
            end: str.length - 1,
        });
    }
    return result;
}

export class Cncut {
    private _dictionary: Dictionary;
    private _delimiters: string;

    constructor(dictContent: string, delimiters: string = " ") {
        this._delimiters = delimiters;
        this._dictionary = this._parseDictionaryContent(dictContent);
    }

    public setDelimiters(delimiters: string) {
        this._delimiters = delimiters;
    }

    private _parseDictionaryContent(content: string): Dictionary {
        const dict: Dictionary = {};
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length === 0) continue;

            const word = parts[0];
            const frequency = parts[1] ? parseInt(parts[1], 10) : 3;
            const property = parts[2] || 'no';

            this._addWordToDict(dict, word, frequency, property);
        }

        return dict;
    }

    private _addWordToDict(dict: Dictionary, word: string, frequency: number = 3, property: string = 'no'): void {
        let current: DictNode = dict;

        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            const isLastChar = i === word.length - 1;

            if (!current[char]) {
                current[char] = {};
            }

            if (typeof current[char] === 'boolean') {
                current[char] = {};
            }

            current = current[char] as DictNode;

            if (isLastChar) {
                current.word_state = true;
                current.word_frequency = frequency;
                current.word_property = property;
            }
        }
    }

    public cut(text: string): SplitResult[] {
        if (!text || typeof text !== 'string') {
            return [];
        }

        const result: SplitResult[] = [];

        const segments = split(text, this._delimiters);

        for (const segment of segments) {
            if (!segment.content.trim()) {
                continue;
            }

            const segmentPosition = segment.start;
            const segmentText = segment.content;

            const chineseWords = this._cutChineseText(segmentText);

            const hasValidWords = chineseWords.some(word => word.content.length > 1 && this._isWordInDict(word.content));

            if (hasValidWords) {
                for (const word of chineseWords) {
                    result.push({
                        content: word.content,
                        start: segmentPosition + word.start,
                        end: segmentPosition + word.end
                    });
                }
            } else {
                result.push({
                    content: segmentText,
                    start: segmentPosition,
                    end: segmentPosition + segmentText.length
                });
            }
        }

        return result;
    }

    private _cutChineseText(text: string): SplitResult[] {
        const result: SplitResult[] = [];
        let position = 0;
        let lastMatchEnd = 0;

        const allMatches: Array<{ word: string, start: number, end: number }> = [];

        while (position < text.length) {
            const matchedWord = this._findLongestMatch(text, position);
            if (matchedWord.word.length > 0) {
                allMatches.push(matchedWord);
                position = matchedWord.end;
            } else {
                position++;
            }
        }

        if (allMatches.length === 0) {
            result.push({
                content: text,
                start: 0,
                end: text.length
            });
        } else {
            let lastEnd = 0;
            for (const match of allMatches) {
                if (match.start > lastEnd) {
                    const unmatchedText = text.substring(lastEnd, match.start);
                    result.push({
                        content: unmatchedText,
                        start: lastEnd,
                        end: match.start
                    });
                }

                result.push({
                    content: match.word,
                    start: match.start,
                    end: match.end
                });

                lastEnd = match.end;
            }

            if (lastEnd < text.length) {
                const remainingText = text.substring(lastEnd);
                result.push({
                    content: remainingText,
                    start: lastEnd,
                    end: text.length
                });
            }
        }

        return result;
    }

    private _findLongestMatch(text: string, position: number): { word: string, start: number, end: number } {
        let maxLength = 0;
        let matchedWord = '';

        for (let length = 1; length <= text.length - position; length++) {
            const candidate = text.substring(position, position + length);

            if (this._isWordInDict(candidate)) {
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

    private _isWordInDict(word: string): boolean {
        if (!word || word.length === 0) {
            return false;
        }

        let current: DictNode | boolean | number | string | undefined = this._dictionary;

        for (let i = 0; i < word.length; i++) {
            const char = word[i];

            if (typeof current === 'object' && current !== null) {
                const node = current as DictNode;
                if (!node[char]) {
                    return false;
                }
                current = node[char];
            } else {
                return false;
            }
        }

        return typeof current === 'object' && current !== null &&
            (current as DictNode).word_state === true;
    }


}

export default Cncut;
